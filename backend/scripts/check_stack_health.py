"""Check what a class needs to submit code and get it graded.

Covers the submission queue, the grading worker heartbeat and, with --judge0, one real Judge0 test run.
The launcher runs it once after startup and the class-time watchdog runs it every minute. It reuses the
checks behind the admin Monitoring page, so the two can never disagree. Exit code 0 means every check passed.
"""

import argparse
import asyncio
import sys
from types import SimpleNamespace

from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal
from app.services.monitoring import SandboxHealth, overall_health, service_health

CLASS_CRITICAL = ("code_runner", "grading_worker", "judge0")


async def check(run_judge0: bool) -> tuple[bool, list[str]]:
    wanted = CLASS_CRITICAL if run_judge0 else CLASS_CRITICAL[:2]
    sandbox = await SandboxHealth().check() if run_judge0 else {}
    try:
        with SessionLocal() as db:
            # No app state outside the API: forecasting reads as "off", which is not checked here anyway.
            services = [row for row in service_health(db, SimpleNamespace(), sandbox) if row["service"] in wanted]
    except SQLAlchemyError as exc:
        return False, [f"database failed: the database did not answer ({type(exc).__name__})."]
    lines = [f"{row['service']} {row['status']}: {row['detail']}" for row in services]
    return overall_health(services) == "healthy", lines


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--judge0", action="store_true", help="Also grade one test program on Judge0.")
    healthy, lines = asyncio.run(check(parser.parse_args().judge0))
    print("\n".join(lines))
    return 0 if healthy else 1


if __name__ == "__main__":
    sys.exit(main())
