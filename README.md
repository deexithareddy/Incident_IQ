# IncidentIQ — AI Incident Response Agent

> **REMEMBER → RECALL → REASON → RESOLVE → LEARN**

IncidentIQ is an AI-powered incident response agent that remembers how past production incidents were solved and uses that memory to diagnose new ones faster.

## Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  React + Vite    │────>│  FastAPI Backend  │────>│  Hindsight       │
│  (port 5173)     │     │  (port 8000)      │     │  (port 8888)     │
│                  │     │                   │────>│  Long-term memory│
│  Dashboard       │     │  /api/analyze     │     └──────────────────┘
│  New Incident    │     │  /api/resolve     │
│  Analysis View   │     │  /api/incidents   │     ┌──────────────────┐
│  Memory Search   │     │  /api/memory      │────>│  Groq LLM        │
│  Incident History│     │  /api/health      │     │  (cloud API)     │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

**The Loop:**
1. **REMEMBER** — Resolved incidents are stored as structured memories in Hindsight
2. **RECALL** — When a new incident arrives, Hindsight recalls similar past incidents
3. **REASON** — Groq LLM analyzes the incident using recalled memories as evidence
4. **RESOLVE** — SRE fills in root cause, resolution, and lessons learned
5. **LEARN** — The resolution is stored back in Hindsight, enriching future recall

## Stack

| Component | Technology | Role |
|-----------|-----------|------|
| Frontend | React 19 + Vite 6 | SRE dashboard UI |
| Backend | FastAPI (Python) | API orchestration |
| Memory | Hindsight (Docker) | Long-term incident memory |
| Reasoning | Groq API | LLM-powered diagnosis |

No Redis, Kafka, auth, or extra databases.

## Setup

### Prerequisites
- Python 3.12+
- Node.js 18+
- Docker Desktop (for Hindsight)
- Groq API key ([console.groq.com](https://console.groq.com))

### 1. Hindsight (memory)

Hindsight should already be running in Docker:
```bash
docker ps  # Should show 'hindsight' container on ports 8888/9999
```

If not running:
```bash
docker run -d --name hindsight \
  -p 8888:8888 -p 9999:9999 \
  -v hindsight-data:/data \
  -e HINDSIGHT_API_LLM_PROVIDER=groq \
  -e HINDSIGHT_API_LLM_MODEL=openai/gpt-oss-20b \
  -e HINDSIGHT_API_LLM_GROQ_SERVICE_TIER=on_demand \
  -e HINDSIGHT_API_LLM_GROQ_API_KEY=$env:GROQ_API_KEY \
  hindsight/hindsight
```

Verify: http://127.0.0.1:8888/health → `{"status":"healthy"}`

### 2. Backend

```powershell
cd backend

# Create venv (if needed)
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install deps
pip install -r requirements.txt

# Set your Groq key (one of):
$env:GROQ_API_KEY = "gsk_your_real_key"
# OR add to backend/.env:  GROQ_API_KEY=gsk_your_real_key

# Start
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Verify: http://127.0.0.1:8000/api/health → `{"backend":true,"hindsight":true,"groq_configured":true}`

### 3. Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open: http://localhost:5173

### 4. Seed Data (optional)

Pre-load Hindsight with 18 realistic incidents for a richer demo:
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python seed_data.py --count 3  # Seed first 3 incidents
python seed_data.py             # Seed all 18 (takes ~2 min)
python seed_data.py --only INC-101  # Seed one specific incident
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Service health check |
| POST | `/api/incidents/analyze` | Analyze an incident (recall + reason) |
| POST | `/api/incidents/{id}/resolve` | Resolve and store to memory |
| GET | `/api/incidents` | List all incidents |
| GET | `/api/memory/search?q=` | Search Hindsight memory |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GROQ_API_KEY` | — | Groq API key (required, starts with `gsk_`) |
| `GROQ_MODEL` | `openai/gpt-oss-20b` | Groq model name |
| `GROQ_SERVICE_TIER` | `on_demand` | Groq service tier |
| `HINDSIGHT_BASE_URL` | `http://127.0.0.1:8888` | Hindsight API URL |
| `HINDSIGHT_BANK_ID` | `incidentiq-demo` | Hindsight memory bank |
| `VITE_API_URL` | `http://localhost:8000` | Backend URL (frontend) |

## Project Structure

```
incidentiq/
├── backend/
│   ├── main.py              # FastAPI app & endpoints
│   ├── agent.py             # Orchestration: recall → reason → respond
│   ├── hindsight_client.py  # Hindsight API client
│   ├── groq_client.py       # Groq LLM client
│   ├── prompts.py           # Prompt engineering
│   ├── models.py            # Pydantic data models
│   ├── seed_data.py         # Seed script for demo data
│   ├── requirements.txt
│   ├── .env                 # Local config (gitignored)
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Layout + routing
│   │   ├── App.css          # Dark SRE theme
│   │   ├── pages/           # Dashboard, NewIncident, Analysis, Memory, History
│   │   ├── components/      # StatusBadge, LoadingSpinner
│   │   └── services/api.js  # API client
│   ├── package.json
│   └── vite.config.js
├── data/
│   ├── seed_incidents.json  # 18 realistic seed incidents
│   └── incidents_store.json # Runtime incident store
└── README.md
```
