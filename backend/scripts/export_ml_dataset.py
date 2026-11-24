"""Export the de-identified training dataset for the two forecast models.

Writes attempts.csv and hints.csv, the raw history the trainer turns into the
ten manuscript features (feature_engineering.FEATURE_NAMES). Features are not
exported precomputed: train_compare.py derives them per row at each target's
t0, the same code the live predictor runs, so training and serving can't drift.

Only learners whose latest consent event accepts the current
RESEARCH_CONSENT_VERSION appear, keyed by their research code. Needs the
database owner's DATABASE_URL and institutional approval. Run from backend/:

    .venv\\Scripts\\python -m scripts.export_ml_dataset --research-approved

then train from the repository root:

    python ml_pipeline/train_compare.py --data-csv .\\ml_pipeline\\data\\attempts.csv --hints-csv .\\ml_pipeline\\data\\hints.csv --research-approved
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

from sqlalchemy import text

from app.core.config import settings
from app.core.database import SessionLocal

DEFAULT_OUT = Path(__file__).resolve().parents[2] / "ml_pipeline" / "data"

_LATEST_CONSENT = """
WITH latest_consent AS (
    SELECT DISTINCT ON (student_id) student_id, choice, document_version
    FROM public.research_consents
    ORDER BY student_id, event_order DESC
)
"""

ATTEMPTS_SQL = _LATEST_CONSENT + """
SELECT
    md5(rc.code || ':' || aa.id::text) AS id,
    rc.code AS student_id,
    aa.activity_id::text AS activity_id,
    la.course_id::text AS course_id,
    aa.exam_attempt_id::text AS exam_attempt_id,
    aa.attempt_number,
    aa.created_at,
    la.language::text AS language,
    la.activity_type::text AS activity_type,
    aa.is_successful,
    aa.score_percentage,
    aa.error_category,
    aa.compiler_status_id
FROM public.activity_attempts AS aa
JOIN latest_consent AS consent ON consent.student_id = aa.student_id
    AND consent.choice = 'accepted'
    AND consent.document_version = :current_consent_version
JOIN bytequest_private.research_codes AS rc ON rc.student_id = aa.student_id
JOIN public.learning_activities AS la ON la.id = aa.activity_id
WHERE aa.exam_attempt_id IS NULL AND la.course_id IS NOT NULL
ORDER BY rc.code, aa.created_at, aa.attempt_number, aa.id
"""

# Who, where and when only: never the hint text, its source or the request key.
HINTS_SQL = _LATEST_CONSENT + """
SELECT
    md5(rc.code || ':' || hu.id::text) AS id,
    rc.code AS student_id,
    hu.activity_id::text AS activity_id,
    la.course_id::text AS course_id,
    la.language::text AS language,
    hu.created_at
FROM public.hint_uses AS hu
JOIN latest_consent AS consent ON consent.student_id = hu.student_id
    AND consent.choice = 'accepted'
    AND consent.document_version = :current_consent_version
JOIN bytequest_private.research_codes AS rc ON rc.student_id = hu.student_id
JOIN public.learning_activities AS la ON la.id = hu.activity_id
WHERE la.course_id IS NOT NULL
ORDER BY rc.code, hu.created_at, hu.id
"""


def _write(db, sql: str, version: str, path: Path) -> int:
    result = db.execute(text(sql), {"current_consent_version": version})
    rows = result.all()
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(result.keys())  # headers even when empty: the trainer accepts a hint file with no rows
        writer.writerows(rows)
    return len(rows)


def export(out_dir: Path, *, version: str, session_factory=SessionLocal) -> tuple[int, int]:
    """Write attempts.csv and hints.csv into out_dir; returns their row counts."""
    if not version.strip():
        raise ValueError("RESEARCH_CONSENT_VERSION is empty, so no learner can have consented.")
    out_dir.mkdir(parents=True, exist_ok=True)
    with session_factory() as db:
        attempts = _write(db, ATTEMPTS_SQL, version, out_dir / "attempts.csv")
        hints = _write(db, HINTS_SQL, version, out_dir / "hints.csv")
    return attempts, hints


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--research-approved", action="store_true",
                        help="attest that institutional approval and consent are in place")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help=f"output folder (default {DEFAULT_OUT})")
    args = parser.parse_args()
    if not args.research_approved:
        parser.error("Real student data needs --research-approved after institutional approval.")
    if not settings.RESEARCH_CONSENT_ACTIVE:
        parser.error("RESEARCH_CONSENT_ACTIVE is off, so the study is closed.")
    attempts, hints = export(args.out, version=settings.RESEARCH_CONSENT_VERSION)
    print(f"Wrote {attempts} attempt rows and {hints} hint rows to {args.out} "
          f"(consent version {settings.RESEARCH_CONSENT_VERSION}).")


if __name__ == "__main__":
    main()
