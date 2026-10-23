"""Compatibility exports for the canonical backend feature extractor."""

from pathlib import Path
import sys

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.ml_predictor.feature_engineering import (  # noqa: E402
    FEATURE_NAMES,
    extract_features_from_dataframe,
    extract_student_features,
    feature_dict_to_vector,
)

__all__ = [
    "FEATURE_NAMES",
    "extract_features_from_dataframe",
    "extract_student_features",
    "feature_dict_to_vector",
]
