"""Training rows, features, report helpers and selected-model presentation."""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from ml_pipeline.train_compare import (
    _adequacy,
    _bootstrap_intervals,
    _validate_training_frame,
    prepare_ml_dataset,
)

from app.api.faculty_ml import _forecast
from app.core.config import settings
from app.services.ml_predictor import predictor
from app.services.ml_predictor.feature_engineering import FEATURE_NAMES


def _attempt(row_id, activity, kind, day, passed, *, attempt=1, course="coursealpha", error="none", status=None):
    return {
        "id": row_id, "student_id": "learneralpha", "activity_id": activity, "course_id": course,
        "attempt_number": attempt, "created_at": f"2026-01-{day:02d}T12:00:00Z", "language": "python",
        "activity_type": kind, "is_successful": passed, "score_percentage": 100 if passed else 20,
        "error_category": error, "compiler_status_id": status,
    }


def test_rows_are_first_submissions_on_challenges_with_strictly_prior_history():
    attempts = pd.DataFrame([
        _attempt("a1", "quiz1", "quiz", 1, True),
        _attempt("a2", "loop", "challenge", 2, False, error="syntax_error", status=6),
        _attempt("a3", "loop", "challenge", 3, True, attempt=2, status=3),
        _attempt("a4", "other", "challenge", 2, True, course="coursebeta", status=3),
        _attempt("a5", "func", "challenge", 5, False, error="runtime_error", status=11),
    ])
    hints = pd.DataFrame([
        {"id": "h1", "student_id": "learneralpha", "activity_id": "func", "course_id": "coursealpha",
         "language": "python", "created_at": "2026-01-04T12:00:00Z"},
        {"id": "h2", "student_id": "learneralpha", "activity_id": "loop", "course_id": "coursealpha",
         "language": "python", "created_at": "2026-01-01T18:00:00Z"},
    ])
    features, labels, groups, eligible = prepare_ml_dataset(attempts, hints, min_history=2)

    # One row per learner and challenge: the retry and the quiz are never targets.
    assert labels.tolist() == [0, 1, 0]
    assert groups.tolist() == ["learneralpha"] * 3
    loop, other, func = (features.iloc[i] for i in range(3))
    # The first loop submission sees only the quiz; its own hint never counts.
    assert loop["prior_attempt_count"] == 1 and loop["prior_quiz_score_mean"] == 100
    assert math.isnan(loop["prior_hint_usage_rate"]) is False and loop["prior_hint_usage_rate"] == 0
    assert math.isnan(loop["prior_compile_error_rate"])
    # The other course's challenge has no history: a cold-start row of blanks.
    assert other["prior_attempt_count"] == 0
    assert all(math.isnan(other[name]) for name in FEATURE_NAMES if name != "prior_attempt_count")
    # The func row sees the quiz and both loop attempts, but not its own hint.
    assert func["prior_attempt_count"] == 3
    assert func["mean_attempts_per_task"] == 1.5
    assert func["prior_compile_error_rate"] == 0.5
    assert func["prior_hint_usage_rate"] == 0.5
    assert func["days_since_last_attempt"] == 2.0
    assert eligible.tolist() == [False, False, True]


def test_hint_exports_reject_identifying_columns():
    attempts = pd.DataFrame([_attempt("a1", "loop", "challenge", 1, True), _attempt("a2", "x", "challenge", 2, False)])
    hints = pd.DataFrame([{"id": "h1", "student_id": "learneralpha", "activity_id": "loop", "course_id": "c",
                           "language": "python", "created_at": "2026-01-01T00:00:00Z", "body": "the hint text"}])
    prepare_ml_dataset(attempts, hints)  # Extra non-identifying columns are dropped, never read.
    with pytest.raises(ValueError, match="identifying"):
        prepare_ml_dataset(attempts, hints.assign(email="a@b.c"))
    with pytest.raises(ValueError, match="encodes an account id"):
        prepare_ml_dataset(attempts, hints.assign(student_id=f"stu_{uuid4().hex}"))


def test_bootstrap_intervals_are_reproducible_and_resample_learners():
    rng = np.random.default_rng(0)
    groups = np.repeat([f"learner{i}" for i in range(8)], 10)
    y = rng.integers(0, 2, len(groups))
    probabilities = np.clip(y * 0.6 + rng.uniform(0, 0.4, len(groups)), 0, 1)
    first = _bootstrap_intervals(y, probabilities, groups, n_resamples=200, seed=42)
    assert first == _bootstrap_intervals(y, probabilities, groups, n_resamples=200, seed=42)
    assert first["n_resamples"] == 200 and first["level"] == 0.95
    for interval in first["metrics"].values():
        # sklearn's Average Precision can exceed 1.0 by one float ulp.
        assert 0 <= interval["low"] <= interval["high"] <= 1 + 1e-9
    # A single learner with one outcome can only produce single-class resamples.
    lone = _bootstrap_intervals(np.ones(5, dtype=int), np.full(5, 0.7), np.array(["solo"] * 5), n_resamples=20)
    assert lone["skipped_single_class"] == 20 and lone["metrics"]["accuracy"] is None


def test_adequacy_flags_a_small_test_partition():
    small = _adequacy(np.array([0, 1] * 10), np.repeat(["a", "b", "c", "d", "e"], 4))
    assert small["met"] is False and small["test_learners"] == 5
    enough = _adequacy(np.array([0, 1] * 20), np.repeat([f"l{i}" for i in range(8)], 5))
    assert enough["met"] is True and enough["test_rows_per_class"] == {"unsuccessful": 20, "successful": 20}


def test_faculty_forecast_uses_the_recorded_winner_and_hides_legacy_probability():
    target = SimpleNamespace(id=uuid4(), title="Next quiz", topic_concept="loops")
    prediction = SimpleNamespace(id=uuid4(), selected_model="random_forest", logreg_prob=0.1,
                                 rf_prob=0.8, model_version="v2", created_at=None, actual_outcome=None)
    forecast = _forecast(prediction, target)
    assert forecast["probability"] == 0.8
    assert forecast["probabilities"] == {"logreg": 0.1, "random_forest": 0.8}
    assert forecast["label"] == "Likely to pass"
    assert forecast["predicted_pass"] is True
    prediction.rf_prob = 0.5
    assert _forecast(prediction, target)["label"] == "Continue practicing"
    assert _forecast(prediction, target)["predicted_pass"] is True
    prediction.selected_model = None
    assert _forecast(prediction, target) is None


@pytest.mark.parametrize("schema_version", [1, 2])
def test_older_feature_schema_artifacts_are_rejected(tmp_path, monkeypatch, schema_version):
    run = tmp_path / "runs" / "old-version"
    run.mkdir(parents=True)
    (tmp_path / "active_model.json").write_text(json.dumps({
        "artifact_directory": "runs/old-version", "model_version": "old-version",
    }), encoding="utf-8")
    (run / "model_metadata.json").write_text(json.dumps({
        "model_version": "old-version", "schema_version": schema_version,
    }), encoding="utf-8")
    monkeypatch.setattr(settings, "ML_ARTIFACTS_DIR", str(tmp_path))
    monkeypatch.setattr(predictor, "_model_bundle", None)
    monkeypatch.setattr(predictor, "_model_load_error", None)
    with pytest.raises(predictor.ModelArtifactError, match="metadata schema is unsupported"):
        predictor.load_ml_models()


def test_training_rejects_ids_that_encode_an_account():
    row = _attempt("row1", "activity1", "quiz", 1, True) | {"student_id": f"stu_{uuid4().hex}"}
    with pytest.raises(ValueError, match="encodes an account id"):
        _validate_training_frame(pd.DataFrame([row]))
    row["student_id"] = "rs_3f2a9c0d1e4b5a6c7d8e"
    assert len(_validate_training_frame(pd.DataFrame([row]))) == 1
