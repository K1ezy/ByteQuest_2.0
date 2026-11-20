"""End-of-study step: destroy the link between research codes and students.

The manuscript commits to deleting the key that links pseudonyms to students when
the study ends. That key is bytequest_private.research_codes. Once its rows are
gone, exported datasets (which carry only research codes and code-hashed row ids)
cannot be joined back to accounts through identifiers.

Needs the database owner's credentials (DATABASE_URL), which only the
administrator running the server has. Dry run by default; nothing is deleted
without --confirm. Run from backend/:

    .venv\\Scripts\\python -m scripts.destroy_research_link            # shows what would be deleted
    .venv\\Scripts\\python -m scripts.destroy_research_link --confirm  # deletes, cannot be undone

Back up nothing from this table first: a backup of it is the key itself.
"""

from __future__ import annotations

import argparse

from sqlalchemy import text

from app.core.database import SessionLocal

_COUNT = text("select count(*) from bytequest_private.research_codes")
_DELETE = text("delete from bytequest_private.research_codes")


def destroy(*, confirm: bool, session_factory=SessionLocal) -> int:
    """Number of links found; deleted only when confirm is true."""
    with session_factory() as db:
        found = int(db.execute(_COUNT).scalar_one())
        if confirm and found:
            db.execute(_DELETE)
            db.commit()
        return found


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--confirm", action="store_true", help="really delete; this cannot be undone")
    args = parser.parse_args()
    found = destroy(confirm=args.confirm)
    if args.confirm:
        print(f"Deleted {found} research-code links. Exported datasets can no longer be linked to accounts.")
    else:
        print(f"Dry run: {found} research-code links would be deleted. Rerun with --confirm at the end of the study.")


if __name__ == "__main__":
    main()
