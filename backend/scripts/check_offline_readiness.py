"""Read-only check that the local database has usable offline learning content."""

from sqlalchemy import text
from sqlalchemy.engine import make_url

from app.core.config import settings
from app.core.database import engine


def main() -> int:
    database = make_url(settings.DATABASE_URL)
    if database.host not in {"localhost", "127.0.0.1", "::1"}:
        raise SystemExit("Offline preparation refuses to inspect a non-local database.")

    with engine.connect() as connection:
        users = connection.execute(text("SELECT count(*) FROM auth.users")).scalar_one()
        activities = connection.execute(text("""
            SELECT language::text, activity_type::text, count(*)
            FROM learning_activities
            WHERE review_status = 'published' AND archived_at IS NULL
              AND (closed_at IS NULL OR closed_at > now())
            GROUP BY language, activity_type
            ORDER BY language, activity_type
        """)).all()

    print(f"Local accounts: {users} (new accounts can also sign up offline).")
    for language, kind, count in activities:
        print(f"Published {language} {kind}: {count}")
    if not activities:
        raise SystemExit("No published local activities are available. Publish learning content before offline use.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
