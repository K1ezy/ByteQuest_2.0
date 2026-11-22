"""Refuse an external database before tests can open an application session."""

import os

import pytest
from sqlalchemy.engine import make_url

from app.core.config import settings


def pytest_sessionstart() -> None:
    database_urls = {settings.DATABASE_URL, os.getenv("BYTEQUEST_TEST_DATABASE_URL")}
    for value in database_urls - {None, ""}:
        url = make_url(value)
        if (
            url.get_backend_name() != "postgresql"
            or url.host not in {"localhost", "127.0.0.1", "::1"}
            or {"host", "hostaddr", "service"}.intersection(url.query)
            or os.getenv("PGHOSTADDR")
            or os.getenv("PGSERVICE")
        ):
            pytest.exit("ByteQuest tests require directly configured loopback PostgreSQL.", returncode=2)
