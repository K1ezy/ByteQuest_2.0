from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.services.monitoring import overall_health, runner_status

NOW = datetime(2026, 11, 15, 9, 0, tzinfo=timezone.utc)


def job(status: str, minutes_ago: float) -> SimpleNamespace:
    at = NOW - timedelta(minutes=minutes_ago)
    return SimpleNamespace(status=status, created_at=at, updated_at=at)


def test_old_failures_do_not_hide_a_recovered_runner():
    jobs = [job("completed", 1), job("completed", 2), job("failed", 30), job("failed", 31)]

    result = runner_status(jobs, NOW)

    assert result["status"] == "healthy"
    assert "2 of the last 4" in result["detail"]


def test_a_job_stuck_in_the_queue_marks_the_queue_stale():
    jobs = [job("queued", 5), job("completed", 6)]

    assert runner_status(jobs, NOW)["status"] == "stale"


def test_a_failing_latest_job_is_a_current_failure():
    jobs = [job("failed", 1), job("completed", 2)]

    assert runner_status(jobs, NOW)["status"] == "failed"


def test_a_job_that_just_arrived_is_not_a_stall():
    jobs = [job("queued", 0.2), job("completed", 3)]

    assert runner_status(jobs, NOW)["status"] == "healthy"


def test_a_service_switched_off_on_purpose_does_not_degrade_overall_health():
    assert overall_health([{"status": "healthy"}, {"status": "off"}]) == "healthy"


def test_old_activity_reads_in_hours_and_days_not_hundreds_of_minutes():
    assert "Last job completed 11 h ago." in runner_status([job("completed", 660)], NOW)["detail"]
    assert "Last job completed 3 days ago." in runner_status([job("completed", 3 * 24 * 60 + 5)], NOW)["detail"]
    assert "Last job completed 45 min ago." in runner_status([job("completed", 45)], NOW)["detail"]
