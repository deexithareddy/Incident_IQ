import json
from typing import Any


def build_recall_query(incident: dict[str, Any]) -> str:
    parts: list[str] = []
    if incident.get("title"):
        parts.append(str(incident["title"]))
    if incident.get("service"):
        parts.append(f"service {incident['service']}")
    if incident.get("symptoms"):
        parts.append(str(incident["symptoms"]))
    logs = incident.get("logs") or ""
    if logs:
        parts.append(str(logs)[:800])
    if incident.get("recent_change"):
        parts.append(f"recent change: {incident['recent_change']}")
    return " | ".join(parts)


def build_analysis_prompt(
    incident: dict[str, Any],
    recalled_memories: list[dict[str, Any]],
) -> list[dict[str, str]]:
    memory_count = len(recalled_memories)
    system_prompt = (
        "You are an SRE incident-response agent. You recommend only; you never execute production actions.\n"
        "Use ONLY the recalled Hindsight memories as historical evidence. Cite incident IDs or titles from those memories.\n"
        "Do not invent past incidents. Do not pretend certainty. If a memory is only weakly related, say so.\n"
        "If zero memories were recalled, say that plainly and give only generic guidance — no fake past incidents.\n"
        "Respond with a single JSON object matching this schema:\n"
        "{\n"
        '  "summary": "string",\n'
        '  "likely_causes": [{"cause": "string", "confidence": 0.0, "reasoning": "string"}],\n'
        '  "relevant_past_incidents": [{"incident": "id or title", "relevance": "string", "previous_resolution": "string", "lesson": "string"}],\n'
        '  "investigation_steps": ["string"],\n'
        '  "recommended_next_action": "string",\n'
        '  "memory_influence": "how recalled memories changed this analysis, or that none were available"\n'
        "}\n"
        f"Recalled memory count: {memory_count}."
    )
    user_prompt = (
        "--- Current incident ---\n"
        f"{json.dumps(incident, indent=2)}\n\n"
        "--- Recalled Hindsight memories (historical evidence only) ---\n"
        f"{json.dumps(recalled_memories, indent=2)}\n"
    )
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
