import pytest

from app.services.pass_mark import EXAM_PASS_MARK, PRACTICE_PASS_MARK, submission_passes


@pytest.mark.parametrize(
    ("all_passed", "score", "mark", "default", "expected"),
    [
        # No pass mark set: today's rules, unchanged.
        (True, 100.0, None, PRACTICE_PASS_MARK, True),
        (False, 99.0, None, PRACTICE_PASS_MARK, False),
        # A tiny-weight failure can round to 100.0; it must still fail at 100.
        (False, 100.0, None, PRACTICE_PASS_MARK, False),
        (False, 80.0, None, EXAM_PASS_MARK, True),
        (False, 79.99, None, EXAM_PASS_MARK, False),
        # A lower mark, and the exact boundary.
        (False, 66.67, 60, PRACTICE_PASS_MARK, True),
        (False, 60.0, 60, PRACTICE_PASS_MARK, True),
        (False, 59.99, 60, PRACTICE_PASS_MARK, False),
        # An explicit 100 on an exam means every test.
        (False, 100.0, 100, EXAM_PASS_MARK, False),
        (True, 100.0, 100, EXAM_PASS_MARK, True),
    ],
)
def test_submission_passes(all_passed, score, mark, default, expected):
    assert submission_passes(
        all_passed=all_passed, score_percentage=score, pass_mark_percent=mark, default_mark=default,
    ) is expected
