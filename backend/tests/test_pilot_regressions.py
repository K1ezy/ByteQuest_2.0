import secrets
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import anyio
import pytest
from fastapi import HTTPException

from test_learning_flow_integration import flow, _token, _challenge, _quiz, _published_activity, _graded_job, _started_quiz_exam
from test_faculty_admin import workspace, _token as faculty_token
from app.models.entities import (
    ActivityAttempt, ActivityKind, Badge, ChallengeHint, CourseMember, Exam, ExamAssignment, ExamAttempt, ExamItem, HintUse,
    LearningActivity, Profile, ProgrammingLang, Workshop, WorkshopActivity, WorkshopMember, SubmissionJob,
    TestCase as GradingCase,
)
from app.services.gamification.badges import evaluate_and_award_badges
from app.services.activity_publishing import apply_publish_rules
from app.api.faculty import activities as faculty_activities
from app.api import chat, pilot, workshops
from app.core.config import settings
from app.services import exam_worker, submission_worker
from app.services.judge0.client import Judge0UnavailableError, judge0_client


pytestmark = pytest.mark.integration


@pytest.mark.parametrize("release_first", [False, True])
def test_completion_xp_is_awarded_once_across_practice_and_exam_release(flow, release_first):
    client, sessions, users = flow
    student = _token(users["student"])
    instructor = _token(users["instructor"])
    now = datetime.now(timezone.utc)
    with sessions() as db:
        challenge_id = _challenge(db, users["instructor"], reference="PRINT_INPUT")
        quiz_id = _quiz(db, users["instructor"])
        for activity_id in (challenge_id, quiz_id):
            _published_activity(db, activity_id)
        exam = Exam(title="Completion reward ordering", created_by=users["instructor"],
                    opens_at=now-timedelta(hours=2), closes_at=now-timedelta(hours=1),
                    published_at=now-timedelta(hours=3), duration_minutes=30)
        db.add(exam)
        db.flush()
        attempt = ExamAttempt(exam_id=exam.id, student_id=users["student"], attempt_number=1,
                              status="submitted", started_at=exam.opens_at, due_at=exam.closes_at,
                              submitted_at=exam.closes_at, result_json={"pending_xp": 65, "xp_released": False})
        db.add(attempt)
        db.flush()
        exam_id, attempt_id = exam.id, attempt.id
        for position, (activity_id, xp) in enumerate(((challenge_id, 40), (quiz_id, 25)), 1):
            item = ExamItem(exam_id=exam.id, activity_id=activity_id, position=position,
                            points=10, snapshot_json={"xp_reward": xp})
            db.add(item)
            db.flush()
            db.add(ActivityAttempt(student_id=users["student"], activity_id=activity_id, attempt_number=1,
                                  exam_attempt_id=attempt.id, exam_item_id=item.id, score_percentage=100,
                                  is_successful=True, xp_awarded=0))
        db.commit()

    release = f"/api/v1/exams/instructor/{exam_id}/release"
    if release_first:
        assert client.post(release, headers=instructor).status_code == 200
    coding = _graded_job(client, student, challenge_id, "PRINT_INPUT")
    quiz = client.post("/api/v1/quests/submit-quiz", headers=student,
                       json={"activity_id": str(quiz_id), "answers": {"q1": "A", "q2": "A", "q3": "A"}})
    assert quiz.status_code == 200, quiz.text
    expected_practice = (0, 0) if release_first else (40, 25)
    assert (coding["xp_awarded"], quiz.json()["xp_awarded"]) == expected_practice
    published = client.post(release, headers=instructor)
    assert published.status_code == 200, published.text
    with sessions() as db:
        result = db.get(ExamAttempt, attempt_id).result_json
        assert result["activity_xp_awards"] == ({str(challenge_id): 40, str(quiz_id): 25} if release_first else {})
        assert sum(expected_practice) + result["pending_xp"] == 65
        xp_after_release = db.get(Profile, users["student"]).xp_points
    assert client.post(release, headers=instructor).json() == published.json()
    with sessions() as db:
        assert db.get(Profile, users["student"]).xp_points == xp_after_release


@pytest.mark.parametrize("dry_run_only", [False, True])
@pytest.mark.parametrize("late_failure", [False, True])
def test_expired_submission_cannot_replace_a_new_claim_result(flow, monkeypatch, dry_run_only, late_failure):
    client, sessions, users = flow
    student = _token(users["student"])
    with sessions() as db:
        activity_id = _challenge(db, users["instructor"], reference="PRINT_INPUT")
        _published_activity(db, activity_id)
    job = client.post("/api/v1/submission-jobs", headers={**student, "Idempotency-Key": "reclaimed-job"},
                      json={"activity_id": str(activity_id), "source_code": "PRINT_INPUT", "dry_run_only": dry_run_only})
    assert job.status_code == 202, job.text
    job_id = job.json()["id"]
    old_claim = submission_worker.claim(job_id)
    assert old_claim is not None
    evaluate = judge0_client.evaluate_submission
    calls = 0

    def replace_claim():
        with sessions() as db:
            db.get(SubmissionJob, old_claim.job_id).updated_at = (
                datetime.now(timezone.utc) - timedelta(seconds=settings.SUBMISSION_STALE_TIMEOUT_SECONDS + 1)
            )
            db.commit()
        replacement = submission_worker.claim(job_id)
        assert replacement is not None and replacement.token != old_claim.token
        submission_worker.run_one(replacement)

    async def judge(*args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 1:
            await anyio.to_thread.run_sync(replace_claim)
            if late_failure:
                raise Judge0UnavailableError("expired claim failure")
            kwargs["source_code"] = "FAIL"
        return await evaluate(*args, **kwargs)

    monkeypatch.setattr(judge0_client, "evaluate_submission", judge)
    anyio.run(anyio.to_thread.run_sync, submission_worker.run_one, old_claim)
    final = client.get(f"/api/v1/submission-jobs/{job_id}", headers=student).json()
    assert calls == 2 and final["status"] == "completed" and final["error"] is None
    assert final["result"]["evaluation"]["is_successful"] is True
    with sessions() as db:
        recorded = db.query(ActivityAttempt).filter(ActivityAttempt.submission_job_id == old_claim.job_id).all()
        assert [item.xp_awarded for item in recorded] == ([] if dry_run_only else [40])


def test_instructor_can_retry_exhausted_exam_grading_without_losing_answers(flow, monkeypatch):
    client, sessions, users = flow
    student, instructor = _token(users["student"]), _token(users["instructor"])
    monkeypatch.setattr(exam_worker, "SessionLocal", sessions)
    attempt_id, item_id = _started_quiz_exam(client, sessions, users)
    answer_path = f"/api/v1/exams/attempts/{attempt_id}"
    answers = {item_id: {"q1": "A", "q2": "A", "q3": "A"}}
    assert client.put(f"{answer_path}/answers", headers=student, json={"expected_revision": 0, "answers": answers}).status_code == 200
    assert client.post(f"{answer_path}/submit", headers=student).status_code == 200
    attempt_id = uuid.UUID(attempt_id)
    with sessions() as db:
        attempt = db.get(ExamAttempt, attempt_id)
        exam_id = attempt.exam_id
        db.get(Exam, exam_id).closes_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        attempt.grading_attempts = exam_worker.MAX_GRADING_ATTEMPTS - 1
        db.commit()

    def unavailable(*args):
        raise Judge0UnavailableError("synthetic failure")

    original = exam_worker._grade_item
    monkeypatch.setattr(exam_worker, "_grade_item", unavailable)
    lease = exam_worker.claim_exam(attempt_id)
    assert lease is not None
    exam_worker.grade_exam(lease)
    held = client.get(answer_path, headers=student).json()
    assert held["status"] == "failed" and held["result"] is None and held["answers"] == answers
    assert exam_worker.claim_exam(attempt_id) is None
    release = f"/api/v1/exams/instructor/{exam_id}/release"
    assert client.post(release, headers=instructor).status_code == 409
    retry = client.post(f"/api/v1/exams/instructor/{exam_id}/attempts/{attempt_id}/retry-grading", headers=instructor)
    assert retry.status_code == 202, retry.text

    monkeypatch.setattr(exam_worker, "_grade_item", original)
    resumed = exam_worker.claim_exam(attempt_id)
    assert resumed is not None and resumed.token != lease.token
    exam_worker.grade_exam(resumed)
    exam_worker.grade_exam(lease)
    assert client.post(release, headers=instructor).status_code == 200
    assert client.get(answer_path, headers=student).json()["result"]["score"] == 10
    with sessions() as db:
        assert db.query(ActivityAttempt).filter(ActivityAttempt.exam_attempt_id == attempt_id).count() == 1


def test_expired_hint_recovers_allowance_and_same_key_delivers_once(flow, monkeypatch):
    client, sessions, users = flow
    student = _token(users["student"])
    with sessions() as db:
        activity_id = _challenge(db, users["instructor"], reference="PRINT_INPUT")
        _published_activity(db, activity_id)
        db.add(HintUse(student_id=users["student"], activity_id=activity_id, source="ai",
                       request_key="pending-hint", body=pilot.HINT_PENDING_BODY,
                       created_at=datetime.now(timezone.utc)-timedelta(days=1)))
        db.commit()
    _graded_job(client, student, activity_id, "FAIL", dry_run=True)
    monkeypatch.setattr(pilot, "reserve", lambda *args: None)
    monkeypatch.setattr(pilot, "explain_code_error", lambda **kwargs: SimpleNamespace(hints=["Trace the visible sample."]))
    hints = f"/api/v1/pilot/activities/{activity_id}/hints"
    assert client.get(hints, headers=student).json()["remaining"] == 5
    body = {"source": "ai", "request_key": "pending-hint"}
    delivered = client.post(f"{hints}/reveal", headers=student, json=body)
    assert delivered.status_code == 200, delivered.text
    assert delivered.json() == {"body": "Trace the visible sample.", "remaining": 4}
    assert client.post(f"{hints}/reveal", headers=student, json=body).json() == delivered.json()
    assert len(client.get(hints, headers=student).json()["ai_hints"]) == 1


def test_performance_uses_complete_practice_history_and_excludes_exam_attempts(workspace):
    client, sessions, ids = workspace
    instructor = faculty_token(ids["faculty"])
    now = datetime.now(timezone.utc)
    with sessions() as db:
        practice_id = ids["published"]
        exam_activity_id = _quiz(db, ids["faculty"])
        db.get(LearningActivity, exam_activity_id).course_id = ids["course_a"]
        _published_activity(db, exam_activity_id)
        db.add_all([
            ActivityAttempt(student_id=ids["student"], activity_id=practice_id, attempt_number=i,
                            score_percentage=0, is_successful=False, xp_awarded=0, created_at=now+timedelta(seconds=i))
            for i in range(2, 52)
        ])
        exam = Exam(title="Reporting fixture", created_by=ids["faculty"], opens_at=now-timedelta(hours=3),
                    closes_at=now-timedelta(hours=2), published_at=now-timedelta(hours=4), duration_minutes=30)
        db.add(exam)
        db.flush()
        held = ExamAttempt(exam_id=exam.id, student_id=ids["student"], attempt_number=1, status="submitted",
                           started_at=exam.opens_at, due_at=exam.closes_at, submitted_at=exam.closes_at)
        db.add(held)
        db.flush()
        db.add(ActivityAttempt(student_id=ids["student"], activity_id=exam_activity_id, attempt_number=1,
                               exam_attempt_id=held.id, score_percentage=100, is_successful=True, xp_awarded=0))
        db.commit()

    root = "/api/v1/faculty/performance"
    scope = {"course_id": str(ids["course_a"])}
    overview = client.get(root, params=scope, headers=instructor).json()
    focused = client.get(root, params=scope | {"activity_id": str(exam_activity_id)}, headers=instructor).json()
    detail = client.get(f"{root}/students/{ids['student']}", params=scope, headers=instructor).json()
    assert overview["students"][0]["attempt_count"] == 51
    assert overview["students"][0]["completed_count"] == 1
    assert focused["students"][0]["attempt_count"] == 0
    assert detail["progress"]["completed"] == 1
    assert len(detail["attempts"]) == 50 and all(not attempt["is_successful"] for attempt in detail["attempts"])


def test_chat_returns_only_citations_used_in_the_reply(workspace, monkeypatch):
    client, _, ids = workspace
    monkeypatch.setattr(chat, "reserve", lambda *args: None)
    passages = [{"document_title": "Loops Reader.pdf", "page_number": 3, "excerpt": "A loop repeats."}]
    monkeypatch.setattr(chat, "tutoring_passages", lambda *args, **kwargs: passages)
    replies = iter(["General guidance: use descriptive names ([2] Unknown Reader, page 9).",
                    "Loops repeat instructions (Loops Reader.pdf, p. 3).",
                    "Loops repeat instructions ([1] Loops Reader.pdf, page 3)."])
    monkeypatch.setattr(chat, "_generate_chat_reply", lambda *args: next(replies))
    cited_reply = {"reply": "Loops repeat instructions (Loops Reader.pdf, p. 3).",
                   "sources": [{"document_title": "Loops Reader.pdf", "page_number": 3}]}
    for expected in ({"reply": "General guidance: use descriptive names.", "sources": []}, cited_reply, cited_reply):
        response = client.post("/api/v1/chat/messages", headers=faculty_token(ids["student"]),
                               json={"messages": [{"role": "user", "content": "Explain loops from the lesson."}]})
        assert response.status_code == 200, response.text
        assert response.json() == expected


def test_studio_and_faculty_follow_active_course_assignments(workspace):
    client, sessions, ids = workspace
    author = faculty_token(ids["faculty"])
    assigned = faculty_token(ids["other_faculty"])
    studio = f"/api/v1/instructor/activities/{ids['draft']}"
    faculty = f"/api/v1/faculty/drafts/{ids['draft']}"
    with sessions() as db:
        db.add(CourseMember(course_id=ids["course_a"], profile_id=ids["other_faculty"],
                            member_role="instructor", status="active"))
        db.query(CourseMember).filter_by(course_id=ids["course_a"], profile_id=ids["faculty"]).one().status = "removed"
        db.commit()
    assert client.get(studio, headers=author).status_code == 404
    assert client.get(faculty, headers=author).status_code == 403
    assert client.get(studio, headers=assigned).status_code == 200
    assert client.get(faculty, headers=assigned).status_code == 200
    removed_workspace = client.get("/api/v1/instructor/workspace", headers=author).json()
    assigned_workspace = client.get("/api/v1/instructor/workspace", headers=assigned).json()
    assert str(ids["draft"]) not in {row["activity_id"] for row in removed_workspace["activities"]}
    assert str(ids["document"]) in {row["document_id"] for row in assigned_workspace["documents"]}


def test_studio_and_review_queue_share_the_saved_revision(workspace):
    client, _, ids = workspace
    instructor = faculty_token(ids["faculty"])
    studio = f"/api/v1/instructor/activities/{ids['draft']}"
    faculty = f"/api/v1/faculty/drafts/{ids['draft']}"
    detail = client.get(studio, headers=instructor).json()
    fields = ("title", "topic_concept", "problem_statement", "difficulty_level", "xp_reward", "quiz_questions_json", "content_version")
    payload = {key: detail[key] for key in fields}
    updated = client.patch(f"{studio}/quiz", headers=instructor, json=payload | {"title": "Edited in Studio"})
    assert updated.status_code == 200, updated.text
    assert updated.json()["content_version"] == payload["content_version"] + 1
    for route, body in ((f"{studio}/quiz", payload), (faculty, {"title": "Stale edit", "content_version": payload["content_version"]})):
        stale = client.patch(route, headers=instructor, json=body)
        assert stale.status_code == 409 and stale.json()["detail"]["code"] == "version_conflict"


def test_restricted_exam_keeps_items_out_of_practice_and_requires_course_enrollment(workspace):
    client, sessions, ids = workspace
    instructor, student, outsider = (faculty_token(ids[role]) for role in ("faculty", "student", "other_student"))
    now = datetime.now(timezone.utc)
    with sessions() as db:
        activity = db.get(LearningActivity, ids["draft"])
        activity.exam_only = True
        group = Workshop(name="Restricted exam group", language=ProgrammingLang.python,
                           join_code="".join(secrets.choice(workshops.CODE_ALPHABET) for _ in range(8)),
                           created_by=ids["faculty"])
        db.add(group)
        db.flush()
        group_id = group.id
        for student_id in (ids["student"], ids["other_student"]):
            db.add(WorkshopMember(workshop_id=group_id, profile_id=student_id))
        db.commit()

    approval = client.post(f"/api/v1/faculty/drafts/{ids['draft']}/approve", headers=instructor,
                           json={"confirm": True, "student_preview_confirmed": True})
    assert approval.status_code == 409 and approval.json()["detail"]["code"] == "exam_only"
    practice = client.get("/api/v1/quests", headers=student).json()
    assert str(ids["draft"]) not in {item["id"] for item in practice}
    payload = {"title": "Restricted assessment", "opens_at": (now+timedelta(minutes=1)).isoformat(),
               "closes_at": (now+timedelta(hours=1)).isoformat(), "duration_minutes": 30,
               "workshop_ids": [str(group_id)], "items": [{"activity_id": str(ids["draft"]), "points": 10}]}
    assert client.post("/api/v1/exams/instructor", headers=instructor, json=payload).status_code == 422
    created = client.post("/api/v1/exams/instructor", headers=instructor, json=payload | {"content_mode": "restricted"})
    assert created.status_code == 201, created.text
    exam_id = created.json()["id"]
    assert client.post(f"/api/v1/exams/instructor/{exam_id}/publish", headers=instructor).status_code == 200
    assert client.post(f"/api/v1/exams/{exam_id}/start", headers=student).status_code == 409
    assert client.get(f"/api/v1/exams/{exam_id}", headers=outsider).status_code == 404
    with sessions() as db:
        db.get(Exam, uuid.UUID(exam_id)).opens_at = now-timedelta(seconds=1)
        db.commit()
    assert client.post(f"/api/v1/exams/{exam_id}/start", headers=outsider).status_code == 404
    opened = client.post(f"/api/v1/exams/{exam_id}/start", headers=student)
    assert opened.status_code == 200, opened.text
    path = f"/api/v1/exams/attempts/{opened.json()['attempt_id']}"
    exam = client.get(path, headers=student)
    assert len(exam.json()["items"]) == 1 and "correct_answer" not in exam.text
    assert client.post(f"{path}/submit", headers=student).status_code == 200
    assert client.get(path, headers=student).json()["items"] == []
    with sessions() as db:
        db.query(CourseMember).filter_by(course_id=ids["course_a"], profile_id=ids["student"]).one().status = "removed"
        db.commit()
    assert client.get(path, headers=student).status_code == 404


def test_workshop_sharing_checks_instructor_course_membership(workspace, monkeypatch):
    client, sessions, ids = workspace
    monkeypatch.setattr(workshops, "reserve", lambda *args, **kwargs: None)
    title = {"name": "Pilot classroom", "language": "python"}
    activities = {"activity_ids": [str(ids["published"])]}
    unrelated = faculty_token(ids["other_faculty"])
    assert client.post("/api/v1/workshops", headers=unrelated, json=title | activities).status_code == 422
    created = client.post("/api/v1/workshops", headers=unrelated, json=title)
    assert created.status_code == 201
    group_id = created.json()["id"]
    assert client.post(f"/api/v1/workshops/{group_id}/activities", headers=unrelated, json=activities).status_code == 422
    authorized = client.post("/api/v1/workshops", headers=faculty_token(ids["faculty"]), json=title | activities)
    assert authorized.status_code == 201
    assert authorized.json()["activity_ids"] == activities["activity_ids"]

    # Exercise the read-side policy for assignments saved by an older release.
    with sessions() as db:
        db.add(WorkshopActivity(workshop_id=uuid.UUID(group_id), activity_id=ids["published"]))
        db.add(WorkshopMember(workshop_id=uuid.UUID(group_id), profile_id=ids["other_student"]))
        db.commit()
    headers = faculty_token(ids["other_student"])
    listed = client.get("/api/v1/workshops", headers=headers).json()
    assert next(group for group in listed if group["id"] == group_id)["activity_ids"] == []
    assert all(quest["id"] != str(ids["published"]) for quest in client.get("/api/v1/quests", headers=headers).json())


def test_verification_rejects_stale_content(workspace, monkeypatch):
    client, sessions, ids = workspace
    with sessions() as db:
        target = db.get(LearningActivity, ids["draft"])
        target.activity_type = ActivityKind.challenge
        target.quiz_questions_json = None
        target.reference_solution_code = "print(3)"
        db.add(GradingCase(activity_id=target.id, order_index=0, stdin="", expected_stdout="3", is_hidden=False))
        db.commit()
    async def verification(**kwargs):
        # Simulate an edit committed while the external Judge0 request is in flight.
        with sessions() as db:
            target = db.get(LearningActivity, ids["draft"])
            target.reference_solution_code = "BROKEN NEW CONTENT"
            target.judge0_verified = False
            target.content_version += 1
            db.commit()
        return True, {"verified": True}
    monkeypatch.setattr(faculty_activities, "_verify_snapshot", verification)
    response = client.post(f"/api/v1/faculty/activities/{ids['draft']}/verify", headers=faculty_token(ids["faculty"]))
    assert response.status_code == 409, response.text
    with sessions() as db:
        target = db.get(LearningActivity, ids["draft"])
        assert target.reference_solution_code == "BROKEN NEW CONTENT"
        assert target.judge0_verified is False


@pytest.mark.parametrize("edit", ["reference", "test_case", "stale_proof", "legacy_result"])
def test_review_queue_requires_judge0_verification_for_saved_content(workspace, monkeypatch, edit):
    client, sessions, ids = workspace
    activity_id = ids["draft"]
    instructor = faculty_token(ids["faculty"])
    draft = f"/api/v1/faculty/drafts/{activity_id}"
    verify = f"/api/v1/faculty/activities/{activity_id}/verify"
    confirmations = {"confirm": True, "student_preview_confirmed": True}
    case = {"order_index": 0, "expected_stdout": "3"}
    with sessions() as db:
        target = db.get(LearningActivity, activity_id)
        target.activity_type = ActivityKind.challenge
        target.quiz_questions_json = None
        target.reference_solution_code = "print(3)"
        db.add(GradingCase(activity_id=activity_id, **case))
        db.commit()

    snapshots = []

    async def verification(*, reference_solution_code, test_cases, **kwargs):
        expected = test_cases[0].expected_stdout
        snapshots.append((reference_solution_code, expected))
        verified = reference_solution_code == f"print({expected})"
        return verified, {"verified": verified}

    monkeypatch.setattr(faculty_activities, "_verify_snapshot", verification)
    checked = client.post(verify, headers=instructor)
    assert checked.status_code == 200, checked.text
    assert checked.json()["activity"]["judge0_verified"] is True
    revision = checked.json()["activity"]["content_version"]

    # The Review Queue form resends the cases on every save, including title-only changes.
    retitled = client.patch(draft, headers=instructor, json={
        "content_version": revision, "title": "Print the expected number", "test_cases": [case],
    })
    assert retitled.status_code == 200, retitled.text
    assert retitled.json()["draft"]["judge0_verified"] is True
    revision = retitled.json()["draft"]["content_version"]

    if edit in {"reference", "test_case"}:
        changed = {"reference_solution_code": "print(4)"} if edit == "reference" else {
            "test_cases": [case | {"expected_stdout": "4"}],
        }
        patched = client.patch(draft, headers=instructor, json={"content_version": revision} | changed)
        assert patched.status_code == 200, patched.text
        assert patched.json()["draft"]["judge0_verified"] is False
        with sessions() as db:
            assert db.get(LearningActivity, activity_id).judge0_verification_log is None
    else:
        with sessions() as db:
            target = db.get(LearningActivity, activity_id)
            if edit == "stale_proof":
                target.test_cases[0].expected_stdout = "4"
            else:
                target.judge0_verification_log = {"verified": True}
            assert target.judge0_verified is True
            db.commit()
        assert client.get(draft, headers=instructor).json()["judge0_verified"] is False

    blocked = client.post(f"{draft}/approve", headers=instructor, json=confirmations)
    assert blocked.status_code == 400, blocked.text
    assert blocked.json()["detail"]["code"] == "not_verified"
    assert client.get(draft, headers=instructor).json()["review_status"] == "draft"

    if edit != "legacy_result":
        failed = client.post(verify, headers=instructor)
        assert failed.status_code == 200, failed.text
        assert failed.json()["activity"]["judge0_verified"] is False
        correction = {"test_cases": [case | {"expected_stdout": "4"}]} if edit == "reference" else {
            "reference_solution_code": "print(4)",
        }
        corrected = client.patch(draft, headers=instructor, json={
            "content_version": failed.json()["activity"]["content_version"],
        } | correction)
        assert corrected.status_code == 200, corrected.text

    rechecked = client.post(verify, headers=instructor)
    assert rechecked.status_code == 200, rechecked.text
    assert rechecked.json()["activity"]["judge0_verified"] is True
    expected = "3" if edit == "legacy_result" else "4"
    assert snapshots[0] == ("print(3)", "3")
    assert snapshots[-1] == (f"print({expected})", expected)
    published = client.post(f"{draft}/approve", headers=instructor, json=confirmations)
    assert published.status_code == 200, published.text
    assert published.json()["review_status"] == "published"


def test_challenge_requires_visible_sample_at_publication(flow):
    _, sessions, users = flow
    with sessions() as db:
        activity_id = _challenge(db, users["instructor"], reference="PRINT_INPUT")
        activity = db.get(LearningActivity, activity_id)
        for case in activity.test_cases:
            case.is_hidden = True
        activity.judge0_verified = True
        db.flush()
        with pytest.raises(HTTPException) as error:
            apply_publish_rules(db, activity, db.get(Profile, users["instructor"]))
        assert error.value.detail["code"] == "missing_sample"


def test_hidden_summary_counts_hidden_cases_without_disclosing_details(flow):
    client, sessions, users = flow
    with sessions() as db:
        activity_id = _challenge(db, users["instructor"], reference="PRINT_INPUT")
        _published_activity(db, activity_id)
    result = _graded_job(client, _token(users["student"]), activity_id, "PRINT_INPUT")
    evaluation = result["evaluation"]
    assert evaluation["total_test_cases"] == 3 and len(evaluation["test_results"]) == 2
    assert evaluation["hidden_summary"] == {"passed": 1, "total": 1}


def test_exam_pass_counts_toward_badges_only_after_release(flow):
    client, sessions, users = flow
    now = datetime.now(timezone.utc)
    with sessions() as db:
        activity_id = _challenge(db, users["instructor"])
        exam = Exam(title="Audit unreleased exam", created_by=users["instructor"], opens_at=now-timedelta(hours=1),
                    closes_at=now+timedelta(hours=1), duration_minutes=60, published_at=now-timedelta(hours=2))
        db.add(exam)
        db.flush()
        attempt = ExamAttempt(exam_id=exam.id, student_id=users["student"], attempt_number=1,
                              status="submitted", started_at=now-timedelta(minutes=10), due_at=now,
                              submitted_at=now, result_released_at=None, answers_json={})
        db.add(attempt)
        db.flush()
        db.add(ActivityAttempt(student_id=users["student"], activity_id=activity_id, attempt_number=1,
            exam_attempt_id=attempt.id, passed_test_cases=3, total_test_cases=3, score_percentage=100,
            is_successful=True, xp_awarded=0))
        db.add(Badge(code="AUDIT"+uuid.uuid4().hex.upper(), name="Audit unreleased pass badge", description="Audit", icon_url="",
                     xp_bonus=5, criteria_json={"metric": "successful_attempts", "threshold": 1}))
        db.flush()
        awarded = evaluate_and_award_badges(db, db.get(Profile, users["student"]))
        assert "Audit unreleased pass badge" not in awarded
        attempt.result_released_at = now
        db.flush()
        awarded = evaluate_and_award_badges(db, db.get(Profile, users["student"]))
        assert "Audit unreleased pass badge" in awarded


def test_dashboard_distinguishes_closed_unfinished_quests(flow):
    client, sessions, users = flow
    with sessions() as db:
        # The fixture rolls back these changes to pre-existing demo activities.
        db.query(LearningActivity).filter(LearningActivity.language == ProgrammingLang.java).update({
            LearningActivity.archived_at: datetime.now(timezone.utc),
        })
        activity_id = _challenge(db, users["instructor"], reference="PRINT_INPUT")
        _published_activity(db, activity_id)
        db.get(Profile, users["student"]).enrolled_language = ProgrammingLang.java
        activity = db.get(LearningActivity, activity_id)
        activity.language = ProgrammingLang.java
        activity.closes_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.commit()
    student = _token(users["student"])
    dashboard = client.get("/api/v1/pilot/dashboard", headers=student).json()
    assert dashboard["next_activity"] is None
    assert dashboard["recommendation"]["recommended_action"] == "no_open_activities"
    response = client.post("/api/v1/submission-jobs", headers={**student, "Idempotency-Key": str(uuid.uuid4())},
                           json={"activity_id": str(activity_id), "source_code": "PRINT_INPUT"})
    assert response.status_code == 409


def test_quest_detail_projection_keeps_track_order_and_visibility(flow):
    client, sessions, users = flow
    with sessions() as db:
        challenge_id = _challenge(db, users["instructor"], reference="PRINT_INPUT")
        quiz_id = _quiz(db, users["instructor"])
        for activity_id in (challenge_id, quiz_id):
            _published_activity(db, activity_id)
        db.commit()

    headers = _token(users["student"])
    full = client.get("/api/v1/quests", headers=headers).json()
    focused = client.get("/api/v1/quests", params={"details_for": str(quiz_id)}, headers=headers)
    assert focused.status_code == 200, focused.text
    assert [(item["id"], item["position"]) for item in focused.json()] == [(item["id"], item["position"]) for item in full]
    cards = {item["id"]: item for item in focused.json()}
    assert cards[str(challenge_id)]["starter_code"] is None and cards[str(challenge_id)]["problem_statement"] is None
    assert cards[str(quiz_id)]["quiz_questions"] == next(item["quiz_questions"] for item in full if item["id"] == str(quiz_id))
    foreign = client.get("/api/v1/quests", params={"details_for": str(quiz_id)}, headers=_token(users["other_track"]))
    assert foreign.status_code == 200 and str(quiz_id) not in {item["id"] for item in foreign.json()}


def test_disabled_gemini_keeps_reviewed_hints_available(flow, monkeypatch):
    client, sessions, users = flow
    monkeypatch.setattr(settings, "GEMINI_ENABLED", False)
    with sessions() as db:
        activity_id = _challenge(db, users["instructor"], reference="PRINT_INPUT")
        _published_activity(db, activity_id)
        hint_id = uuid.uuid4()
        db.add(ChallengeHint(id=hint_id, activity_id=activity_id, slot=1, body="Check the input first."))
        db.commit()

    path = f"/api/v1/pilot/activities/{activity_id}/hints/reveal"
    student = _token(users["student"])
    ai = client.post(path, headers=student, json={"source": "ai", "request_key": "disabled-ai-001"})
    assert ai.status_code == 503 and "disabled" in ai.json()["detail"]
    reviewed = client.post(path, headers=student, json={"source": "reviewed", "hint_id": str(hint_id),
                                                       "request_key": "reviewed-hint-001"})
    assert reviewed.status_code == 200 and reviewed.json() == {"body": "Check the input first.", "remaining": 4}
    response = client.post("/api/v1/chat/messages", headers=_token(users["instructor"]),
                           json={"messages": [{"role": "user", "content": "Explain loops."}]})
    assert response.status_code == 503 and "disabled" in response.json()["detail"]


def test_dashboard_skips_finished_exam_before_selecting_next_due_exam(flow):
    client, sessions, users = flow
    instructor, student = _token(users["instructor"]), _token(users["student"])
    group = client.post("/api/v1/workshops", headers=instructor,
                        json={"name": "Audit due exams", "language": "python", "activity_ids": []}).json()
    assert client.post("/api/v1/workshops/join", headers=student, json={"code": group["join_code"]}).status_code == 200
    now = datetime.now(timezone.utc)
    with sessions() as db:
        exams = [Exam(title=f"Audit exam {i}", created_by=users["instructor"], published_at=now-timedelta(hours=2),
                      opens_at=now-timedelta(hours=1), closes_at=now+timedelta(hours=i), duration_minutes=30) for i in [1,2]]
        db.add_all(exams)
        db.flush()
        db.add_all([ExamAssignment(exam_id=e.id, workshop_id=uuid.UUID(group["id"])) for e in exams])
        db.add(ExamAttempt(exam_id=exams[0].id, student_id=users["student"], attempt_number=1, status="submitted",
                           started_at=now-timedelta(minutes=40),due_at=now-timedelta(minutes=10),submitted_at=now,
                           answers_json={}))
        db.commit()
        pending_id=str(exams[1].id)
    assert client.get(f"/api/v1/exams/{pending_id}", headers=student).json()["can_start"] is True
    assert client.get("/api/v1/pilot/dashboard", headers=student).json()["due_exam"]["id"] == pending_id
