"""Groq chat completions — reasoning only. No Hindsight calls here."""

from __future__ import annotations

import asyncio
import os
from typing import Any

import httpx


class GroqClient:
    def __init__(self) -> None:
        self.api_key = os.getenv("GROQ_API_KEY", "")
        self.model = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
        self.service_tier = os.getenv("GROQ_SERVICE_TIER", "on_demand")
        self.base_url = "https://api.groq.com/openai/v1/chat/completions"
        self.client = httpx.AsyncClient(timeout=90.0)

    async def close(self) -> None:
        await self.client.aclose()

    def is_configured(self) -> bool:
        key = (self.api_key or "").strip()
        if not key.startswith("gsk_"):
            return False
        if "your_groq" in key.lower() or key.endswith("_here"):
            return False
        return True

    async def chat_completion(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 4096,
        response_format: dict[str, str] | None = None,
    ) -> str:
        if not self.is_configured():
            raise ValueError("Groq is not configured (GROQ_API_KEY missing or not a gsk_ key).")

        if response_format is None:
            response_format = {"type": "json_object"}

        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "service_tier": self.service_tier,
            "response_format": response_format,
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        backoff = 2.0
        last_error = "Groq request failed"
        for attempt in range(4):
            try:
                response = await self.client.post(self.base_url, headers=headers, json=payload)
            except httpx.RequestError as exc:
                last_error = f"Groq unreachable: {exc}"
                if attempt == 3:
                    raise RuntimeError(last_error) from exc
                await asyncio.sleep(backoff)
                backoff *= 2
                continue

            if response.status_code == 429 and attempt < 3:
                await asyncio.sleep(backoff)
                backoff *= 2
                continue

            if response.status_code >= 400:
                body = response.text
                if len(body) > 500:
                    body = body[:500] + "…"
                raise RuntimeError(f"Groq API error ({response.status_code}): {body}")

            data = response.json()
            content = (data.get("choices") or [{}])[0].get("message", {}).get("content")
            if not content:
                raise RuntimeError("Groq returned empty content")
            return content

        raise RuntimeError(last_error)
