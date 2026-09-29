"""Seed Hindsight with synthetic incidents. Never run the full set unless asked.

Usage (from backend/, venv active):
  python seed_data.py --count 0
  python seed_data.py --only INC-101
  python seed_data.py --count 3
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

BASE_URL = (os.getenv("HINDSIGHT_URL") or os.getenv("HINDSIGHT_BASE_URL") or "http://127.0.0.1:8888").rstrip("/")
DEFAULT_BANK_ID = os.getenv("HINDSIGHT_BANK_ID", "incidentiq-demo")
DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "seed_incidents.json"


def format_incident(incident: dict) -> str:
    fields = [
        f"Incident ID: {incident.get('id', '')}",
        f"Title: {incident.get('title', '')}",
        f"Service: {incident.get('service', '')}",
        f"Severity: {incident.get('severity', '')}",
        f"Symptoms: {incident.get('symptoms', '')}",
        f"Metrics: {incident.get('metrics', '')}",
        f"Error Logs: {incident.get('logs', '')}",
        f"Recent Change: {incident.get('recent_change', '')}",
        f"Root Cause: {incident.get('root_cause', '')}",
        f"Investigation: {incident.get('investigation', '')}",
        f"Resolution: {incident.get('resolution', '')}",
        f"Outcome: {incident.get('outcome', '')}",
        f"Lesson Learned: {incident.get('lesson', '')}",
    ]
    return "\n".join(fields)


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed Hindsight with incidents")
    parser.add_argument("--only", type=str, help="Retain only this incident ID")
    parser.add_argument("--count", type=int, default=None, help="Retain the first N incidents")
    parser.add_argument("--bank", type=str, default=DEFAULT_BANK_ID, help="Hindsight bank ID")
    args = parser.parse_args()

    incidents = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    print(f"Loaded {len(incidents)} seed incidents from {DATA_PATH.name}")
    print(f"Target bank: {args.bank} @ {BASE_URL}")

    if args.only:
        incidents = [inc for inc in incidents if inc["id"] == args.only]
        if not incidents:
            print(f"No incident with id {args.only}")
            return 1
    elif args.count is not None:
        incidents = incidents[: max(0, args.count)]
        if args.count == 0:
            print("count=0, nothing to retain.")
            return 0

    client = httpx.Client(base_url=BASE_URL, timeout=120.0)
    try:
        created = client.put(f"/v1/default/banks/{args.bank}", json={"name": args.bank})
        print(f"ensure bank HTTP {created.status_code}")

        for i, inc in enumerate(incidents, 1):
            print(f"[{i}/{len(incidents)}] retaining {inc['id']}: {inc['title']}...")
            payload = {
                "items": [
                    {
                        "content": format_incident(inc),
                        "context": f"IncidentIQ production incident: {inc.get('service', 'unknown')} - {inc.get('title', 'Untitled')}",
                        "document_id": inc.get("id"),
                        "update_mode": "replace",
                    }
                ],
                "async": False,
            }
            backoff = 2.0
            ok = False
            for attempt in range(4):
                res = client.post(f"/v1/default/banks/{args.bank}/memories", json=payload)
                if res.status_code == 429 and attempt < 3:
                    print(f"  429 rate limited, sleep {backoff}s")
                    time.sleep(backoff)
                    backoff *= 2
                    continue
                if res.status_code >= 400:
                    print(f"  failed HTTP {res.status_code}: {res.text[:300]}")
                    if attempt < 3:
                        time.sleep(backoff)
                        backoff *= 2
                        continue
                    break
                body = res.json()
                print(f"  success={body.get('success')} items={body.get('items_count')} async={body.get('async')}")
                ok = True
                break
            if not ok:
                print(f"  giving up on {inc['id']}")
            if i < len(incidents):
                time.sleep(3.0)
    finally:
        client.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
