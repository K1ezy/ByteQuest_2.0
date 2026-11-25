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
