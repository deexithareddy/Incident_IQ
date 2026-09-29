# DEMO.md — IncidentIQ 2-Minute Judge Demo

## Pre-flight (30 seconds)

Open 3 terminals:

```powershell
# Terminal 1: Backend
cd incidentiq\backend
.\.venv\Scripts\Activate.ps1
$env:GROQ_API_KEY = "gsk_..."   # set your key
python -m uvicorn main:app --host 127.0.0.1 --port 8000

# Terminal 2: Frontend
cd incidentiq\frontend
npm run dev

# Terminal 3: Browser
# Open http://localhost:5173
```

Verify Dashboard shows all three green: **Backend ✓  Hindsight ✓  Groq ✓**

---

## Act 1: First Incident — No Memory (30 seconds)

1. Click **New Incident** in sidebar
2. Click **"Load demo incident"** button (fills Postgres replication lag incident)
3. Click **"Analyze"** — wait 15-30s
4. **Key slide:** Analysis page shows:
   - **Yellow banner: "No relevant memories found"** — this is a first-time incident
   - AI provides generic diagnosis (3 likely causes with confidence bars)
   - Investigation steps
   - Memory influence says: *"No historical memories were available"*

**Tell judges:** *"Hindsight has no memory of this type of incident. The AI gives reasonable but generic guidance."*

---

## Act 2: Resolve & Learn (20 seconds)

5. Scroll to **"Resolve & Learn"** section
6. Fill in:
   - **Root cause:** "3x write throughput from batch import overwhelmed WAL sender"
   - **Investigation:** "Checked WAL sender stats, found 2.3GB pending. Replica I/O bound."
   - **Resolution:** "Throttled batch import to 500 rows/s, increased replica IOPS"
   - **Outcome:** "Resolved — lag dropped to <1s within 10 minutes"
   - **Lesson:** "Always load-test replication impact before deploying high-write features"
7. Click **"Save to Memory"**
8. **Green banner appears:** *"Stored in Hindsight — future incidents can now recall this"*

**Tell judges:** *"The resolution is now stored as a memory in Hindsight. The agent just learned."*

---

## Act 3: Similar Incident — Memory Recall (40 seconds)

9. Click **New Incident**
10. Enter a similar but different incident:
    - **ID:** INC-301
    - **Title:** Database replication delay causing stale reads
    - **Service:** postgres-cluster
    - **Severity:** high
    - **Symptoms:** Read replicas 30s behind, users seeing outdated data
    - **Logs:** `[WARNING] Replication lag on replica-2 exceeded 30s`
    - **Recent change:** New analytics ETL writes large batches every 5 min
11. Click **"Analyze"** — wait 15-30s
12. **Key slide:** Analysis page now shows:
    - **Blue banner: "N relevant memories recalled from Hindsight"** — MEMORY WORKS!
    - Listed memories show facts from the previous incident (TEST/INC-201)
    - AI diagnosis references the previous incident's resolution
    - Past incidents table shows the previous incident
    - Memory influence explains how historical evidence informed the diagnosis

**Tell judges:** *"The agent REMEMBERED the previous Postgres replication incident and used it to give a more targeted diagnosis. It recommended throttling batch writes and increasing replica IOPS — exactly what worked before."*

---

## Bonus: Memory Search (if time permits)

13. Click **Memory** in sidebar
14. Search for "replication lag" or "connection pool"
15. Shows recalled facts from Hindsight with scores and entities

---

## One-liner pitch

> **IncidentIQ remembers how you solved it last time.**
> It uses Hindsight for long-term memory and Groq for real-time reasoning.
> The more incidents you resolve, the smarter it gets.

## Architecture (if asked)

```
React → FastAPI → Hindsight (memory) + Groq (reasoning)
         ↕                ↕
   Analyze loop:    RECALL similar past incidents
                    REASON with LLM + evidence
                    RESOLVE and LEARN (store back)
```
