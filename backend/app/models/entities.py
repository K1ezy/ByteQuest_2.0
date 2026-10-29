import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Identity,
    Integer,
    Index,
    MetaData,
    String,
    Table,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector

from app.core.database import Base

# Supabase owns auth.users. Keep this reference in separate metadata so regular
# application metadata operations never try to create or migrate the Auth table.
auth_metadata = MetaData()
auth_users = Table(
    "users",
    auth_metadata,
    Column("id", UUID(as_uuid=True), primary_key=True),
    schema="auth",
)


# ============================================================================
# Enums
# ============================================================================
class ProgrammingLang(str, enum.Enum):
    cpp = "cpp"
    python = "python"
    java = "java"


class ActivityKind(str, enum.Enum):
    quiz = "quiz"
    challenge = "challenge"


class ReviewState(str, enum.Enum):
    draft = "draft"
    reviewed = "reviewed"
    published = "published"


class UserRole(str, enum.Enum):
    student = "student"
    instructor = "instructor"
    admin = "admin"


# ============================================================================
# 1. Profile Model
# ============================================================================
class Profile(Base):
    __tablename__ = "profiles"

    id = Column(
        UUID(as_uuid=True),
        ForeignKey(auth_users.c.id, ondelete="CASCADE"),
        primary_key=True,
        default=uuid.uuid4,
    )
    pseudonym_id = Column(String(64), unique=True, nullable=False, index=True)
    role = Column(Enum(UserRole, name="userrole"), nullable=False, default=UserRole.student)
    year_level = Column(Integer, nullable=False, default=1)
    semester = Column(Integer, nullable=False, default=1)
    enrolled_language = Column(
        Enum(ProgrammingLang, name="programminglang"),
        nullable=False,
        default=ProgrammingLang.cpp,
    )
    xp_points = Column(Integer, nullable=False, default=0)
    current_level = Column(Integer, nullable=False, default=1)
    account_status = Column(String(20), nullable=False, default="active", server_default=text("'active'"))
    deactivated_at = Column(DateTime(timezone=True), nullable=True)
    display_name = Column(String(120), nullable=True)
    email = Column(String(320), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    attempts = relationship("ActivityAttempt", back_populates="student", cascade="all, delete-orphan")


# ============================================================================
# 2. Instructional Documents (RAG)
# ============================================================================
class InstructionalDocument(Base):
    __tablename__ = "instructional_documents"

    __table_args__ = (
        UniqueConstraint("document_family_id", "version_number", name="uq_instructional_documents_family_version"),
        Index(
            "uq_instructional_documents_current_family",
            "document_family_id",
            unique=True,
            postgresql_where=text("is_current IS TRUE AND archived_at IS NULL"),
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_family_id = Column(UUID(as_uuid=True), nullable=False, default=uuid.uuid4, index=True)
    version_number = Column(Integer, nullable=False, default=1)
    is_current = Column(Boolean, nullable=False, default=True)
    supersedes_document_id = Column(
        UUID(as_uuid=True), ForeignKey("instructional_documents.id", ondelete="SET NULL"), nullable=True
    )
    archived_at = Column(DateTime(timezone=True), nullable=True)
    sha256 = Column(String(64), nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    language_tag = Column(Enum(ProgrammingLang, name="programminglang"), nullable=False)
    topic_concept = Column(String(100), nullable=True)
    storage_path = Column(Text, nullable=False)
    status = Column(String(20), default="processing", nullable=False)
    processing_status = Column(String(20), default="processing", nullable=False)
    total_chunks = Column(Integer, default=0, nullable=False)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="SET NULL"), nullable=True)
    processing_error = Column(Text, nullable=True)
    uploaded_original_name = Column(String(255), nullable=True)
    indexed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")


# ============================================================================
# 3. Document Chunks (Vector Store)
# ============================================================================
class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    __table_args__ = (
        UniqueConstraint(
            "document_id",
            "chunk_index",
            name="uq_document_chunks_document_index",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("instructional_documents.id", ondelete="CASCADE"), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    page_number = Column(Integer, default=1, nullable=False)
    content_text = Column(Text, nullable=False)
    token_count = Column(Integer, nullable=False)
    embedding = Column(Vector(768), nullable=False)
    embedding_model = Column(String(50), default="gemini-embedding-2", nullable=False)
    embedding_dim = Column(Integer, default=768, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    document = relationship("InstructionalDocument", back_populates="chunks")


# ============================================================================
# 4. Learning Activities (Quizzes & Challenges)
# ============================================================================
class LearningActivity(Base):
    __tablename__ = "learning_activities"

    __table_args__ = (
        Index(
            "ix_learning_activities_source_document_id", "source_document_id"
        ),
        Index("ix_learning_activities_created_by", "created_by"),
        Index("ix_learning_activities_reviewed_by", "reviewed_by"),
        Index(
            "idx_learning_activities_track_sequence",
            "language",
            "review_status",
            "sequence_order",
            "difficulty_level",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_document_id = Column(UUID(as_uuid=True), ForeignKey("instructional_documents.id", ondelete="SET NULL"), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=True)
    activity_type = Column(Enum(ActivityKind, name="activitykind"), nullable=False)
    language = Column(Enum(ProgrammingLang, name="programminglang"), nullable=False)
    topic_concept = Column(String(100), nullable=False)
    title = Column(String(255), nullable=True)
    problem_statement = Column(Text, nullable=True)
    starter_code = Column(Text, nullable=True)
    difficulty_level = Column(Integer, nullable=False, default=1)
    sequence_order = Column(Integer, nullable=False, default=1)
    review_status = Column(
        Enum(ReviewState, name="reviewstate"),
        default=ReviewState.draft,
        nullable=False,
    )
    closed_at = Column(DateTime(timezone=True), nullable=True)
    reference_solution_code = Column(Text, nullable=True)
    quiz_questions_json = Column(JSONB, nullable=True)
    judge0_verified = Column(Boolean, default=False, nullable=False)
    judge0_verification_log = Column(JSONB, nullable=True)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=True)
    xp_reward = Column(Integer, default=50, nullable=False)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="SET NULL"), nullable=True)
    generation_json = Column(JSONB, nullable=True)
    content_version = Column(Integer, nullable=False, default=1, server_default=text("1"))
    opens_at = Column(DateTime(timezone=True), nullable=True)
    closes_at = Column(DateTime(timezone=True), nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    archived_at = Column(DateTime(timezone=True), nullable=True)
    version_number = Column(Integer, nullable=False, default=1, server_default=text("1"))
    version_of = Column(UUID(as_uuid=True), ForeignKey("learning_activities.id", ondelete="SET NULL"), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    test_cases = relationship("TestCase", back_populates="activity", cascade="all, delete-orphan", order_by="TestCase.order_index")
    attempts = relationship("ActivityAttempt", back_populates="activity", cascade="all, delete-orphan")


class QuestGroup(Base):
    __tablename__ = "quest_groups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(80), nullable=False)
    description = Column(String(500), nullable=True)
    language = Column(Enum(ProgrammingLang, name="programminglang"), nullable=False)
    join_code = Column(String(8), unique=True, nullable=False, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class QuestGroupMember(Base):
    __tablename__ = "quest_group_members"
    __table_args__ = (UniqueConstraint("group_id", "profile_id", name="uq_quest_group_member"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id = Column(UUID(as_uuid=True), ForeignKey("quest_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    profile_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    joined_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class QuestGroupActivity(Base):
    __tablename__ = "quest_group_activities"
    __table_args__ = (UniqueConstraint("group_id", "activity_id", name="uq_quest_group_activity"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id = Column(UUID(as_uuid=True), ForeignKey("quest_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    activity_id = Column(UUID(as_uuid=True), ForeignKey("learning_activities.id", ondelete="CASCADE"), nullable=False, index=True)



# ============================================================================
# 5. Test Cases
# ============================================================================
class TestCase(Base):
    __tablename__ = "test_cases"

    __table_args__ = (Index("ix_test_cases_activity_id", "activity_id"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    activity_id = Column(UUID(as_uuid=True), ForeignKey("learning_activities.id", ondelete="CASCADE"), nullable=False)
    order_index = Column(Integer, default=0, nullable=False)
    stdin = Column(Text, default="", nullable=False)
    expected_stdout = Column(Text, nullable=False)
    time_limit_ms = Column(Integer, default=2000, nullable=False)
    memory_limit_kb = Column(Integer, default=256000, nullable=False)
    is_hidden = Column(Boolean, default=False, nullable=False)
    weight = Column(Float, default=1.0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    activity = relationship("LearningActivity", back_populates="test_cases")


# ============================================================================
# 6. Activity Attempts (Rule 5: Append-Only)
# ============================================================================
class ActivityAttempt(Base):
    __tablename__ = "activity_attempts"

    __table_args__ = (
        UniqueConstraint(
            "student_id",
            "activity_id",
            "attempt_number",
            name="uq_activity_attempts_student_activity_number",
        ),
        Index(
            "ix_activity_attempts_student_activity",
            "student_id",
            "activity_id",
            "created_at",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    activity_id = Column(UUID(as_uuid=True), ForeignKey("learning_activities.id", ondelete="CASCADE"), nullable=False)
    attempt_number = Column(Integer, nullable=False)
    submitted_code = Column(Text, nullable=True)
    quiz_answers_json = Column(JSONB, nullable=True)
    passed_test_cases = Column(Integer, default=0, nullable=False)
    total_test_cases = Column(Integer, default=0, nullable=False)
    score_percentage = Column(Float, default=0.0, nullable=False)
    is_successful = Column(Boolean, nullable=False)
    execution_time_ms = Column(Float, nullable=True)
    memory_used_kb = Column(Float, nullable=True)
    compiler_status_id = Column(Integer, nullable=True)
    error_category = Column(String(50), default="none", nullable=False)
    time_spent_seconds = Column(Integer, default=0, nullable=False)
    xp_awarded = Column(Integer, default=0, nullable=False)
    submission_job_id = Column(UUID(as_uuid=True), unique=True, nullable=True)
    result_json = Column(JSONB, nullable=True)
    exam_attempt_id = Column(UUID(as_uuid=True), ForeignKey("exam_attempts.id", ondelete="SET NULL"), nullable=True)
    exam_item_id = Column(UUID(as_uuid=True), ForeignKey("exam_items.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    student = relationship("Profile", back_populates="attempts")
    activity = relationship("LearningActivity", back_populates="attempts")


class ActivityDraft(Base):
    __tablename__ = "activity_drafts"
    __table_args__ = (UniqueConstraint("student_id", "activity_id", name="uq_activity_draft_student_activity"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    activity_id = Column(UUID(as_uuid=True), ForeignKey("learning_activities.id", ondelete="CASCADE"), nullable=False)
    source_code = Column(Text, nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))


class SubmissionJob(Base):
    __tablename__ = "submission_jobs"
    __table_args__ = (UniqueConstraint("student_id", "idempotency_key", name="uq_submission_job_student_key"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    activity_id = Column(UUID(as_uuid=True), ForeignKey("learning_activities.id", ondelete="CASCADE"), nullable=False)
    idempotency_key = Column(String(100), nullable=False)
    source_code = Column(Text, nullable=False)
    dry_run_only = Column(Boolean, nullable=False, default=False)
    status = Column(String(20), nullable=False, default="queued", index=True)
    result_json = Column(JSONB, nullable=True)
    error_message = Column(Text, nullable=True)
    attempts = Column(Integer, nullable=False, server_default=text("0"))
    next_attempt_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))


class ChallengeHint(Base):
    __tablename__ = "challenge_hints"
    __table_args__ = (UniqueConstraint("activity_id", "slot", name="uq_challenge_hint_slot"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    activity_id = Column(UUID(as_uuid=True), ForeignKey("learning_activities.id", ondelete="CASCADE"), nullable=False, index=True)
    slot = Column(Integer, nullable=False)
    body = Column(Text, nullable=False)


class HintUse(Base):
    __tablename__ = "hint_uses"
    __table_args__ = (UniqueConstraint("student_id", "activity_id", "request_key", name="uq_hint_use_request"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    activity_id = Column(UUID(as_uuid=True), ForeignKey("learning_activities.id", ondelete="CASCADE"), nullable=False)
    request_key = Column(String(100), nullable=False)
    hint_id = Column(UUID(as_uuid=True), ForeignKey("challenge_hints.id", ondelete="SET NULL"), nullable=True)
    source = Column(String(16), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))


class ResearchConsent(Base):
    __tablename__ = "research_consents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_order = Column(BigInteger, Identity(always=True), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    document_version = Column(String(100), nullable=False)
    choice = Column(String(16), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))


class Exam(Base):
    __tablename__ = "exams"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    opens_at = Column(DateTime(timezone=True), nullable=False)
    closes_at = Column(DateTime(timezone=True), nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    published_at = Column(DateTime(timezone=True), nullable=True)
    results_released_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))


class ExamItem(Base):
    __tablename__ = "exam_items"
    __table_args__ = (UniqueConstraint("exam_id", "position", name="uq_exam_item_position"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False, index=True)
    activity_id = Column(UUID(as_uuid=True), ForeignKey("learning_activities.id"), nullable=False)
    position = Column(Integer, nullable=False)
    points = Column(Integer, nullable=False)
    snapshot_json = Column(JSONB, nullable=False)


class ExamAssignment(Base):
    __tablename__ = "exam_assignments"
    __table_args__ = (UniqueConstraint("exam_id", "group_id", name="uq_exam_assignment_group"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    group_id = Column(UUID(as_uuid=True), ForeignKey("quest_groups.id", ondelete="CASCADE"), nullable=False)


class ExamAttempt(Base):
    __tablename__ = "exam_attempts"
    __table_args__ = (UniqueConstraint("exam_id", "student_id", "attempt_number", name="uq_exam_attempt_number"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    attempt_number = Column(Integer, nullable=False)
    status = Column(String(20), nullable=False, default="active")
    started_at = Column(DateTime(timezone=True), nullable=False)
    due_at = Column(DateTime(timezone=True), nullable=False)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    last_saved_at = Column(DateTime(timezone=True), nullable=True)
    answers_json = Column(JSONB, nullable=False, default=dict)
    revision = Column(Integer, nullable=False, default=0)
    score = Column(Float, nullable=True)
    max_score = Column(Float, nullable=True)
    result_json = Column(JSONB, nullable=True)


class ExamRetakeGrant(Base):
    __tablename__ = "exam_retake_grants"
    __table_args__ = (UniqueConstraint("exam_id", "student_id", name="uq_exam_retake_student"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    allowed_attempts = Column(Integer, nullable=False, default=2)
    opens_at = Column(DateTime(timezone=True), nullable=False)
    closes_at = Column(DateTime(timezone=True), nullable=False)
    duration_minutes = Column(Integer, nullable=False)


class ExamSampleRun(Base):
    __tablename__ = "exam_sample_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    exam_attempt_id = Column(UUID(as_uuid=True), ForeignKey("exam_attempts.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))


class NotificationOutbox(Base):
    __tablename__ = "notification_outbox"
    __table_args__ = (UniqueConstraint("dedupe_key", name="uq_notification_dedupe"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recipient_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    dedupe_key = Column(String(200), nullable=False)
    subject = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    attempts = Column(Integer, nullable=False, default=0)
    next_attempt_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))


# ============================================================================
# 7. ML Predictions
# ============================================================================
class MLPrediction(Base):
    __tablename__ = "ml_predictions"

    __table_args__ = (
        Index(
            "idx_ml_predictions_student_target_created",
            "student_id",
            "target_activity_id",
            "created_at",
        ),
        Index(
            "idx_ml_predictions_actual_outcome",
            "actual_outcome",
            postgresql_where=Column("actual_outcome").is_not(None),
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(
        UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_attempt_id = Column(
        UUID(as_uuid=True),
        ForeignKey("activity_attempts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    target_activity_id = Column(
        UUID(as_uuid=True),
        ForeignKey("learning_activities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    features_snapshot_json = Column(JSONB, nullable=False)
    logreg_prob = Column(Float, nullable=False)
    logreg_pred = Column(Boolean, nullable=False)
    rf_prob = Column(Float, nullable=False)
    rf_pred = Column(Boolean, nullable=False)
    actual_outcome = Column(Boolean, nullable=True)
    active_sequencer_mode = Column(String(50), nullable=True)
    recommended_action = Column(String(50), nullable=True)
    model_version = Column(String(50), default="v1.0.0", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# ============================================================================
# 8. Badges & Gamification
# ============================================================================
class Badge(Base):
    __tablename__ = "badges"

    __table_args__ = (UniqueConstraint("code", name="uq_badges_code"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(64), nullable=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    icon_url = Column(Text, nullable=False)
    xp_bonus = Column(Integer, default=50, nullable=False)
    criteria_json = Column(JSONB, nullable=False)


class StudentBadge(Base):
    __tablename__ = "student_badges"

    __table_args__ = (
        UniqueConstraint("student_id", "badge_id", name="uq_student_badges_student_badge"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    badge_id = Column(UUID(as_uuid=True), ForeignKey("badges.id", ondelete="CASCADE"), nullable=False)
    awarded_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# ============================================================================
# 9. Course scoping for the faculty and administrator workspace
# ============================================================================
class Course(Base):
    __tablename__ = "courses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(24), nullable=False, unique=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="active")
    created_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))


class CourseMember(Base):
    __tablename__ = "course_members"
    __table_args__ = (UniqueConstraint("course_id", "profile_id", "member_role", name="uq_course_member"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    profile_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    member_role = Column(String(20), nullable=False)
    status = Column(String(20), nullable=False, default="active")
    assigned_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    assigned_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))


class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    service = Column(String(32), nullable=False)
    job_type = Column(String(64), nullable=False)
    status = Column(String(20), nullable=False, default="queued")
    document_id = Column(UUID(as_uuid=True), ForeignKey("instructional_documents.id", ondelete="SET NULL"), nullable=True)
    activity_id = Column(UUID(as_uuid=True), ForeignKey("learning_activities.id", ondelete="SET NULL"), nullable=True)
    requested_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    attempts = Column(Integer, nullable=False, default=0)
    max_attempts = Column(Integer, nullable=False, default=3)
    retryable = Column(Boolean, nullable=False, default=False)
    cause = Column(Text, nullable=True)
    trace_id = Column(String(64), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    last_checked_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))


class PlatformSetting(Base):
    __tablename__ = "platform_settings"

    key = Column(String(64), primary_key=True)
    service = Column(String(32), nullable=False)
    label = Column(String(160), nullable=False)
    description = Column(Text, nullable=False)
    value = Column(JSONB, nullable=False)
    value_type = Column(String(16), nullable=False)
    min_value = Column(Float, nullable=True)
    max_value = Column(Float, nullable=True)
    version = Column(Integer, nullable=False, default=1)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(BigInteger, Identity(always=True), primary_key=True)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    actor_role = Column(String(20), nullable=True)
    action = Column(String(64), nullable=False)
    entity_type = Column(String(32), nullable=False)
    entity_id = Column(Text, nullable=True)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="SET NULL"), nullable=True)
    summary = Column(Text, nullable=False)
    metadata_json = Column("metadata", JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
