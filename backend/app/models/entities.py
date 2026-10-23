import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


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

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pseudonym_id = Column(String(64), unique=True, nullable=False, index=True)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.student)
    year_level = Column(Integer, nullable=False, default=1)
    semester = Column(Integer, nullable=False, default=1)
    enrolled_language = Column(Enum(ProgrammingLang), nullable=False, default=ProgrammingLang.cpp)
    xp_points = Column(Integer, nullable=False, default=0)
    current_level = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    attempts = relationship("ActivityAttempt", back_populates="student", cascade="all, delete-orphan")


# ============================================================================
# 2. Instructional Documents (RAG)
# ============================================================================
class InstructionalDocument(Base):
    __tablename__ = "instructional_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False)
    title = Column(String(255), nullable=False)
    language_tag = Column(Enum(ProgrammingLang), nullable=False)
    storage_path = Column(Text, nullable=False)
    status = Column(String(20), default="processing", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")


# ============================================================================
# 3. Document Chunks (Vector Store)
# ============================================================================
class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("instructional_documents.id", ondelete="CASCADE"), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    content_text = Column(Text, nullable=False)
    token_count = Column(Integer, nullable=False)
    embedding_model = Column(String(50), default="gemini-embedding-2", nullable=False)
    embedding_dim = Column(Integer, default=768, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    document = relationship("InstructionalDocument", back_populates="chunks")


# ============================================================================
# 4. Learning Activities (Quizzes & Challenges)
# ============================================================================
class LearningActivity(Base):
    __tablename__ = "learning_activities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_document_id = Column(UUID(as_uuid=True), ForeignKey("instructional_documents.id", ondelete="SET NULL"), nullable=True)
    activity_type = Column(Enum(ActivityKind), nullable=False)
    language = Column(Enum(ProgrammingLang), nullable=False)
    topic_concept = Column(String(100), nullable=False)
    difficulty_level = Column(Integer, nullable=False, default=1)
    sequence_order = Column(Integer, nullable=False, default=1)
    review_status = Column(Enum(ReviewState), default=ReviewState.draft, nullable=False)
    reference_solution_code = Column(Text, nullable=True)
    judge0_verified = Column(Boolean, default=False, nullable=False)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=True)
    xp_reward = Column(Integer, default=50, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    test_cases = relationship("TestCase", back_populates="activity", cascade="all, delete-orphan", order_by="TestCase.order_index")
    attempts = relationship("ActivityAttempt", back_populates="activity", cascade="all, delete-orphan")


# ============================================================================
# 5. Test Cases
# ============================================================================
class TestCase(Base):
    __tablename__ = "test_cases"

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
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    student = relationship("Profile", back_populates="attempts")
    activity = relationship("LearningActivity", back_populates="attempts")


# ============================================================================
# 7. ML Predictions
# ============================================================================
class MLPrediction(Base):
    __tablename__ = "ml_predictions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    target_activity_id = Column(UUID(as_uuid=True), ForeignKey("learning_activities.id", ondelete="CASCADE"), nullable=False)
    features_snapshot_json = Column(JSONB, nullable=False)
    logreg_prob = Column(Float, nullable=False)
    logreg_pred = Column(Boolean, nullable=False)
    rf_prob = Column(Float, nullable=False)
    rf_pred = Column(Boolean, nullable=False)
    actual_outcome = Column(Boolean, nullable=True)
    model_version = Column(String(50), default="v1.0.0", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# ============================================================================
# 8. Badges & Gamification
# ============================================================================
class Badge(Base):
    __tablename__ = "badges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    icon_url = Column(Text, nullable=False)
    xp_bonus = Column(Integer, default=50, nullable=False)
    criteria_json = Column(JSONB, nullable=False)


class StudentBadge(Base):
    __tablename__ = "student_badges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    badge_id = Column(UUID(as_uuid=True), ForeignKey("badges.id", ondelete="CASCADE"), nullable=False)
    awarded_at = Column(DateTime, default=datetime.utcnow, nullable=False)
