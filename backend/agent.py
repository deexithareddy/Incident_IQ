import json
import re
from typing import Any

from models import AnalysisResult, IncidentInput
from prompts import build_analysis_prompt, build_recall_query


def _parse_json(text: str) -> dict[str, Any]:
    text = text.strip()
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise
        parsed = json.loads(match.group(0))
    # Groq sometimes wraps the response in an array
    if isinstance(parsed, list):
        # Find the first dict in the array, or merge all dicts
        dicts = [item for item in parsed if isinstance(item, dict)]
        if len(dicts) == 1:
            return dicts[0]
        if dicts:
            merged: dict[str, Any] = {}
            for d in dicts:
                merged.update(d)
            return merged
        raise ValueError("Groq returned a JSON array with no dict elements")
    return parsed


def _normalize_memories(recall_response: dict[str, Any]) -> list[dict[str, Any]]:
    results = recall_response.get("results") or []
    entity_states = recall_response.get("entities") or {}
    normalized: list[dict[str, Any]] = []
    for item in results:
        entities = item.get("entities") or []
        if isinstance(entities, dict):
            entities = list(entities.keys())
        scores = item.get("scores") or {}
        score = scores.get("final") if isinstance(scores, dict) else None
        if not entities and isinstance(entity_states, dict):
            entities = list(entity_states.keys())
        normalized.append(
            {
                "id": item.get("id"),
                "text": item.get("text") or item.get("fact") or "",
                "type": item.get("type"),
                "entities": entities,
                "document_id": item.get("document_id"),
                "context": item.get("context"),
                "score": score,
            }
        )
    return normalized


async def analyze(incident: IncidentInput, hs_client, groq_client) -> AnalysisResult:
    incident_dict = incident.model_dump(exclude_none=True)
    query = build_recall_query(incident_dict)

    try:
        recall_response = await hs_client.recall(query, limit=10)
        recalled = _normalize_memories(recall_response)
    except Exception:
        raise

    empty_memory_note = (
        "No relevant memories were recalled from Hindsight. This is a first-time incident "
        "for this bank; guidance below is generic and not based on prior resolutions."
    )

    try:
        response_text = await groq_client.chat_completion(
            build_analysis_prompt(incident_dict, recalled)
        )
        parsed = _parse_json(response_text)
        result = AnalysisResult.model_validate(parsed)
    except Exception as exc:
        result = AnalysisResult(
            summary=f"Groq analysis was unavailable ({exc}). Recalled memories are still shown.",
            likely_causes=[],
            relevant_past_incidents=[],
            investigation_steps=[
                "Review symptoms, metrics, and logs for the failing service.",
                "Check recent deploys and config changes.",
                "Compare against on-call runbooks if any exist outside this agent.",
            ],
            recommended_next_action="Investigate manually; do not treat this as an AI diagnosis.",
            memory_influence=empty_memory_note if not recalled else "LLM parsing failed; memories were retrieved but not reasoned over.",
        )

    result.memories_used_count = len(recalled)
    result.recalled_memories = recalled
    if not recalled:
        result.memory_influence = empty_memory_note
        result.relevant_past_incidents = []
    return result
