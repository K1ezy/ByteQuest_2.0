r"""Give the local demo accounts four weeks of class history, in local Supabase only.

Run from the repository root, after seed_local_4cs_workshops.py:
    .\backend\.venv\Scripts\python.exe .\backend\scripts\seed_local_showcase_activity.py

What it adds, dated over the four weeks before the run:
- the 4CS students join the Python Programming Track course that instructor@gmail.com teaches
  (with the admin assignment audit trail) and their workshops get weekly activities and Board posts;
- practice attempts for learners with different paces, with XP, levels and badges awarded by the
  app's own rules: strong, steady, struggling, inactive for 7+ days and not started;
- kieser@gmail.com joins the instructor's CS102 workshop and keeps practising daily;
- a released quiz exam, created, taken, graded and released through the real exam code on a
  simulated clock. Its email notices are marked skipped so no mail is ever sent.

It adds no research consent, so model training and research exports never see these rows.
Idempotent and resumable: each step, attempt and exam stage skips what already exists.
"""

from __future__ import annotations

import random
import sys
import uuid
from datetime import datetime, time, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import urlsplit

from sqlalchemy import event, func, text
from sqlalchemy.engine import make_url
from starlette.requests import Request


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import settings  # noqa: E402


LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}
if (
    settings.ENVIRONMENT.lower() != "development"
    or make_url(settings.DATABASE_URL).host not in LOCAL_HOSTS
    or urlsplit(settings.SUPABASE_URL).hostname not in LOCAL_HOSTS
):
    raise SystemExit("Refusing to seed outside the local development Supabase.")

import app.api.exams as exams_api  # noqa: E402
from app.api.workshops import AddWorkshopActivities, add_workshop_activities  # noqa: E402
from app.core.database import SessionLocal  # noqa: E402
from app.models.entities import (  # noqa: E402
    ActivityAttempt, ActivityKind, Badge, Course, CourseAnnouncement, CourseMember, Exam, ExamAttempt, ExamItem,
    LearningActivity, Profile, ReviewState, StudentBadge, TestCase, Workshop, WorkshopActivity,
    WorkshopAnnouncement, WorkshopMember,
)
from app.services.audit import record_audit  # noqa: E402
from app.services.exam_worker import claim_exam, grade_exam  # noqa: E402
from app.services.gamification.badges import award_badges  # noqa: E402
from app.services.gamification.completion_rewards import completed_activity_ids  # noqa: E402
from app.services.gamification.progression import grant_xp  # noqa: E402
from app.services.gamification.quiz_content import parse_quiz_questions  # noqa: E402
from app.services.gamification.sequencer import QUIZ_MASTERY_SCORE  # noqa: E402
from app.services.pass_mark import PRACTICE_PASS_MARK, submission_passes  # noqa: E402


MANILA = timezone(timedelta(hours=8))
NOW = datetime.now(timezone.utc)
# Term week 1 starts 27 days before the first run, so the history ends that day. Later runs
# reuse the first run's dates (read back from the exam) instead of shifting the timeline.
TERM_START = datetime.now(MANILA).date() - timedelta(days=27)
COURSE_CODE = "PYTHON-TRACK"
BLOCK_WORKSHOPS = [f"Intermediate Programming - Python 4CS-{block}" for block in "ABC"]
KIESER_WORKSHOP = "CS102 Introduction to Programming"
# Course activity sequence_order -> term week. Sequence 22 is a closed two-hour lab; it is left out.
WEEK_OF_SEQUENCE = {1: 1, 2: 1, 3: 1, 4: 1, 5: 2, 6: 2, 7: 2, 8: 3, 24: 3, 23: 3, 9: 4}
WEEK_TOPICS = {1: "Week 1: Input, output and types", 2: "Week 2: Conditionals and strings",
               3: "Week 3: Loops", 4: "Week 4: Functions"}
EXAM_TITLE = "Midterm Quiz: Python Basics"
EXAM_SEQUENCES = [1, 3, 5, 7]  # quiz items only, so grading needs no Judge0
EXAM_DAY, RELEASE_DAY = 19, 20  # days after TERM_START, in week 3; posts name the real weekday

PERSONAS = {  # attempt chance, start delay (days), failed tries before a pass, chance of never passing, exam accuracy
    "strong": dict(attempt=1.0, delay=(0, 2), fails=[0, 0, 0, 0, 0, 0, 1, 1, 2], give_up=0.0, exam=(0.85, 1.0)),
    "steady": dict(attempt=0.9, delay=(0, 4), fails=[0, 0, 0, 1, 1, 1, 2, 2, 3], give_up=0.05, exam=(0.6, 0.9)),
    "struggling": dict(attempt=0.8, delay=(1, 5), fails=[1, 1, 2, 2, 3, 3, 4, 5], give_up=0.4, exam=(0.3, 0.65)),
    "inactive": dict(attempt=0.85, delay=(0, 3), fails=[0, 1, 1, 2, 3], give_up=0.2, exam=None, stop_day=16),
}


def at(day: int, hour: int, minute: int = 0) -> datetime:
    """A Manila wall-clock time `day` days after the term start, in UTC."""
    return datetime.combine(TERM_START + timedelta(days=day), time(hour, minute), MANILA).astimezone(timezone.utc)


def week_release(week: int) -> int:
    return 1 + 7 * (week - 1)


def weekday(day: int) -> str:
    return (TERM_START + timedelta(days=day)).strftime("%A")


def personas_for(count: int, rng: random.Random) -> list[str | None]:
    strong, struggling, inactive = round(count * 0.25), round(count * 0.2), max(1, round(count * 0.1))
    mix = ["strong"] * strong + ["struggling"] * struggling + ["inactive"] * inactive + [None]
    mix += ["steady"] * (count - len(mix))
    rng.shuffle(mix)
    return mix


# ---------------------------------------------------------------------------
# Practice attempts
# ---------------------------------------------------------------------------
def plan_practice(rng: random.Random, persona: str, activities: list[LearningActivity]) -> list[tuple]:
    cfg = PERSONAS[persona]
    plan = []
    for activity in activities:
        if rng.random() > cfg["attempt"]:
            continue
        day = week_release(WEEK_OF_SEQUENCE[activity.sequence_order]) + rng.randint(*cfg["delay"])
        if day > cfg.get("stop_day", 99):
            continue
        moment = at(day, rng.randint(8, 21), rng.randint(0, 59))
        if activity.opens_at and moment < activity.opens_at:
            moment = activity.opens_at + timedelta(minutes=rng.randint(30, 600))
        fails, passes = rng.choice(cfg["fails"]), rng.random() >= cfg["give_up"]
        for index in range(fails + passes):
            if moment >= NOW - timedelta(minutes=30) or (activity.closes_at and moment >= activity.closes_at):
                break
            plan.append((moment, activity, passes and index == fails))
            moment += timedelta(minutes=rng.randint(4, 45)) if rng.random() < 0.8 else timedelta(hours=rng.randint(20, 30))
    return sorted(plan, key=lambda item: item[0])


def record_attempt(db, student: Profile, activity: LearningActivity, moment: datetime, passes: bool,
                   rng: random.Random, tests: dict) -> None:
    number = (db.query(func.count(ActivityAttempt.id)).filter(
        ActivityAttempt.student_id == student.id, ActivityAttempt.activity_id == activity.id).scalar() or 0) + 1
    fields: dict = {"time_spent_seconds": rng.randint(60, 420)}
    if activity.activity_type == ActivityKind.quiz:
        questions = parse_quiz_questions(activity.quiz_questions_json)
        needed = next(k for k in range(len(questions) + 1) if k / len(questions) * 100 >= QUIZ_MASTERY_SCORE)
        correct = (len(questions) if rng.random() < 0.7 else needed) if passes else rng.randint(0, needed - 1)
        right = set(rng.sample(range(len(questions)), correct))
        answers = {q.id: q.correct_answer if i in right else
                   rng.choice([o.key for o in q.options if o.key.casefold() != q.correct_answer.casefold()])
                   for i, q in enumerate(questions)}
        score = round(correct / len(questions) * 100, 2)
        fields.update(quiz_answers_json=answers, passed_test_cases=correct, total_test_cases=len(questions),
                      score_percentage=score, is_successful=score >= QUIZ_MASTERY_SCORE)
    else:
        total = tests[activity.id]
        runtime = not passes and rng.random() < 0.35
        passed = total if passes else rng.randint(0, total - 1)
        score = round(passed / total * 100, 2)
        fields.update(
            submitted_code=activity.reference_solution_code if passes else (activity.starter_code or activity.reference_solution_code),
            passed_test_cases=passed, total_test_cases=total, score_percentage=score,
            is_successful=submission_passes(all_passed=passed == total, score_percentage=score,
                                            pass_mark_percent=activity.pass_mark_percent, default_mark=PRACTICE_PASS_MARK),
            execution_time_ms=round(rng.uniform(18, 140), 1), memory_used_kb=float(rng.randint(3200, 9800)),
            compiler_status_id=3 if passes else (11 if runtime else 4),
            error_category="none" if passes else ("runtime_error" if runtime else "logic_error"),
            time_spent_seconds=rng.randint(180, 1500),
        )
    # Same reward rules as the submission endpoints: XP on the first pass only, then badges.
    xp = (max(0, int(activity.xp_reward or 0))
          if fields["is_successful"] and not completed_activity_ids(db, student.id, {activity.id}) else 0)
    db.add(ActivityAttempt(student_id=student.id, activity_id=activity.id, attempt_number=number,
                           xp_awarded=xp, created_at=moment, **fields))
    grant_xp(student, xp)
    db.flush()
    names, _ = award_badges(db, student)
    if names:
        db.query(StudentBadge).filter(
            StudentBadge.student_id == student.id,
            StudentBadge.badge_id.in_(db.query(Badge.id).filter(Badge.name.in_(names))),
        ).update({StudentBadge.awarded_at: moment}, synchronize_session=False)


def insert_attempts(plans: dict, before: datetime | None, after: datetime | None, tests: dict) -> int:
    count = 0
    for student_id, (rng, plan) in plans.items():
        rows = [p for p in plan if (before is None or p[0] < before) and (after is None or p[0] >= after)]
        if not rows:
            continue
        with SessionLocal() as db:
            student = db.query(Profile).filter(Profile.id == student_id).with_for_update().one()
            for moment, activity_id, passes in rows:
                if db.query(ActivityAttempt.id).filter_by(student_id=student_id, activity_id=activity_id,
                                                          created_at=moment).first():
                    continue  # written by an earlier run
                record_attempt(db, student, db.get(LearningActivity, activity_id), moment, passes, rng, tests)
                count += 1
            db.commit()
    return count


# ---------------------------------------------------------------------------
# Exam, through the real API on a simulated clock
# ---------------------------------------------------------------------------
def take_and_grade_exam(clock: list, submitted_at: dict, instructor_id, workshop_ids, quiz_ids, takers) -> uuid.UUID:
    with SessionLocal() as db:
        instructor = db.get(Profile, instructor_id)
        exam_id = exams_api.create_exam(exams_api.DraftExam(
            title=EXAM_TITLE, opens_at=at(EXAM_DAY, 10), closes_at=at(EXAM_DAY, 11), duration_minutes=45,
            workshop_ids=workshop_ids, items=[exams_api.DraftItem(activity_id=a, points=25) for a in quiz_ids],
        ), instructor, db)["id"]
        exams_api.publish_exam(exam_id, instructor, db)
        db.query(Exam).filter(Exam.id == exam_id).update({Exam.created_at: clock[0]})
        db.commit()
        items = db.query(ExamItem).filter(ExamItem.exam_id == exam_id).all()
    attempt_ids = []
    for student_id, accuracy, rng in takers:
        with SessionLocal() as db:
            student = db.get(Profile, student_id)
            clock[0] = at(EXAM_DAY, 10, rng.randint(0, 8))
            attempt_id = exams_api.start_exam(exam_id, student, db)["attempt_id"]
            answers = {}
            for item in items:
                questions = parse_quiz_questions(item.snapshot_json["quiz_questions_json"])
                answers[str(item.id)] = {q.id: q.correct_answer if rng.random() < accuracy else
                                         rng.choice([o.key for o in q.options if o.key != q.correct_answer])
                                         for q in questions}
            clock[0] += timedelta(minutes=rng.randint(12, 38))
            exams_api.save_answers(attempt_id, exams_api.SaveAnswers(expected_revision=0, answers=answers), student, db)
            exams_api.submit_attempt(attempt_id, student, db)
            submitted_at[attempt_id] = clock[0]
            attempt_ids.append(attempt_id)
    for attempt_id in attempt_ids:
        claim = claim_exam(attempt_id)
        if claim is None:
            raise SystemExit(f"Exam attempt {attempt_id} could not be claimed for grading.")
        grade_exam(claim)
    return exam_id


def run_exam(instructor_id, workshop_ids, quiz_ids, takers: list[tuple[uuid.UUID, float, random.Random]],
             exam_id: uuid.UUID | None) -> int:
    """Create, take and grade the exam unless it exists, then release it unless already released."""
    clock = [at(EXAM_DAY - 4, 9)]
    real_utcnow, exams_api.utcnow = exams_api.utcnow, lambda: clock[0]
    started_real = datetime.now(timezone.utc)
    submitted_at: dict = {}

    # activity_attempts is append-only, so graded item rows get the submission time as they are written.
    def stamp(_mapper, _connection, row: ActivityAttempt) -> None:
        if row.exam_attempt_id in submitted_at:
            row.created_at = submitted_at[row.exam_attempt_id]

    event.listen(ActivityAttempt, "before_insert", stamp)
    try:
        if exam_id is None:
            exam_id = take_and_grade_exam(clock, submitted_at, instructor_id, workshop_ids, quiz_ids, takers)
        with SessionLocal() as db:
            if db.get(Exam, exam_id).results_released_at is not None:
                return 0
            unfinished = db.query(ExamAttempt).filter(ExamAttempt.exam_id == exam_id, ExamAttempt.status != "submitted").count()
            if unfinished:
                raise SystemExit(f"{unfinished} exam attempts did not finish grading; results were not released.")
            clock[0] = at(RELEASE_DAY, 9)
            request = Request({"type": "http", "method": "POST", "path": "/", "headers": [], "client": ("127.0.0.1", 0),
                               "app": SimpleNamespace(state=SimpleNamespace())})  # no ML state: forecasts stay off
            exams_api.release_exam(exam_id, request, db.get(Profile, instructor_id), db)
            db.query(StudentBadge).filter(StudentBadge.awarded_at >= started_real).update(
                {StudentBadge.awarded_at: clock[0]}, synchronize_session=False)
            # Reminder and release notices are history now; never let the email worker send them.
            db.execute(text("update public.notification_outbox set status = 'skipped_disabled' "
                            "where status = 'pending' and dedupe_key like :key"), {"key": f"exam-%:{exam_id}:%"})
            db.commit()
            return db.query(ExamAttempt).filter(ExamAttempt.exam_id == exam_id).count()
    finally:
        event.remove(ActivityAttempt, "before_insert", stamp)
        exams_api.utcnow = real_utcnow


# ---------------------------------------------------------------------------
# kieser@gmail.com: a learner who keeps going, continuing their own history
# ---------------------------------------------------------------------------
KIESER_PLAN = [  # (day, hour, minute, sequence, passes)
    (17, 19, 10, 7, True), (18, 20, 5, 4, False), (18, 20, 31, 4, True), (18, 21, 2, 8, False),
    (20, 18, 40, 8, True), (22, 19, 15, 23, False), (22, 19, 32, 23, True), (23, 20, 0, 9, False),
    (24, 18, 45, 9, True), (25, 19, 20, 3, True), (27, 9, 30, 24, True),
]


def main() -> None:
    global TERM_START
    with SessionLocal() as db:
        ids = dict(db.execute(text("select email, id from auth.users where email in "
                                   "('kieser@gmail.com', 'instructor@gmail.com', 'admin@gmail.com')")).all())
        if len(ids) != 3:
            raise SystemExit("kieser@gmail.com, instructor@gmail.com and admin@gmail.com must all exist locally.")
        exam = db.query(Exam).filter(Exam.title == EXAM_TITLE, Exam.created_by == ids["instructor@gmail.com"]).first()
        exam_id = exam.id if exam else None
        if exam is not None:
            TERM_START = exam.opens_at.astimezone(MANILA).date() - timedelta(days=EXAM_DAY)
        kieser_id, instructor_id, admin_id = ids["kieser@gmail.com"], ids["instructor@gmail.com"], ids["admin@gmail.com"]
        course = db.query(Course).filter(Course.code == COURSE_CODE).one()
        workshops = {w.name: w for w in db.query(Workshop).filter(
            Workshop.created_by == instructor_id, Workshop.name.in_(BLOCK_WORKSHOPS + [KIESER_WORKSHOP]))}
        if len(workshops) != 4:
            raise SystemExit("Run seed_local_4cs_workshops.py first; the 4CS and CS102 workshops are missing.")
        activities = db.query(LearningActivity).filter(
            LearningActivity.course_id == course.id, LearningActivity.review_status == ReviewState.published,
            LearningActivity.archived_at.is_(None), LearningActivity.sequence_order.in_(WEEK_OF_SEQUENCE),
        ).order_by(LearningActivity.sequence_order).all()
        by_sequence = {a.sequence_order: a for a in activities}
        if set(by_sequence) != set(WEEK_OF_SEQUENCE):
            raise SystemExit("The Python Programming Track activities differ from what this scenario expects.")
        tests = dict(db.query(TestCase.activity_id, func.count(TestCase.id)).group_by(TestCase.activity_id).all())
        admin, instructor = db.get(Profile, admin_id), db.get(Profile, instructor_id)

        # 1. Enrollment, joining dates and the admin's assignment trail.
        block_members = {}
        for name in BLOCK_WORKSHOPS:
            workshop = workshops[name]
            db.query(Workshop).filter(Workshop.id == workshop.id).update({Workshop.created_at: at(-2, 9)})
            members = db.query(Profile).join(WorkshopMember, WorkshopMember.profile_id == Profile.id).filter(
                WorkshopMember.workshop_id == workshop.id, Profile.role == "student").order_by(Profile.school_id).all()
            block_members[name] = [m.id for m in members]
            for index, student in enumerate(members):
                join_day = index % 2
                joined = at(join_day, 8 + index % 10, (index * 7) % 60)
                db.query(WorkshopMember).filter(WorkshopMember.workshop_id == workshop.id,
                                                WorkshopMember.profile_id == student.id).update({WorkshopMember.joined_at: joined})
                db.query(Profile).filter(Profile.id == student.id).update({Profile.created_at: at(-6 + join_day, 15, index)})
                if not db.query(CourseMember.id).filter_by(course_id=course.id, profile_id=student.id, member_role="student").first():
                    db.add(CourseMember(course_id=course.id, profile_id=student.id, member_role="student",
                                        status="active", assigned_by=admin.id, assigned_at=at(-1, 14, index)))
                    record_audit(db, actor=admin, action="assignment.created", entity_type="course_member",
                                 course_id=course.id, summary=f"Assigned {student.display_name} as student in {course.title}"
                                 ).created_at = at(-1, 14, index)
            db.query(WorkshopMember).filter(WorkshopMember.workshop_id == workshop.id,
                                            WorkshopMember.profile_id == instructor.id).update({WorkshopMember.joined_at: at(-2, 9)})
        cs102 = workshops[KIESER_WORKSHOP]
        if not db.query(WorkshopMember.id).filter_by(workshop_id=cs102.id, profile_id=kieser_id).first():
            db.add(WorkshopMember(workshop_id=cs102.id, profile_id=kieser_id, joined_at=at(0, 19, 12)))
        db.commit()

        # 2. Weekly activities in every workshop, and its Board.
        for workshop in workshops.values():
            present = {a for (a,) in db.query(WorkshopActivity.activity_id).filter_by(workshop_id=workshop.id)}
            for week, topic in WEEK_TOPICS.items():
                wanted = [a.id for a in activities if WEEK_OF_SEQUENCE[a.sequence_order] == week and a.id not in present]
                if wanted:
                    add_workshop_activities(workshop.id, AddWorkshopActivities(activity_ids=wanted, topic=topic), instructor, db)
                    db.query(WorkshopActivity).filter(WorkshopActivity.workshop_id == workshop.id,
                                                      WorkshopActivity.activity_id.in_(wanted)).update(
                        {WorkshopActivity.added_at: at(week_release(week) - 1, 17)}, synchronize_session=False)
            posts = [
                (0, 8, True, f"Welcome to {workshop.block or 'CS102'}! Practice activities open every {weekday(week_release(1))}. "
                             "Finish each week's quiz before its challenge, and ask in class if you get stuck."),
                (week_release(3) - 1, 18, False, f"Reminder: {EXAM_TITLE} is on {weekday(EXAM_DAY)}, 10:00-11:00 AM. "
                                                 "It covers weeks 1 and 2. You will have 45 minutes once you start."),
                (RELEASE_DAY, 9, False, "Midterm quiz results are released. Open Exams to see your score per item. "
                                        "Retake the Week 2 quizzes for practice if you scored below 75%."),
                (week_release(4), 8, False, "Week 4 is about functions. Start with the functions concept check."),
            ]
            for day, hour, pinned, body in posts:
                if not db.query(WorkshopAnnouncement.id).filter_by(workshop_id=workshop.id, body=body).first():
                    db.add(WorkshopAnnouncement(workshop_id=workshop.id, author_id=instructor.id, body=body, pinned=pinned,
                                                created_at=at(day, hour), updated_at=at(day, hour)))
        course_post = "The Week 4 functions activities are open. Office hours are Thursday, 3:00-5:00 PM in Lab 2."
        if not db.query(CourseAnnouncement.id).filter_by(course_id=course.id, body=course_post).first():
            db.add(CourseAnnouncement(course_id=course.id, author_id=instructor.id, title="Week 4 is open",
                                      body=course_post, created_at=at(week_release(4), 7), updated_at=at(week_release(4), 7)))
        db.commit()

        # 3. Plans: who practises what, and when. Seeded per email so reruns plan the same.
        plans, takers = {}, []
        for name in BLOCK_WORKSHOPS:
            block_rng = random.Random(name)
            for student_id, persona in zip(block_members[name], personas_for(len(block_members[name]), block_rng)):
                rng = random.Random(str(student_id))
                if persona is None:
                    continue
                plans[student_id] = (rng, [(m, a.id, p) for m, a, p in plan_practice(rng, persona, activities)])
                exam_range = PERSONAS[persona]["exam"]
                if exam_range:
                    takers.append((student_id, rng.uniform(*exam_range), rng))
        plans[kieser_id] = (random.Random("kieser"), [
            (at(d, h, m), by_sequence[s].id, p) for d, h, m, s, p in KIESER_PLAN if at(d, h, m) < NOW])
        takers.append((kieser_id, 0.8, random.Random("kieser-exam")))
        # Sessions expire objects on commit, so carry plain ids out of this one.
        exam_workshop_ids = [workshops[n].id for n in BLOCK_WORKSHOPS + [KIESER_WORKSHOP]]
        exam_quiz_ids = [by_sequence[s].id for s in EXAM_SEQUENCES]

    exam_start = at(EXAM_DAY, 10)
    before = insert_attempts(plans, exam_start, None, tests)
    released = run_exam(instructor_id, exam_workshop_ids, exam_quiz_ids, takers, exam_id)
    after = insert_attempts(plans, None, exam_start, tests)
    print(f"Practice attempts added: {before + after}; exam results released for {released} attempts")
    with SessionLocal() as db:
        for email, profile_id in ids.items():
            profile = db.get(Profile, profile_id)
            print(f"{email}: role {profile.role.value}, {profile.xp_points} XP, level {profile.current_level}")


if __name__ == "__main__":
    main()
