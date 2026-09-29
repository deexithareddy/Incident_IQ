from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class IncidentInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    title: str
    service: str
    severity: str
    symptoms: str
    metrics: Optional[str] = None
    logs: Optional[str] = None
    recent_change: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def accept_form_aliases(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        out = dict(data)
        if "id" not in out and out.get("incident_id"):
            out["id"] = out["incident_id"]
        if "logs" not in out and out.get("error_logs") is not None:
            out["logs"] = out["error_logs"]
        if "recent_change" not in out and out.get("recent_changes") is not None:
            out["recent_change"] = out["recent_changes"]
        return out


class LikelyCause(BaseModel):
    cause: str
    confidence: float
    reasoning: str

    @field_validator("confidence", mode="before")
    @classmethod
    def clamp_confidence(cls, value: Any) -> float:
        try:
            number = float(value)
        except (TypeError, ValueError):
            return 0.0
        if number > 1:
            number = number / 100.0
        return max(0.0, min(1.0, number))


class PastIncidentRef(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    incident: str
    relevance: str
    previous_resolution: str
    lesson: str

    @model_validator(mode="before")
    @classmethod
    def accept_legacy_keys(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        out = dict(data)
        if "incident" not in out:
            out["incident"] = out.get("incident_id_or_title") or out.get("title") or "unknown"
        out.setdefault("relevance", "")
        out.setdefault("previous_resolution", "")
        out.setdefault("lesson", "")
        return out


class AnalysisResult(BaseModel):
    summary: str
    likely_causes: list[LikelyCause] = Field(default_factory=list)
    relevant_past_incidents: list[PastIncidentRef] = Field(default_factory=list)
    investigation_steps: list[str] = Field(default_factory=list)
    recommended_next_action: str = ""
    memory_influence: str = ""
    memories_used_count: int = 0
    recalled_memories: list[dict[str, Any]] = Field(default_factory=list)


class ResolveInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    root_cause: str
    investigation: str
    resolution: str
    outcome: str
    lesson: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def accept_form_aliases(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        out = dict(data)
        if "root_cause" not in out and out.get("actual_root_cause"):
            out["root_cause"] = out["actual_root_cause"]
        if "investigation" not in out and out.get("investigation_done"):
            out["investigation"] = out["investigation_done"]
        if "lesson" not in out and out.get("lesson_learned") is not None:
            out["lesson"] = out["lesson_learned"]
        return out


class IncidentRecord(BaseModel):
    id: str
    title: str
    service: str
    severity: str
    symptoms: str
    metrics: Optional[str] = None
    logs: Optional[str] = None
    recent_change: Optional[str] = None
    status: str
    created_at: str
    analysis: Optional[dict[str, Any]] = None
    resolution: Optional[dict[str, Any]] = None
