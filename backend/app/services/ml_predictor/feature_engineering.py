"""Canonical feature extraction shared by model training and live inference."""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence
from typing import Any

import numpy as np
import pandas as pd


FEATURE_NAMES = (
    "prior_attempts_total",
    "historical_pass_rate",
    "avg_attempts_per_success",
    "syntax_error_rate",
    "logic_and_runtime_error_rate",
    "avg_execution_time_ms",
    "avg_time_spent_seconds",
    "target_difficulty_level",
    "difficulty_delta",
    "preceding_quiz_score_pct",
)
BASELINE_DIFFICULTY = 2.0
_SUCCESS_VALUES = {"1", "true", "t", "yes", "y", "success", "successful", "passed"}
_FAILURE_VALUES = {"0", "false", "f", "no", "n", "failure", "failed", "unsuccessful"}
_LOGIC_RUNTIME_ERRORS = {"logic_error", "runtime_error", "timeout"}


def _as_float(value: Any, default: float = 0.0) -> float:
    """Convert a scalar to a finite float, treating missing and invalid data safely."""
    try:
        if value is None or pd.isna(value):
            return default
        number = float(value)
    except (TypeError, ValueError, OverflowError):
        return default
    return number if math.isfinite(number) else default


def _as_bool(value: Any) -> bool:
    if isinstance(value, (bool, np.bool_)):
        return bool(value)
    if isinstance(value, (int, float, np.integer, np.floating)):
        return math.isfinite(float(value)) and float(value) == 1.0
    normalized = str(value).strip().casefold()
    if normalized in _SUCCESS_VALUES:
        return True
    if normalized in _FAILURE_VALUES:
        return False
    return False


def _enum_value(value: Any) -> str | None:
    value = getattr(value, "value", value)
    return None if value is None else str(value).strip().casefold()


def _prepare_frame(prior_attempts: Any) -> pd.DataFrame:
    if prior_attempts is None:
        return pd.DataFrame()
    if isinstance(prior_attempts, pd.DataFrame):
        return prior_attempts.copy(deep=False)
    if isinstance(prior_attempts, Mapping):
        return pd.DataFrame([prior_attempts])
    if isinstance(prior_attempts, Sequence) and not isinstance(prior_attempts, (str, bytes)):
        return pd.DataFrame(prior_attempts)
    raise TypeError("prior_attempts must be a DataFrame or a sequence of row mappings")


def _ordered_history(frame: pd.DataFrame) -> pd.DataFrame:
    if "created_at" in frame.columns:
        timestamps = pd.to_datetime(frame["created_at"], errors="coerce", utc=True)
        if timestamps.isna().any():
            raise ValueError(
                "created_at must contain valid timestamps when chronological history is supplied."
            )
        ordered = frame.assign(_feature_order_timestamp=timestamps)
        sort_columns = ["_feature_order_timestamp"]
        sort_columns.extend(
            column for column in ("attempt_number", "id") if column in frame.columns
        )
        return ordered.sort_values(sort_columns, kind="stable").drop(
            columns="_feature_order_timestamp"
        )
    return frame


def _mean_nonnegative(frame: pd.DataFrame, column: str) -> float:
    if column not in frame.columns:
        return 0.0
    values = pd.to_numeric(frame[column], errors="coerce").replace([np.inf, -np.inf], np.nan)
    values = values[values >= 0].dropna()
    return float(values.mean()) if not values.empty else 0.0


def _attempts_per_success(frame: pd.DataFrame, successes: pd.Series) -> float:
    if "activity_id" not in frame.columns:
        return float(len(frame) / max(int(successes.sum()), 1)) if successes.any() else 0.0

    work = frame.assign(_successful=successes.to_numpy())
    work = work[work["activity_id"].notna()]
    attempts_until_success: list[int] = []
    for _, activity_attempts in work.groupby("activity_id", sort=False, dropna=True):
        success_positions = np.flatnonzero(activity_attempts["_successful"].to_numpy(dtype=bool))
        if success_positions.size:
            attempts_until_success.append(int(success_positions[0]) + 1)
    return float(np.mean(attempts_until_success)) if attempts_until_success else 0.0


def _preceding_quiz_score(frame: pd.DataFrame, fallback: Any) -> float:
    if "activity_type" in frame.columns and "score_percentage" in frame.columns:
        activity_types = frame["activity_type"].map(_enum_value)
        quiz_scores = frame.loc[activity_types == "quiz", "score_percentage"]
        for score in reversed(quiz_scores.tolist()):
            if score is not None and not pd.isna(score):
                return min(100.0, max(0.0, _as_float(score)))
    return min(100.0, max(0.0, _as_float(fallback)))


def extract_features_from_dataframe(
    prior_attempts: Any,
    target_difficulty: Any,
    preceding_quiz_score_pct: Any = 0.0,
    *,
    target_language: Any = None,
    target_topic: Any = None,
) -> dict[str, float]:
    """Extract finite features; callers use ``FEATURE_NAMES`` for column order.

    ``prior_attempts`` must contain only events that occurred before the target
    outcome. When language or topic columns are present, optional target values
    restrict historical features to the same curriculum track and concept.
    Missing telemetry is treated as zero; malformed and non-finite values never
    escape into the model input.
    """
    frame = _ordered_history(_prepare_frame(prior_attempts))

    for column, target in (("language", target_language), ("topic_concept", target_topic)):
        if target is not None and column in frame.columns:
            expected = _enum_value(target)
            frame = frame[frame[column].map(_enum_value) == expected]

    frame = frame.reset_index(drop=True)
    target_level = _as_float(target_difficulty, BASELINE_DIFFICULTY)
    if not 1.0 <= target_level <= 5.0:
        target_level = BASELINE_DIFFICULTY

    if frame.empty:
        successful = pd.Series(dtype=bool)
        syntax_count = 0
        logic_runtime_count = 0
    else:
        successful = (
            frame["is_successful"].map(_as_bool)
            if "is_successful" in frame.columns
            else pd.Series(False, index=frame.index, dtype=bool)
        )
        categories = (
            frame["error_category"].fillna("").astype(str).str.strip().str.casefold()
            if "error_category" in frame.columns
            else pd.Series("", index=frame.index, dtype=str)
        )
        status_ids = (
            pd.to_numeric(frame["compiler_status_id"], errors="coerce").replace(
                [np.inf, -np.inf], np.nan
            )
            if "compiler_status_id" in frame.columns
            else pd.Series(np.nan, index=frame.index)
        )
        syntax_count = int(((categories == "syntax_error") | (status_ids == 6)).sum())
        status_logic_runtime = status_ids.isin([4, 5]) | (status_ids >= 7)
        logic_runtime_count = int(
            (categories.isin(_LOGIC_RUNTIME_ERRORS) | status_logic_runtime).sum()
        )

    attempts_count = len(frame)
    success_count = int(successful.sum()) if attempts_count else 0
    score_pct = _preceding_quiz_score(frame, preceding_quiz_score_pct)
    features = {
        "prior_attempts_total": float(attempts_count),
        "historical_pass_rate": success_count / attempts_count if attempts_count else 0.0,
        "avg_attempts_per_success": _attempts_per_success(frame, successful),
        "syntax_error_rate": syntax_count / attempts_count if attempts_count else 0.0,
        "logic_and_runtime_error_rate": (
            logic_runtime_count / attempts_count if attempts_count else 0.0
        ),
        "avg_execution_time_ms": _mean_nonnegative(frame, "execution_time_ms"),
        "avg_time_spent_seconds": _mean_nonnegative(frame, "time_spent_seconds"),
        "target_difficulty_level": target_level,
        "difficulty_delta": target_level - BASELINE_DIFFICULTY,
        "preceding_quiz_score_pct": score_pct,
    }
    return {name: _as_float(features[name]) for name in FEATURE_NAMES}


def extract_student_features(
    prior_attempts: Any,
    preceding_quiz_score: Any = 0.0,
) -> dict[str, float]:
    """Compatibility wrapper for earlier callers of the feature module."""
    return extract_features_from_dataframe(
        prior_attempts,
        target_difficulty=BASELINE_DIFFICULTY,
        preceding_quiz_score_pct=preceding_quiz_score,
    )


def feature_dict_to_vector(features: Mapping[str, Any]) -> list[float]:
    """Convert a mapping into the canonical model feature order."""
    return [_as_float(features.get(name)) for name in FEATURE_NAMES]
