"""Pure Mastery Memory rules: recall size and the two-thirds pass bar."""

import pytest

from app.services.gamification.memory import MIN_REVIEW_SIZE, REVIEW_SIZE, review_passed, review_size


@pytest.mark.parametrize(("pool", "size"), [(3, 3), (4, 4), (9, 4)])
def test_review_size_uses_up_to_four_questions(pool, size):
    assert review_size(pool) == size
    assert MIN_REVIEW_SIZE <= review_size(pool) <= REVIEW_SIZE


@pytest.mark.parametrize(("correct", "total", "passed"), [
    (4, 4, True), (3, 4, True), (2, 4, False),  # same outcome as the 75% quiz mastery bar
    (3, 3, True), (2, 3, True), (1, 3, False), (0, 3, False),
])
def test_review_passes_at_two_thirds(correct, total, passed):
    assert review_passed(correct, total) is passed
