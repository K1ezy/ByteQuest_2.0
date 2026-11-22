"""Canonical feature extraction shared by model training and live inference.

The ten features and their order are the manuscript's (Chapter 3, data
preparation): every value is computed from the learner's graded attempts and
hint reveals strictly before the cutoff ``t0``. A value that is undefined
without history is returned as ``NaN`` so the fitted pipeline's median imputer
fills it, as the manuscript specifies; it is never silently zero.
"""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Any

import numpy as np
import pandas as pd


FEATURE_NAMES = (
    "prior_attempt_count",
    "prior_pass_rate",
    "prior_mean_score_ratio",
    "recent_3_pass_rate",
    "prior_compile_error_rate",
    "prior_runtime_error_rate",
    "mean_attempts_per_task",
    "prior_quiz_score_mean",
    "prior_hint_usage_rate",
    "days_since_last_attempt",
)
_SUCCESS_VALUES = {"1", "true", "t", "yes", "y", "success", "successful", "passed"}
# Categories and Judge0 status ids as classify_judge0_status assigns them:
# 4 is a wrong answer (logic), 5 a time limit, 6 a compile error, 7+ runtime.
_RUNTIME_ERRORS = {"runtime_error", "timeout"}
_COMPILE_STATUS = 6
_TIMEOUT_STATUS = 5
_FIRST_RUNTIME_STATUS = 7


def _as_bool(value: Any) -> bool:
    if isinstance(value, (bool, np.bool_)):
        return bool(value)
    if isinstance(value, (int, float, np.integer, np.floating)):
        return math.isfinite(float(value)) and float(value) == 1.0
    return str(value).strip().casefold() in _SUCCESS_VALUES


def _enum_value(value: Any) -> str | None:
    value = getattr(value, "value", value)
    return None if value is None else str(value).strip().casefold()


def _frame(rows: Any) -> pd.DataFrame:
    if rows is None:
        return pd.DataFrame()
    if isinstance(rows, pd.DataFrame):
        return rows.copy(deep=False)
    if isinstance(rows, Mapping):
        return pd.DataFrame([rows])
    if isinstance(rows, Sequence) and not isinstance(rows, (str, bytes)):
        return pd.DataFrame(list(rows))
    raise TypeError("History must be a DataFrame or a sequence of row mappings.")


def _before(frame: pd.DataFrame, cutoff: pd.Timestamp) -> pd.DataFrame:
    """Keep rows strictly before the cutoff, in chronological order."""
    if frame.empty:
        return frame
    if "created_at" not in frame.columns:
        raise ValueError("History rows need created_at so the cutoff can be enforced.")
    timestamps = pd.to_datetime(frame["created_at"], errors="coerce", utc=True)
    if timestamps.isna().any():
        raise ValueError("created_at must contain valid timestamps.")
    kept = frame.assign(_at=timestamps)[timestamps < cutoff]
    order = ["_at", *(column for column in ("attempt_number", "id") if column in kept.columns)]
    return kept.sort_values(order, kind="stable").reset_index(drop=True)


def _rate(mask: pd.Series) -> float:
    return float(mask.mean()) if len(mask) else math.nan


def _mean(values: pd.Series) -> float:
    values = pd.to_numeric(values, errors="coerce").clip(0, 100).dropna()
    return float(values.mean()) if not values.empty else math.nan


def extract_features_from_dataframe(
    prior_attempts: Any,
    *,
    cutoff: datetime | pd.Timestamp,
    hint_reveals: Any = None,
    target_activity_id: Any = None,
) -> dict[str, float]:
    """Return the ten features at ``cutoff``; use ``FEATURE_NAMES`` for column order.

    Callers pass the learner's graded, non-exam attempts in the target's course
    and language, and the learner's hint reveals there. Rows at or after the
    cutoff are discarded here, and hints on the target activity never count,
    so neither the target outcome nor anything after it can leak in.
    """
    cutoff_at = pd.Timestamp(cutoff)
    cutoff_at = cutoff_at.tz_localize("UTC") if cutoff_at.tzinfo is None else cutoff_at.tz_convert("UTC")
    attempts = _before(_frame(prior_attempts), cutoff_at)
    hints = _before(_frame(hint_reveals), cutoff_at)
    if target_activity_id is not None and not hints.empty:
        hints = hints[hints["activity_id"].astype(str) != str(target_activity_id)]

    count = len(attempts)
    if count:
        passed = attempts["is_successful"].map(_as_bool)
        kinds = attempts["activity_type"].map(_enum_value)
        coding = attempts[kinds == "challenge"]
        categories = coding.get("error_category", pd.Series(dtype=object)).fillna("").astype(str).str.strip().str.casefold()
        statuses = pd.to_numeric(coding.get("compiler_status_id", pd.Series(dtype=float)), errors="coerce")
        tasks = attempts["activity_id"].astype(str).nunique()
        days = (cutoff_at - attempts["_at"].iloc[-1]).total_seconds() / 86400
    else:
        passed = kinds = pd.Series(dtype=object)
        coding = attempts
        categories = statuses = pd.Series(dtype=object)
        tasks = 0
        days = math.nan

    features = {
        "prior_attempt_count": float(count),
        "prior_pass_rate": _rate(passed),
        "prior_mean_score_ratio": _mean(attempts["score_percentage"]) / 100 if count else math.nan,
        "recent_3_pass_rate": _rate(passed.tail(3)),
        "prior_compile_error_rate": _rate(
            (categories == "syntax_error") | (statuses == _COMPILE_STATUS)
        ) if len(coding) else math.nan,
        "prior_runtime_error_rate": _rate(
            categories.isin(_RUNTIME_ERRORS) | (statuses == _TIMEOUT_STATUS) | (statuses >= _FIRST_RUNTIME_STATUS)
        ) if len(coding) else math.nan,
        "mean_attempts_per_task": count / tasks if tasks else math.nan,
        "prior_quiz_score_mean": _mean(attempts.loc[kinds == "quiz", "score_percentage"]) if count else math.nan,
        "prior_hint_usage_rate": len(hints) / tasks if tasks else math.nan,
        "days_since_last_attempt": days,
    }
    # NaN marks "no history"; anything infinite would be a computation fault.
    return {name: float(features[name]) if math.isfinite(features[name]) else math.nan for name in FEATURE_NAMES}
