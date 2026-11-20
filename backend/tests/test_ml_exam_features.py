"""Chronological exam features and selected-model presentation."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from ml_pipeline.train_compare import prepare_ml_dataset

from app.api.faculty_ml import _forecast
from app.core.config import settings
from app.services.ml_predictor import predictor


def test_exam_inputs_only_appear_after_release_in_the_same_course():
    rows = []
    for index, (day, success) in enumerate(((1, False), (3, True)), 1):
        rows.append({
            "id": f"attempt{index}", "student_id": "learneralpha", "activity_id": f"activity{index}",
            "course_id": "coursealpha", "attempt_number": 1,
            "created_at": f"2026-01-{day:02d}T12:00:00Z", "language": "python",
            "topic_concept": "loops", "activity_type": "quiz", "difficulty_level": 1,
            "is_successful": success, "score_percentage": 80 if success else 30,
            "error_category": "none", "compiler_status_id": None,
            "execution_time_ms": None, "time_spent_seconds": 20,
        })
    exams = pd.DataFrame([
        {"student_id": "learneralpha", "course_id": "coursealpha", "exam_attempt_id": "examone",
         "released_at": "2026-01-02T12:00:00Z", "score_percentage": 75},
        {"student_id": "learneralpha", "course_id": "coursebeta", "exam_attempt_id": "examtwo",
         "released_at": "2026-01-02T12:00:00Z", "score_percentage": 100},
        {"student_id": "learneralpha", "course_id": "coursealpha", "exam_attempt_id": "examthree",
         "released_at": "2026-01-04T12:00:00Z", "score_percentage": 10},
    ])
    features, labels, groups = prepare_ml_dataset(pd.DataFrame(rows), exams)
    assert features["released_exam_count"].tolist() == [0.0, 1.0]
    assert features["released_exam_average_score_pct"].tolist() == [0.0, 75.0]
    assert labels.tolist() == [0, 1]
    assert groups.tolist() == ["learneralpha", "learneralpha"]


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


def test_older_feature_schema_artifacts_are_rejected(tmp_path, monkeypatch):
    run = tmp_path / "runs" / "old-version"
    run.mkdir(parents=True)
    (tmp_path / "active_model.json").write_text(json.dumps({
        "artifact_directory": "runs/old-version", "model_version": "old-version",
    }), encoding="utf-8")
    (run / "model_metadata.json").write_text(json.dumps({
        "model_version": "old-version", "schema_version": 1,
    }), encoding="utf-8")
    monkeypatch.setattr(settings, "ML_ARTIFACTS_DIR", str(tmp_path))
    monkeypatch.setattr(predictor, "_model_bundle", None)
    monkeypatch.setattr(predictor, "_model_load_error", None)
    with pytest.raises(predictor.ModelArtifactError, match="metadata schema is unsupported"):
        predictor.load_ml_models()


def test_training_rejects_ids_that_encode_an_account():
    from ml_pipeline.train_compare import _validate_training_frame

    row = {
        "id": "row1", "student_id": f"stu_{uuid4().hex}", "activity_id": "activity1", "attempt_number": 1,
        "created_at": "2026-01-01T12:00:00Z", "language": "python", "topic_concept": "loops",
        "activity_type": "quiz", "difficulty_level": 1, "is_successful": True, "score_percentage": 90,
        "error_category": "none", "compiler_status_id": None, "execution_time_ms": None,
        "time_spent_seconds": 60,
    }
    with pytest.raises(ValueError, match="encodes an account id"):
        _validate_training_frame(pd.DataFrame([row]))
    row["student_id"] = "rs_3f2a9c0d1e4b5a6c7d8e"
    assert len(_validate_training_frame(pd.DataFrame([row]))) == 1
