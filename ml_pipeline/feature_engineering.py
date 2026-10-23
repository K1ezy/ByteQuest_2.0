"""
Feature Engineering Module (Rule 5)
Shared between offline training (ml_pipeline/train_compare.py) 
and online inference (backend/app/services/ml_predictor/).
Prevents train-serve skew.
"""

from typing import Any, Dict, List
import numpy as np


FEATURE_NAMES = [
    "historical_pass_rate",
    "avg_attempts_per_task",
    "syntax_error_ratio",
    "logic_error_ratio",
    "mean_execution_time_ms",
    "mean_time_spent_seconds",
    "preceding_quiz_score_pct",
]


def extract_student_features(
    prior_attempts: List[Dict[str, Any]],
    preceding_quiz_score: float = 0.0,
) -> Dict[str, float]:
    """
    Computes prior performance features for a student before task T_n:
    1. Historical task pass rate on the current language/concept
    2. Average attempts per task prior to completion
    3. Syntax/compilation error rate vs logic error rate
    4. Mean execution time & time spent on previous k tasks
    5. Preceding topic quiz score percentage
    """
    if not prior_attempts:
        return {
            "historical_pass_rate": 0.0,
            "avg_attempts_per_task": 1.0,
            "syntax_error_ratio": 0.0,
            "logic_error_ratio": 0.0,
            "mean_execution_time_ms": 0.0,
            "mean_time_spent_seconds": 0.0,
            "preceding_quiz_score_pct": float(preceding_quiz_score),
        }

    total_attempts = len(prior_attempts)
    successful_attempts = sum(1 for a in prior_attempts if a.get("is_successful"))
    historical_pass_rate = successful_attempts / total_attempts if total_attempts > 0 else 0.0

    # Group attempts by activity_id to calculate avg attempts per activity
    activity_counts: Dict[str, int] = {}
    for a in prior_attempts:
        act_id = str(a.get("activity_id"))
        activity_counts[act_id] = activity_counts.get(act_id, 0) + 1

    avg_attempts = float(np.mean(list(activity_counts.values()))) if activity_counts else 1.0

    # Judge0 Status: 6 = Compilation Error, 5 = Time Limit, 4 = Wrong Answer, 3 = Accepted
    syntax_errors = sum(1 for a in prior_attempts if a.get("compiler_status_id") == 6)
    logic_errors = sum(
        1 for a in prior_attempts 
        if not a.get("is_successful") and a.get("compiler_status_id") != 6
    )

    syntax_ratio = syntax_errors / total_attempts if total_attempts > 0 else 0.0
    logic_ratio = logic_errors / total_attempts if total_attempts > 0 else 0.0

    exec_times = [
        float(a.get("execution_time_ms", 0.0)) 
        for a in prior_attempts 
        if a.get("execution_time_ms") is not None
    ]
    mean_exec_time = float(np.mean(exec_times)) if exec_times else 0.0

    time_spents = [
        float(a.get("time_spent_seconds", 0.0)) 
        for a in prior_attempts 
        if a.get("time_spent_seconds") is not None
    ]
    mean_time_spent = float(np.mean(time_spents)) if time_spents else 0.0

    return {
        "historical_pass_rate": round(historical_pass_rate, 4),
        "avg_attempts_per_task": round(avg_attempts, 4),
        "syntax_error_ratio": round(syntax_ratio, 4),
        "logic_error_ratio": round(logic_ratio, 4),
        "mean_execution_time_ms": round(mean_exec_time, 2),
        "mean_time_spent_seconds": round(mean_time_spent, 2),
        "preceding_quiz_score_pct": round(float(preceding_quiz_score), 4),
    }


def feature_dict_to_vector(features: Dict[str, float]) -> List[float]:
    """Converts the extracted dictionary into an ordered feature vector."""
    return [features.get(name, 0.0) for name in FEATURE_NAMES]
