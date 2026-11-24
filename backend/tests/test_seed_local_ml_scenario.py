"""The synthetic ML scenario's simulation, without a database."""

from __future__ import annotations

import uuid

import numpy as np

from scripts import seed_local_ml_scenario as scenario


def test_usernames_are_letters_only_and_unique() -> None:
    names = {f"{scenario.PREFIX}{stem}{scenario._letters(n)}"
             for _, _, _, stem, _, _ in scenario.SECTIONS.values() for n in range(scenario.STUDENTS_PER_SECTION)}
    assert len(names) == 4 * scenario.STUDENTS_PER_SECTION
    assert all(name.isalpha() and name.islower() and 3 <= len(name) <= 44 for name in names)


def test_simulated_history_is_chronological_and_retries_stop_at_a_pass() -> None:
    plan = [{"kind": "quiz", "id": uuid.uuid4(), "difficulty": 1}] + [
        {"kind": "challenge", "id": uuid.uuid4(), "difficulty": d} for d in (1, 2, 3, 4)]
    rng = np.random.default_rng(1)
    for _ in range(50):
        attempts, hints = scenario._simulate(rng, uuid.uuid4(), plan, mean=0.0)
        times = [row["at"] for row in attempts]
        assert times == sorted(times) and len(set(times)) == len(times)
        for task in plan:
            rows = [row for row in attempts if row["activity"] == task["id"]]
            assert [row["number"] for row in rows] == list(range(1, len(rows) + 1))
            assert not any(row["passed"] for row in rows[:-1])  # nothing after a pass
            assert all(row["category"] == "none" for row in rows if row["passed"])
            assert all(row["category"] != "none" for row in rows if not row["passed"] and task["kind"] == "challenge")
        assert all(hint["activity"] in {t["id"] for t in plan if t["kind"] == "challenge"} for hint in hints)
