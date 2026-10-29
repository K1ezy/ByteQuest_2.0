from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import declarative_base, sessionmaker, Session

from app.core.config import settings

database_url = make_url(settings.DATABASE_URL)
# Select the driver declared in requirements.txt explicitly. SQLAlchemy may
# otherwise default plain `postgresql://` URLs to psycopg, while this project
# installs psycopg2-binary.
if database_url.drivername == "postgresql":
    database_url = database_url.set(drivername="postgresql+psycopg2")

connect_args: dict[str, int] = {}
if database_url.get_backend_name() == "postgresql":
    connect_args["connect_timeout"] = settings.DB_CONNECT_TIMEOUT_SECONDS

# Use pool_pre_ping=True to reconnect gracefully on stale connections from pooler.
engine = create_engine(
    database_url,
    pool_pre_ping=True,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT_SECONDS,
    pool_recycle=settings.DB_POOL_RECYCLE_SECONDS,
    connect_args=connect_args,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that provides a transactional database session."""
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
