"""Exercise the local Python demo without keeping student progress."""

from __future__ import annotations

from functools import partial

import anyio

from seed_local_python_quest_demo import ACTIVITY_ID, CHALLENGE_ID, GROUP_NAME, REFERENCE_SOLUTION
from smoke_local_quest_demo import smoke_demo_quest
from app.models.entities import ProgrammingLang


async def main() -> None:
    await anyio.to_thread.run_sync(partial(
        smoke_demo_quest,
        activity_id=ACTIVITY_ID,
        group_name=GROUP_NAME,
        language=ProgrammingLang.python,
        answers={"python-output": "A", "python-variable": "B", "python-function": "C"},
        challenge_id=CHALLENGE_ID,
        source_code=REFERENCE_SOLUTION,
    ))


if __name__ == "__main__":
    anyio.run(main)
