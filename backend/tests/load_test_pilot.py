"""Load test with 30 real synthetic student sessions and a published challenge.

Set BYTEQUEST_STUDENT_TOKENS_FILE to a JSON array of 30 distinct access tokens,
BYTEQUEST_ACTIVITY_ID, and BYTEQUEST_SOURCE_FILE to a passing solution.
Never commit tokens or use real students for this test.
"""

import asyncio
import json
import os
import statistics
import time
import uuid
from pathlib import Path

import httpx

BASE = os.environ.get("BYTEQUEST_BASE_URL", "http://127.0.0.1:8000").rstrip("/")


async def student(client, token, activity_id, code, index):
    headers = {"Authorization": f"Bearer {token}"}
    dashboard = await client.get(f"{BASE}/api/v1/pilot/dashboard", headers=headers)
    dashboard.raise_for_status()
    draft = await client.put(f"{BASE}/api/v1/pilot/drafts/{activity_id}",
                             headers=headers, json={"source_code": code})
    draft.raise_for_status()
    started = time.monotonic()
    response = await client.post(f"{BASE}/api/v1/submission-jobs", headers={**headers,
        "Idempotency-Key": f"load-{uuid.uuid4()}"}, json={"activity_id": activity_id,
        "source_code": code, "dry_run_only": False})
    response.raise_for_status()
    job_id = response.json()["id"]
    while time.monotonic() - started < 90:
        status = await client.get(f"{BASE}/api/v1/submission-jobs/{job_id}", headers=headers)
        status.raise_for_status()
        job = status.json()
        if job["status"] in ("completed", "failed"):
            return {"student": index, "status": job["status"],
                    "seconds": round(time.monotonic() - started, 2), "error": job.get("error")}
        await asyncio.sleep(2)
    return {"student": index, "status": "pending", "seconds": 90, "error": None}


async def main():
    tokens_path = os.environ.get("BYTEQUEST_STUDENT_TOKENS_FILE")
    activity_id = os.environ.get("BYTEQUEST_ACTIVITY_ID")
    source_path = os.environ.get("BYTEQUEST_SOURCE_FILE")
    if not all((tokens_path, activity_id, source_path)):
        raise SystemExit("Set BYTEQUEST_STUDENT_TOKENS_FILE, BYTEQUEST_ACTIVITY_ID, and BYTEQUEST_SOURCE_FILE.")
    tokens = json.loads(Path(tokens_path).read_text(encoding="utf-8"))
    if not isinstance(tokens, list) or len(tokens) != 30 or len(set(tokens)) != 30:
        raise SystemExit("The token file must contain 30 distinct synthetic student tokens.")
    uuid.UUID(activity_id)
    code = Path(source_path).read_text(encoding="utf-8")
    async with httpx.AsyncClient(timeout=20) as client:
        results = await asyncio.gather(*(student(client, token, activity_id, code, i)
                                         for i, token in enumerate(tokens, 1)), return_exceptions=True)
    for item in results:
        print(item if not isinstance(item, Exception) else f"request failure: {type(item).__name__}: {item}")
    completed = [r for r in results if isinstance(r, dict) and r["status"] == "completed"]
    within_30 = sum(r["seconds"] <= 30 for r in completed)
    print(f"Completed: {len(completed)}/30; within 30s: {within_30}/30")
    if completed:
        print(f"Median grading wait: {statistics.median(r['seconds'] for r in completed):.2f}s")
    if len(completed) != 30 or within_30 < 27:
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
