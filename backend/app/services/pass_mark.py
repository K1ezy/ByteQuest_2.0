"""When an official challenge submission counts as passed.

The one place both grading paths decide a pass. XP, solve stars, the Codex,
badges, the recap and the insights all read the resulting is_successful.
"""

from __future__ import annotations

from app.services.gamification.sequencer import CHALLENGE_MASTERY_SCORE

# Defaults when an instructor sets no pass mark: they are today's rules.
PRACTICE_PASS_MARK = 100.0
EXAM_PASS_MARK = CHALLENGE_MASTERY_SCORE


def submission_passes(
    *, all_passed: bool, score_percentage: float, pass_mark_percent: int | None, default_mark: float,
) -> bool:
    """A mark of 100 means every test passes; below that, the weighted score must reach it.

    Comparing all_passed at 100 (not the rounded score) keeps a case with a tiny
    weight from rounding a failure up to 100%.
    """
    mark = default_mark if pass_mark_percent is None else float(pass_mark_percent)
    return all_passed if mark >= 100 else float(score_percentage) >= mark
