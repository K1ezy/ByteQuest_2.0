import asyncio
from threading import Event, Lock

import anyio

from app.services import submission_worker as worker


def test_two_exam_claims_leave_room_for_practice(monkeypatch):
    monkeypatch.setattr(worker.settings, "SUBMISSION_WORKER_CONCURRENCY", 3)
    monkeypatch.setattr(worker.settings, "EXAM_GRADING_CONCURRENCY", 2)
    monkeypatch.setattr(worker, "_write_heartbeat", lambda: None)
    monkeypatch.setattr(worker, "claim_exam", object)
    monkeypatch.setattr(worker, "claim", object)

    started = Event()
    released = Event()
    lock = Lock()
    jobs: list[str] = []

    def hold(kind: str):
        with lock:
            jobs.append(kind)
            if len(jobs) == 3:
                started.set()
        released.wait(5)

    monkeypatch.setattr(worker, "grade_exam", lambda _: hold("exam"))
    monkeypatch.setattr(worker, "run_one", lambda _: hold("practice"))

    async def run():
        async with anyio.create_task_group() as tasks:
            tasks.start_soon(worker.main)
            try:
                assert await anyio.to_thread.run_sync(started.wait, 4)
                assert sorted(jobs) == ["exam", "exam", "practice"]
            finally:
                tasks.cancel_scope.cancel()
                released.set()

    asyncio.run(run())
