"""Shared decision thresholds for the offline trainer and the live predictor.

Both ``ml_pipeline/train_compare.py`` and the prediction service import these,
so a reported metric and a served prediction can never disagree about where a
predicted pass begins. ``DECISION_THRESHOLD`` is the single boundary every
threshold-dependent metric in the thesis is computed at. The advisory band
bounds are a separate sequencing concern: they never change how an outcome is
classified, and they never reach the reported comparison metrics.
"""

from __future__ import annotations

# Classification boundary for the binary pass/fail outcome. Accuracy,
# precision, recall, F1 and the confusion matrix are all computed at exactly
# this probability, offline and online alike.
DECISION_THRESHOLD = 0.50

# Advisory banding for next-task guidance only. Deliberately wider than
# DECISION_THRESHOLD so that a borderline probability suggests ordinary
# practice instead of flipping between advancement and remediation.
ADVANCE_PROBABILITY = 0.60
REMEDIAL_PROBABILITY = 0.40

if not REMEDIAL_PROBABILITY <= DECISION_THRESHOLD <= ADVANCE_PROBABILITY:
    raise ValueError(
        "Advisory bands must bracket the decision threshold; otherwise a "
        "prediction could be classified as passing while being routed to "
        "remediation."
    )


def classify_success(probability: float) -> bool:
    """Return the binary pass prediction at the reported decision threshold."""
    return probability >= DECISION_THRESHOLD


def recommended_action(probability: float) -> str:
    """Map a success probability onto its advisory next-task band."""
    if probability >= ADVANCE_PROBABILITY:
        return "advance_next_level"
    if probability >= REMEDIAL_PROBABILITY:
        return "standard_next"
    return "remedial_practice"
