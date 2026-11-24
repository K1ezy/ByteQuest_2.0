import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.models.entities import (
    ActivityAttempt, Course, CourseMember, Exam, ExamAssignment, ExamAttempt, ExamItem,
    LearningActivity, ProgrammingLang, ReviewState, Workshop, WorkshopActivity, WorkshopMember,
)
from app.services.pass_mark import exam_passed
from test_learning_flow_integration import _challenge, _quiz, _token, flow

pytestmark = pytest.mark.integration


def test_exam_pass_mark_compares_recorded_points_without_rounding_the_percentage():
    assert exam_passed(0.29, 1, 29) is True
    assert exam_passed(74.99, 100, 75) is False
    assert exam_passed(100, 100, None) is None


def test_practice_preview_uses_first_attempt_and_labeled_course_fallback(flow):
    client, session, users = flow
    student, instructor = users["student"], users["instructor"]
    with session() as db:
        course = Course(code=uuid.uuid4().hex[:24], title="Performance previews")
        group = Workshop(name="Preview workshop", language=ProgrammingLang.python,
                         join_code=uuid.uuid4().hex[:8].upper(), created_by=instructor)
        db.add_all([course, group])
        db.flush()
        db.add_all([
            CourseMember(course_id=course.id, profile_id=instructor, member_role="instructor"),
            CourseMember(course_id=course.id, profile_id=student, member_role="student"),
            WorkshopMember(workshop_id=group.id, profile_id=student),
        ])
        target, first, second = [_challenge(db, instructor) for _ in range(3)]
        quiz, quiz_prior = [_quiz(db, instructor) for _ in range(2)]
        for activity_id in (target, first, second, quiz, quiz_prior):
            activity = db.get(LearningActivity, activity_id)
            activity.review_status = ReviewState.published
            activity.course_id = course.id
        for activity_id in (target, first, quiz, quiz_prior):
            db.add(WorkshopActivity(workshop_id=group.id, activity_id=activity_id))
        for activity_id, number, passed in ((first, 1, False), (first, 2, True), (second, 1, True),
                                             (target, 1, True), (quiz_prior, 1, True)):
            db.add(ActivityAttempt(activity_id=activity_id, student_id=student, attempt_number=number,
                                   is_successful=passed))
        db.commit()

    path = f"/api/v1/quests/{target}/performance-preview"
    response = client.get(path, headers=_token(student))
    assert response.status_code == 200, response.text
    assert response.json() == {"scope": "course", "total": 2, "pass_marked": 2, "passed": 1,
                               "average_percent": None, "pass_mark_percent": None}
    response = client.get(f"/api/v1/quests/{quiz}/performance-preview", headers=_token(student))
    assert response.status_code == 200, response.text
    assert (response.json()["scope"], response.json()["total"], response.json()["passed"]) == ("workshop", 1, 1)
    empty = client.get(f"/api/v1/quests/{quiz_prior}/performance-preview", headers=_token(student))
    assert empty.status_code == 200 and empty.json()["total"] == 0
    assert client.get(path, headers=_token(instructor)).status_code == 403
    assert client.get(path, headers=_token(users["other_track"])).status_code == 404


def test_exam_preview_counts_latest_released_score_and_excludes_unassigned_exams(flow):
    client, session, users = flow
    student, instructor = users["student"], users["instructor"]
    now = datetime.now(timezone.utc)
    with session() as db:
        groups = [Workshop(name=name, language=ProgrammingLang.python,
                           join_code=uuid.uuid4().hex[:8].upper(), created_by=instructor)
                  for name in ("Exam preview workshop", "Other exam workshop")]
        db.add_all(groups)
        db.flush()
        db.add_all(WorkshopMember(workshop_id=group.id, profile_id=student) for group in groups)
        exams = [Exam(title=title, created_by=instructor, pass_mark_percent=mark, duration_minutes=30,
                      opens_at=now - timedelta(hours=5), closes_at=now - timedelta(hours=4),
                      published_at=now - timedelta(days=1))
                 for title, mark in (("Selected", 75), ("Marked", 75), ("Legacy", None),
                                     ("Unassigned", 75), ("Other workshop", 75))]
        db.add_all(exams)
        db.flush()
        target, marked, legacy, unassigned, other_workshop = [exam.id for exam in exams]
        for exam_id in (target, marked, legacy):
            db.add(ExamAssignment(exam_id=exam_id, workshop_id=groups[0].id))
        for exam_id in (marked, other_workshop):
            db.add(ExamAssignment(exam_id=exam_id, workshop_id=groups[1].id))
        for exam_id, number, score, released in (
            (target, 1, 100, True), (marked, 1, 50, True), (marked, 2, 75, True),
            (marked, 3, 40, False), (legacy, 1, 85, True), (unassigned, 1, 20, True),
            (other_workshop, 1, 60, True),
        ):
            db.add(ExamAttempt(exam_id=exam_id, student_id=student, attempt_number=number, status="submitted",
                               started_at=now - timedelta(hours=3), due_at=now - timedelta(hours=2),
                               submitted_at=now - timedelta(hours=2), result_released_at=now if released else None,
                               score=score, max_score=100, result_json={"items": []}))
        db.commit()
    response = client.get(f"/api/v1/exams/{target}/performance-preview", headers=_token(student))
    assert response.status_code == 200, response.text
    assert response.json() == {"scope": "workshop", "total": 2, "pass_marked": 1, "passed": 1,
                               "average_percent": 80.0, "pass_mark_percent": 75}
    assert client.get(f"/api/v1/exams/{unassigned}/performance-preview", headers=_token(student)).status_code == 404
    assert client.get(f"/api/v1/exams/{target}/performance-preview", headers=_token(instructor)).status_code == 403

    with session() as db:
        task_id = _quiz(db, instructor)
        course = Course(code=uuid.uuid4().hex[:24], title="Course exam history")
        db.add(course)
        db.flush()
        db.get(LearningActivity, task_id).course_id = course.id
        db.add(CourseMember(course_id=course.id, profile_id=student, member_role="student"))
        for exam_id in (target, marked, legacy, unassigned, other_workshop):
            db.add(ExamItem(exam_id=exam_id, activity_id=task_id, position=1, points=100, snapshot_json={}))
        db.commit()
    response = client.get(f"/api/v1/exams/{target}/performance-preview", headers=_token(student))
    assert response.status_code == 200, response.text
    assert response.json() == {"scope": "course", "total": 3, "pass_marked": 2, "passed": 1,
                               "average_percent": 73.3, "pass_mark_percent": 75}


def test_legacy_draft_requires_mark_and_published_exams_cannot_be_reclassified(flow):
    client, session, users = flow
    instructor = _token(users["instructor"])
    now = datetime.now(timezone.utc)
    with session() as db:
        exam = Exam(title="Existing draft", created_by=users["instructor"], duration_minutes=30,
                    opens_at=now + timedelta(hours=1), closes_at=now + timedelta(hours=2))
        db.add(exam)
        db.flush()
        path = f"/api/v1/exams/instructor/{exam.id}"
        db.commit()
    assert client.post(f"{path}/publish", headers=instructor).status_code == 409
    for invalid in (None, 0, 101, 75.5, True):
        response = client.patch(f"{path}/pass-mark", headers=instructor, json={"pass_mark_percent": invalid})
        assert response.status_code == 422
    assert client.patch(f"{path}/pass-mark", headers=_token(users["other_instructor"]),
                        json={"pass_mark_percent": 75}).status_code == 404
    assert client.patch(f"{path}/pass-mark", headers=instructor, json={"pass_mark_percent": 75}).json() == {
        "pass_mark_percent": 75,
    }
    assert client.post(f"{path}/publish", headers=instructor).status_code == 200
    assert client.patch(f"{path}/pass-mark", headers=instructor, json={"pass_mark_percent": 80}).status_code == 409
