from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api.quests_gamification import gamification_router, router as quests_router
from app.api.reviews import router as reviews_router
from app.api.workshops import router as workshops_router
from app.api.profiles import router as profiles_router
from app.api.pilot import router as pilot_router
from app.api.submission_jobs import router as submission_jobs_router
from app.api.rag_instructor import router as rag_instructor_router
from app.api.faculty import router as faculty_router
from app.api.faculty_ml import router as faculty_ml_router
from app.api.admin import router as admin_router
from app.api.chat import router as chat_router
from app.api.chat_history import router as chat_history_router
from app.core.config import settings
from app.core.database import engine
from app.core.request_size import RequestSizeLimitMiddleware
from app.services.ml_predictor.predictor import (
    ModelArtifactError,
    ModelArtifactsUnavailable,
    load_ml_models,
)
from app.services.judge0.client import judge0_client
from app.services.monitoring import SandboxHealth
from app.services.storage.supabase_storage import avatar_storage, pdf_storage

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s v%s [%s]", settings.PROJECT_NAME, settings.VERSION, settings.ENVIRONMENT)
    app.state.sequencer_mode = "rule_based"
    app.state.model_version = None
    app.state.selected_model = None
    app.state.ml_model_report = None
    app.state.sandbox_health = SandboxHealth()

    limits = httpx.Limits(
        max_connections=40,
        max_keepalive_connections=16,
        keepalive_expiry=30.0,
    )
    timeout = httpx.Timeout(20.0, connect=3.0)
    async with httpx.AsyncClient(limits=limits, timeout=timeout) as http_client:
        app.state.http_client = http_client
        judge0_client.set_http_client(http_client)
        pdf_storage.set_http_client(http_client)
        avatar_storage.set_http_client(http_client)
        try:
            if not settings.ML_SHADOW_ENABLED:
                app.state.ml_shadow_status = "disabled"
            elif not settings.ML_SHADOW_RESEARCH_APPROVED:
                app.state.ml_shadow_status = "approval_required"
                logger.warning(
                    "ML shadow scoring is enabled in configuration but is blocked until "
                    "ML_SHADOW_RESEARCH_APPROVED is explicitly set. Rule-based sequencing remains active."
                )
            else:
                try:
                    model_bundle = load_ml_models()
                    app.state.ml_shadow_status = "ready"
                    app.state.model_version = model_bundle.model_version
                    app.state.selected_model = model_bundle.selected_model
                    # Retained so faculty evaluation requests never reload artifacts.
                    app.state.ml_model_report = model_bundle.report
                except ModelArtifactsUnavailable as exc:
                    app.state.ml_shadow_status = "artifacts_unavailable"
                    logger.warning(
                        "ML shadow scoring is unavailable; rule-based sequencing remains active: %s",
                        exc,
                    )
                except ModelArtifactError:
                    app.state.ml_shadow_status = "artifacts_invalid"
                    logger.exception(
                        "ML shadow artifacts failed validation; rule-based sequencing remains active."
                    )
                except Exception:
                    app.state.ml_shadow_status = "unavailable"
                    logger.exception(
                        "Unexpected ML shadow startup failure; rule-based sequencing remains active."
                    )
            yield
        finally:
            judge0_client.set_http_client(None)
            pdf_storage.set_http_client(None)
            avatar_storage.set_http_client(None)
            app.state.http_client = None
    logger.info("Shutting down %s", settings.PROJECT_NAME)


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    docs_url=None if settings.ENVIRONMENT.lower() == "production" else "/docs",
    redoc_url=None if settings.ENVIRONMENT.lower() == "production" else "/redoc",
    openapi_url=(
        None
        if settings.ENVIRONMENT.lower() == "production"
        else f"{settings.API_V1_STR}/openapi.json"
    ),
    lifespan=lifespan,
)
app.state.sequencer_mode = "rule_based"
app.state.model_version = None
app.state.ml_shadow_status = "disabled"
app.state.ml_model_report = None

app.add_middleware(RequestSizeLimitMiddleware)

# Exact browser origins only. Auth uses Supabase; the API receives bearer tokens.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
    expose_headers=["Retry-After"],
)

# Register API Routers
app.include_router(quests_router)
app.include_router(gamification_router)
app.include_router(reviews_router)
app.include_router(workshops_router)
app.include_router(rag_instructor_router)
app.include_router(faculty_router)
app.include_router(faculty_ml_router)
app.include_router(admin_router)
app.include_router(profiles_router)
app.include_router(pilot_router)
app.include_router(submission_jobs_router)
app.include_router(chat_router)
app.include_router(chat_history_router)


@app.get("/health", tags=["Health"])
async def health_check():
    # Public liveness probe: keep deployment internals out of unauthenticated
    # responses. Detailed runtime state belongs in protected operator logs.
    return {"status": "online"}


@app.get(f"{settings.API_V1_STR}/health", tags=["Health"])
async def api_health_check():
    # Keep the versioned endpoint equally safe for public synthetic smoke checks.
    return {"status": "healthy"}


@app.get("/readyz", tags=["Health"], include_in_schema=False)
def readiness_check():
    """Return readiness only when the configured application database responds."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        # Do not expose connection details or secrets in an unauthenticated
        # response or logs; the operator can correlate this generic signal.
        logger.warning("Database readiness check failed (%s)", type(exc).__name__)
        raise HTTPException(status_code=503, detail={"status": "not_ready"}) from None

    return {"status": "ready"}

