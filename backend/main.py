"""IncidentIQ FastAPI app."""

from __future__ import annotations

import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(Path(__file__).resolve().parent / ".env")

from agent import analyze  # noqa: E402
from groq_client import GroqClient  # noqa: E402
from hindsight_client import HindsightClient, HindsightError  # noqa: E402
from models import IncidentInput, IncidentRecord, ResolveInput  # noqa: E402

STORE_PATH = Path(__file__).resolve().parent.parent / "data" / "incidents_store.json"

hs_client = HindsightClient()
groq_client = GroqClient()


def read_store() -> list:
    if not STORE_PATH.exists():
        STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
        STORE_PATH.write_text("[]", encoding="utf-8")
    return json.loads(STORE_PATH.read_text(encoding="utf-8"))


def write_store(data: list) -> None:
    STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STORE_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await hs_client.close()
    await groq_client.close()


app = FastAPI(
    title="IncidentIQ",
    description="AI incident response agent with Hindsight long-term memory.",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {
        "backend": True,
        "hindsight": await hs_client.health(),
        "groq_configured": groq_client.is_configured(),
        "bank_id": hs_client.bank_id,
    }


@app.post("/api/incidents/analyze")
async def analyze_incident(incident: IncidentInput):
    try:
        analysis_result = await analyze(incident, hs_client, groq_client)
    except HindsightError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    store = read_store()
    record = IncidentRecord(
        **incident.model_dump(),
        status="open",
        created_at=datetime.now(timezone.utc).isoformat(),
        analysis=analysis_result.model_dump(),
    )
    payload = record.model_dump()
    replaced = False
    for i, item in enumerate(store):
        if item.get("id") == incident.id:
            store[i] = payload
            replaced = True
            break
    if not replaced:
        store.append(payload)
    write_store(store)
    return analysis_result


@app.post("/api/incidents/{incident_id}/resolve")
async def resolve_incident(incident_id: str, resolve_input: ResolveInput):
    store = read_store()
    incident_dict = next((item for item in store if item.get("id") == incident_id), None)
    if not incident_dict:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")

    resolution = resolve_input.model_dump()
    to_retain = {
        **incident_dict,
        **resolution,
        "resolution": resolution.get("resolution"),
    }
    try:
        retain_result = await hs_client.retain_incident(to_retain)
    except HindsightError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    incident_dict["status"] = "resolved"
    incident_dict["resolution"] = resolution
    write_store(store)
    return {
        "status": "success",
        "incident": incident_dict,
        "hindsight": {
            "success": retain_result.get("success"),
            "bank_id": retain_result.get("bank_id"),
            "items_count": retain_result.get("items_count"),
        },
    }


@app.get("/api/incidents")
async def get_incidents():
    return read_store()


# ---------------------------------------------------------------------------
# Sample data for hackathon demo
# ---------------------------------------------------------------------------

_SAMPLE_INCIDENTS: list[dict] = [
    {
        "id": "SAMPLE-001",
        "title": "Postgres Replication Lag",
        "service": "Payments Database",
        "severity": "high",
        "symptoms": (
            "Replica lag has increased to 30 seconds. "
            "Read queries are becoming slower. "
            "Database replication alerts are firing."
        ),
        "metrics": "replication_lag_seconds = 30\nread_latency_ms = 850",
        "logs": "replica falling behind primary\nreplication apply process delayed",
        "recent_change": None,
        "status": "resolved",
        "created_at": "2026-09-28T08:15:00+00:00",
        "analysis": None,
        "resolution": {
            "root_cause": "Replica resource saturation caused replication apply delays.",
            "investigation": (
                "Checked replica CPU and replication process health. "
                "Compared WAL generation and apply lag."
            ),
            "resolution": "Restarted the replica and increased replication resources.",
            "outcome": "Replication lag returned to normal and read latency recovered.",
            "lesson": "Monitor replica resource saturation before replication lag becomes severe.",
        },
    },
    {
        "id": "SAMPLE-002",
        "title": "Read Replica Falling Behind",
        "service": "Payments Database",
        "severity": "high",
        "symptoms": (
            "The read replica is several seconds behind the primary. "
            "Read latency has increased significantly. "
            "Replication alerts are firing."
        ),
        "metrics": "replica_lag = 27 seconds\nread_latency = 790 ms",
        "logs": "replica apply process delayed\nreplica is falling behind primary",
        "recent_change": None,
        "status": "open",
        "created_at": "2026-09-29T10:30:00+00:00",
        "analysis": None,
        "resolution": None,
    },
    {
        "id": "SAMPLE-003",
        "title": "Redis Cache Latency Spike",
        "service": "Checkout Cache",
        "severity": "medium",
        "symptoms": (
            "Cache response times increased significantly and checkout requests "
            "are intermittently slower."
        ),
        "metrics": "cache_latency_ms = 420\ncache_hit_rate = 71%",
        "logs": "redis command latency increased\ncache hit rate dropped",
        "recent_change": None,
        "status": "resolved",
        "created_at": "2026-09-27T14:45:00+00:00",
        "analysis": None,
        "resolution": {
            "root_cause": "Redis memory pressure caused increased command latency.",
            "investigation": "Reviewed Redis memory usage and eviction policy metrics.",
            "resolution": "Increased Redis memory allocation and removed stale cache entries.",
            "outcome": "Cache latency dropped back to normal and checkout performance recovered.",
            "lesson": "Monitor Redis memory pressure and cache hit rate together.",
        },
    },
]


@app.post("/api/incidents/sample")
async def load_sample_data():
    """Idempotently insert demo incidents into the local store.

    Safe to call multiple times — existing entries with the same ID are
    skipped, so no duplicates are ever created.  Hindsight and Groq are NOT
    called here; the user must explicitly click Analyze on each incident to
    trigger the Remember → Recall → Reason pipeline.
    """
    store = read_store()
    existing_ids = {item.get("id") for item in store}
    added: list[str] = []
    skipped: list[str] = []

    for sample in _SAMPLE_INCIDENTS:
        if sample["id"] in existing_ids:
            skipped.append(sample["id"])
        else:
            store.append(sample)
            existing_ids.add(sample["id"])
            added.append(sample["id"])

    if added:
        write_store(store)

    return {
        "status": "ok",
        "added": added,
        "skipped": skipped,
        "message": (
            f"Added {len(added)} sample incident(s)."
            if added
            else "All sample incidents already present — nothing added."
        ),
    }


@app.get("/api/memory/search")
async def search_memory(q: str):
    if not q.strip():
        raise HTTPException(status_code=400, detail="Query parameter 'q' is required")
    try:
        return await hs_client.recall(q.strip(), limit=20)
    except HindsightError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)
