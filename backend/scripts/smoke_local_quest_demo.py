"""Exercise the local demo join and quiz flow without keeping test progress."""

from __future__ import annotations

import sys
import uuid
from pathlib import Path
from types import SimpleNamespace

from sqlalchemy.orm import Session
from starlette.requests import Request


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from seed_local_quest_demo import ACTIVITY_ID, GROUP_NAME  # noqa: E402
from app.api.quest_groups import JoinQuestGroup, join_quest_group, list_quest_groups  # noqa: E402
from app.api.quests_gamification import (  # noqa: E402
    QuizSubmissionRequest,
    get_student_progress,
    list_published_quests,
    submit_conceptual_quiz,
)
from app.api.pilot import dashboard  # noqa: E402
from app.api.submissions import CodeSubmissionRequest, run_code_submission  # noqa: E402
from app.core.database import SessionLocal, engine  # noqa: E402
from app.models.entities import (  # noqa: E402
    ActivityAttempt,
    LearningActivity,
    Profile,
    ProgrammingLang,
    QuestGroup,
    QuestGroupMember,
    TestCase,
    UserRole,
)


def smoke_demo_quest(
    *,
    activity_id: uuid.UUID,
    group_name: str,
    language: ProgrammingLang,
    answers: dict[str, str],
    challenge_id: uuid.UUID | None = None,
    source_code: str | None = None,
) -> None:
    connection = engine.connect()
    outer_transaction = connection.begin()
    db = Session(bind=connection, join_transaction_mode="create_savepoint")
    student_id = None
    group_id = None
    baseline_attempts = 0
    baseline_challenge_attempts = 0
    baseline_memberships = 0
    try:
        group = db.query(QuestGroup).filter(QuestGroup.name == group_name).one()
        group_id = group.id
        students = (
            db.query(Profile)
            .filter(Profile.role == UserRole.student, Profile.enrolled_language == language)
            .order_by(Profile.id)
            .all()
        )
        if not students:
            raise SystemExit(f"Create a local {language.value} student account before running the smoke check.")
        student = next(
            (
                item for item in students
                if not db.query(ActivityAttempt).filter(
                    ActivityAttempt.student_id == item.id,
                    ActivityAttempt.activity_id == activity_id,
                ).first()
            ),
            students[0],
        )
        student_id = student.id
        baseline_attempts = db.query(ActivityAttempt).filter(
            ActivityAttempt.student_id == student_id,
            ActivityAttempt.activity_id == activity_id,
        ).count()
        if challenge_id is not None:
            baseline_challenge_attempts = db.query(ActivityAttempt).filter(
                ActivityAttempt.student_id == student_id,
                ActivityAttempt.activity_id == challenge_id,
            ).count()
        baseline_memberships = db.query(QuestGroupMember).filter(
            QuestGroupMember.group_id == group_id,
            QuestGroupMember.profile_id == student_id,
        ).count()
        before_xp = student.xp_points
        prior_success = db.query(ActivityAttempt).filter(
            ActivityAttempt.student_id == student_id,
            ActivityAttempt.activity_id == activity_id,
            ActivityAttempt.is_successful.is_(True),
        ).first() is not None
        request = Request({
            "type": "http",
            "method": "POST",
            "path": "/api/v1/quest-groups/join",
            "headers": [],
            "client": ("127.0.0.1", 0),
            "app": SimpleNamespace(state=SimpleNamespace(ml_shadow_status="disabled")),
        })

        joined = join_quest_group(request, JoinQuestGroup(code=group.join_code), student, db)
        joined_again = join_quest_group(request, JoinQuestGroup(code=group.join_code), student, db)
        assert joined.id == group_id and joined_again.member_count == joined.member_count
        assert any(item.id == group_id for item in list_quest_groups(student, db))

        quiz = next(item for item in list_published_quests(student, db) if item.id == activity_id)
        assert quiz.quiz_questions is not None and len(quiz.quiz_questions) == 3
        assert all(not hasattr(question, "correct_answer") for question in quiz.quiz_questions)
        result = submit_conceptual_quiz(
            request,
            QuizSubmissionRequest(
                activity_id=activity_id,
                answers=answers,
                time_spent_seconds=45,
            ),
            student,
            db,
        )
        assert result.is_successful and result.score_percentage == 100
        assert result.xp_awarded == (0 if prior_success else 30)
        db.expire_all()
        assert next(item for item in list_published_quests(student, db) if item.id == activity_id).is_completed
        assert db.get(Profile, student_id).xp_points >= before_xp + result.xp_awarded

        if challenge_id is not None:
            if source_code is None:
                raise ValueError("A source solution is required for the challenge smoke check.")
            challenge = next(
                (item for item in list_published_quests(student, db) if item.id == challenge_id),
                None,
            )
            if challenge is None:
                raise SystemExit("The Python demo challenge is not published. Start Judge0 and rerun the Python seed.")
            assert challenge.activity_type.value == "challenge"
            challenge_record = db.get(LearningActivity, challenge_id)
            case_count = db.query(TestCase).filter(TestCase.activity_id == challenge_id).count()
            visible_count = db.query(TestCase).filter(
                TestCase.activity_id == challenge_id, TestCase.is_hidden.is_(False)
            ).count()
            assert case_count >= 3 and 0 < visible_count < case_count
            prior_challenge_success = db.query(ActivityAttempt).filter(
                ActivityAttempt.student_id == student_id,
                ActivityAttempt.activity_id == challenge_id,
                ActivityAttempt.is_successful.is_(True),
            ).first() is not None
            before_code_xp = db.get(Profile, student_id).xp_points
            dry_run = run_code_submission(
                request,
                CodeSubmissionRequest(activity_id=challenge_id, source_code=source_code, dry_run_only=True),
                student,
                db,
            )
            assert dry_run["mode"] == "dry_run"
            assert dry_run["evaluation"].is_successful
            assert dry_run["evaluation"].total_test_cases == visible_count
            assert db.query(ActivityAttempt).filter(
                ActivityAttempt.student_id == student_id,
                ActivityAttempt.activity_id == challenge_id,
            ).count() == baseline_challenge_attempts
            assert db.get(Profile, student_id).xp_points == before_code_xp

            submitted = run_code_submission(
                request,
                CodeSubmissionRequest(activity_id=challenge_id, source_code=source_code, time_spent_seconds=60),
                student,
                db,
            )
            assert submitted["mode"] == "official_submit"
            assert submitted["evaluation"]["is_successful"]
            assert submitted["evaluation"]["total_test_cases"] == case_count
            assert len(submitted["evaluation"]["test_results"]) == visible_count
            assert submitted["xp_awarded"] == (0 if prior_challenge_success else challenge_record.xp_reward)
            db.expire_all()
            assert next(item for item in list_published_quests(student, db) if item.id == challenge_id).is_completed
            progress = get_student_progress(limit=5, offset=0, current_user=student, db=db)
            assert progress.total_attempts >= baseline_attempts + baseline_challenge_attempts + 2
            home = dashboard(user=student, db=db)
            assert home["completed"] <= home["total"]
            assert home["completed"] >= 2
            assert home["xp"] == db.get(Profile, student_id).xp_points
    finally:
        db.close()
        outer_transaction.rollback()
        connection.close()

    check = SessionLocal()
    try:
        assert check.query(ActivityAttempt).filter(
            ActivityAttempt.student_id == student_id,
            ActivityAttempt.activity_id == activity_id,
        ).count() == baseline_attempts
        if challenge_id is not None:
            assert check.query(ActivityAttempt).filter(
                ActivityAttempt.student_id == student_id,
                ActivityAttempt.activity_id == challenge_id,
            ).count() == baseline_challenge_attempts
        assert check.query(QuestGroupMember).filter(
            QuestGroupMember.group_id == group_id,
            QuestGroupMember.profile_id == student_id,
        ).count() == baseline_memberships
    finally:
        check.close()
    print("Demo join, quiz, XP, and reloaded completion passed.")
    if challenge_id is not None:
        print("Challenge dry run, official grading, hidden-case privacy, and dashboard progress passed.")
    print("The smoke transaction rolled back; student membership and progress are unchanged.")


def main() -> None:
    smoke_demo_quest(
        activity_id=ACTIVITY_ID,
        group_name=GROUP_NAME,
        language=ProgrammingLang.cpp,
        answers={"cpp-output": "A", "cpp-variable": "B", "cpp-index": "A"},
    )


if __name__ == "__main__":
    main()
