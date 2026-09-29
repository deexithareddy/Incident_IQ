"""Hindsight memory client — retain / recall only. No Groq calls here."""

from __future__ import annotations

import os
from typing import Any

import httpx


class HindsightError(Exception):
    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.status_code = status_code


class HindsightClient:
    def __init__(self) -> None:
        self.base_url = (
            os.getenv("HINDSIGHT_URL")
            or os.getenv("HINDSIGHT_BASE_URL")
            or "http://127.0.0.1:8888"
        ).rstrip("/")
        self.bank_id = os.getenv("HINDSIGHT_BANK_ID", "incidentiq-demo")
        self._retain = httpx.AsyncClient(base_url=self.base_url, timeout=120.0)
        self._recall = httpx.AsyncClient(base_url=self.base_url, timeout=60.0)
        self._bank_ready = False

    async def close(self) -> None:
        await self._retain.aclose()
        await self._recall.aclose()

    async def health(self) -> bool:
        try:
            response = await self._recall.get("/health")
            response.raise_for_status()
            data = response.json()
            return data.get("status") == "healthy"
        except Exception:
            return False

    def _raise(self, action: str, response: httpx.Response) -> None:
        detail = response.text
        if len(detail) > 800:
            detail = detail[:800] + "…"
        raise HindsightError(
            f"Hindsight {action} failed ({response.status_code}): {detail}",
            status_code=502 if response.status_code >= 500 else response.status_code,
        )

    async def ensure_bank(self) -> None:
        if self._bank_ready:
            return
        response = await self._retain.put(
            f"/v1/default/banks/{self.bank_id}",
            json={"name": self.bank_id},
        )
        if response.status_code in (200, 201, 409):
            self._bank_ready = True
            return
        if response.status_code == 422:
            # Bank already exists or name is unused; try retain anyway.
            self._bank_ready = True
            return
        if response.status_code not in (404, 405):
            self._raise("create bank", response)
        self._bank_ready = True

    def _format_incident(self, incident: dict[str, Any]) -> str:
        resolution = incident.get("resolution")
        if isinstance(resolution, dict):
            root_cause = incident.get("root_cause") or resolution.get("root_cause", "")
            investigation = incident.get("investigation") or resolution.get("investigation", "")
            resolution_text = incident.get("resolution_text") or resolution.get("resolution", "")
            outcome = incident.get("outcome") or resolution.get("outcome", "")
            lesson = incident.get("lesson") or resolution.get("lesson", "")
        else:
            root_cause = incident.get("root_cause", "")
            investigation = incident.get("investigation", "")
            resolution_text = resolution if isinstance(resolution, str) else ""
            outcome = incident.get("outcome", "")
            lesson = incident.get("lesson", "")

        lines = [
            f"Incident ID: {incident.get('id', '')}",
            f"Title: {incident.get('title', '')}",
            f"Service: {incident.get('service', '')}",
            f"Severity: {incident.get('severity', '')}",
            f"Symptoms: {incident.get('symptoms', '')}",
            f"Metrics: {incident.get('metrics', '')}",
            f"Error Logs: {incident.get('logs', '')}",
            f"Recent Change: {incident.get('recent_change', '')}",
            f"Root Cause: {root_cause}",
            f"Investigation: {investigation}",
            f"Resolution: {resolution_text}",
            f"Outcome: {outcome}",
            f"Lesson Learned: {lesson}",
        ]
        return "\n".join(lines)

    async def retain_incident(self, incident: dict[str, Any]) -> dict[str, Any]:
        await self.ensure_bank()
        incident_id = str(incident.get("id") or "unknown")
        service = incident.get("service") or "unknown service"
        title = incident.get("title") or "Untitled"
        payload = {
            "items": [
                {
                    "content": self._format_incident(incident),
                    "context": f"IncidentIQ production incident: {service} - {title}",
                    "document_id": incident_id,
                    "update_mode": "replace",
                    "metadata": {
                        "source": "incidentiq",
                        "incident_id": incident_id,
                        "service": str(service),
                    },
                }
            ],
            "async": False,
        }
        try:
            response = await self._retain.post(
                f"/v1/default/banks/{self.bank_id}/memories",
                json=payload,
            )
        except httpx.RequestError as exc:
            raise HindsightError(f"Hindsight retain unreachable: {exc}") from exc
        if response.status_code >= 400:
            self._raise("retain", response)
        return response.json()

    async def recall(self, query: str, limit: int = 10) -> dict[str, Any]:
        await self.ensure_bank()
        # RecallRequest has no `limit`; budget/max_tokens size the result set.
        payload = {
            "query": query,
            "budget": "mid",
            "max_tokens": 4096,
        }
        try:
            response = await self._recall.post(
                f"/v1/default/banks/{self.bank_id}/memories/recall",
                json=payload,
            )
        except httpx.RequestError as exc:
            raise HindsightError(f"Hindsight recall unreachable: {exc}") from exc
        if response.status_code >= 400:
            self._raise("recall", response)
        data = response.json()
        results = data.get("results") or []
        if limit and len(results) > limit:
            data = {**data, "results": results[:limit]}
        return data
