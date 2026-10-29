from pathlib import Path
from typing import List
from urllib.parse import urlsplit
from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # Local Supabase settings intentionally override any cloud values in .env.
        env_file=[".env", "backend/.env", ".env.local", "backend/.env.local"],
        extra="ignore",
        case_sensitive=True,
    )

    PROJECT_NAME: str = "ByteQuest 2.0 API"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Environment
    ENVIRONMENT: str = "development"
    
    # Database (Supabase PostgreSQL + pgvector)
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:54322/postgres"
    # SQLAlchemy pools are per Uvicorn worker process. Keep these bounded so
    # replicas cannot exhaust the managed PostgreSQL connection allowance.
    DB_POOL_SIZE: int = Field(default=5, ge=1, le=20)
    DB_MAX_OVERFLOW: int = Field(default=5, ge=0, le=20)
    DB_POOL_TIMEOUT_SECONDS: int = Field(default=30, ge=1, le=30)
    DB_CONNECT_TIMEOUT_SECONDS: int = Field(default=5, ge=1, le=30)
    DB_POOL_RECYCLE_SECONDS: int = Field(default=1800, ge=60, le=86400)
    
    # Supabase Auth
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_SECRET_KEY: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_JWT_SECRET: str = "super-secret-jwt-token-replace-in-env"
    
    # Gemini AI (Rule 1 & Rule 2)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL_ID: str = "gemini-3.5-flash-lite"
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-2"
    GEMINI_EMBEDDING_MODEL_ID: str = "gemini-embedding-2"
    GEMINI_EMBEDDING_DIM: int = 768

    # Bounded learning-assistant chat. These caps are enforced server-side.
    CHAT_MAX_MESSAGES: int = Field(default=12, ge=1, le=30)
    CHAT_MAX_MESSAGE_CHARS: int = Field(default=4_000, ge=1, le=8_000)
    CHAT_MAX_TOTAL_CHARS: int = Field(default=16_000, ge=1, le=50_000)
    CHAT_MAX_OUTPUT_TOKENS: int = Field(default=600, ge=50, le=2_000)
    CHAT_TIMEOUT_SECONDS: float = Field(default=20.0, ge=5, le=60)
    
    # Judge0 CE (Rule 3)
    JUDGE0_BASE_URL: str = "http://localhost:2358"
    JUDGE0_API_KEY: str = ""
    JUDGE0_TIMEOUT_SECONDS: int = 15
    JUDGE0_EXECUTION_TIMEOUT_SECONDS: int = Field(default=75, ge=5, le=300)
    SUPABASE_AUTH_TIMEOUT_SECONDS: float = Field(default=4.0, gt=0, le=15)

    # ML model artifacts (can be overridden by the container mount path).
    ML_ARTIFACTS_DIR: Path = (
        Path(__file__).resolve().parents[3] / "ml_pipeline" / "artifacts"
    )
    # Live shadow scoring is opt-in and never controls the student sequencer.
    # Research approval must be explicitly attested before any student history
    # is used to create shadow prediction records.
    # Hard safety flags — MUST default to False for classroom pilot safety
    RESEARCH_COLLECTION_ENABLED: bool = False
    CONSENT_APPROVED_VERSION: str | None = None
    EMAIL_ENABLED: bool = False

    # Worker resilience settings
    SUBMISSION_MAX_RETRIES: int = 3
    SUBMISSION_STALE_TIMEOUT_SECONDS: int = 120
    SUBMISSION_WORKER_CONCURRENCY: int = Field(default=3, ge=1, le=4)
    EXAM_AUTOSAVE_GRACE_SECONDS: int = 15

    # Research and ML shadow settings
    ML_SHADOW_ENABLED: bool = False
    ML_SHADOW_RESEARCH_APPROVED: bool = False
    RESEARCH_CONSENT_ACTIVE: bool = False
    RESEARCH_CONSENT_VERSION: str = ""
    RESEARCH_CONSENT_TEXT: str = ""
    OUTBOUND_EMAIL_ENABLED: bool = False
    SMTP_HOST: str = ""
    SMTP_PORT: int = Field(default=587, ge=1, le=65535)
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""

    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    @model_validator(mode="after")
    def validate_cors_origins(self):
        if not self.CORS_ORIGINS:
            raise ValueError("CORS_ORIGINS must contain exact frontend origins.")
        production = self.ENVIRONMENT.lower() == "production"
        for origin in self.CORS_ORIGINS:
            parsed = urlsplit(origin)
            if (parsed.scheme not in ("http", "https") or not parsed.netloc or
                    parsed.path or parsed.query or parsed.fragment or parsed.username or
                    parsed.password or "*" in origin):
                raise ValueError("CORS_ORIGINS entries must be exact origins without wildcards.")
            if production and parsed.scheme != "https":
                raise ValueError("Production CORS_ORIGINS must use explicitly configured HTTPS origins.")
        return self

settings = Settings()


def get_settings() -> Settings:
    return settings

