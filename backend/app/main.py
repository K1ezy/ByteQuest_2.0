from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api.quests_gamification import router as quests_router
from app.api.ml_analytics import router as ml_analytics_router
from app.api.profiles import router as profiles_router
from app.api.rag_instructor import router as rag_instructor_router
from app.api.submissions import router as submissions_router
from app.core.config import settings
from app.services.ml_predictor.predictor import (
    ModelArtifactError,
    ModelArtifactsUnavailable,
    load_ml_models,
)

logger = logging.getLogger(__name__)

# Rate Limiter (Rule 7)
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s v%s [%s]", settings.PROJECT_NAME, settings.VERSION, settings.ENVIRONMENT)
    try:
        model_bundle = load_ml_models()
        app.state.sequencer_mode = "random_forest"
        app.state.model_version = model_bundle.model_version
    except ModelArtifactsUnavailable as exc:
        app.state.sequencer_mode = "rule_based"
        app.state.model_version = None
        logger.warning("ML sequencing is unavailable at startup; rule-based sequencing remains active: %s", exc)
    except ModelArtifactError:
        app.state.sequencer_mode = "rule_based"
        app.state.model_version = None
        logger.exception("ML model artifacts failed validation; rule-based sequencing remains active.")
    except Exception:
        app.state.sequencer_mode = "rule_based"
        app.state.model_version = None
        logger.exception("Unexpected ML startup failure; rule-based sequencing remains active.")
    yield
    logger.info("Shutting down %s", settings.PROJECT_NAME)


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)
app.state.sequencer_mode = "rule_based"
app.state.model_version = None

# Set rate limiter state & handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS Middleware (Rule 4)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(submissions_router)
app.include_router(quests_router)
app.include_router(rag_instructor_router)
app.include_router(ml_analytics_router)
app.include_router(profiles_router)


@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "online",
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "sequencer_mode": app.state.sequencer_mode,
    }


@app.get(f"{settings.API_V1_STR}/health", tags=["Health"])
async def api_health_check():
    return {
        "status": "healthy",
        "gemini_model": settings.GEMINI_MODEL_ID,
        "judge0_url": settings.JUDGE0_BASE_URL,
        "sequencer_mode": app.state.sequencer_mode,
        "model_version": app.state.model_version,
    }

