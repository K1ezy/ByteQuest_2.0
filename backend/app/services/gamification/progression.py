"""Shared XP and level progression rules."""

from app.models.entities import Profile

XP_PER_LEVEL = 250


def grant_xp(student: Profile, amount: int) -> int:
    """Apply non-negative XP and keep the student's level in sync."""
    awarded = max(0, int(amount or 0))
    student.xp_points = max(0, int(student.xp_points or 0)) + awarded
    student.current_level = (student.xp_points // XP_PER_LEVEL) + 1
    return awarded
