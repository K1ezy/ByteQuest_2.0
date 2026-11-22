"""Verify the published C++ and Java starter tracks with disposable local learners."""

import asyncio
import uuid

import httpx

import qa_live_multi_role as qa
from scripts.pilot_foundations import QUIZZES, challenge_specs, foundation_id


async def main() -> None:
    api = qa.api_base()
    qa.require_local(api)
    qa.STATE_FILE = qa.QA_DIR / "starter-track-accounts.json"
    if qa.STATE_FILE.exists():
        raise SystemExit("An earlier starter-track fixture still needs cleanup.")
    run = "".join(chr(97 + int(digit, 16)) for digit in uuid.uuid4().hex[:8])
    state = {"run": run, "accounts": []}
    qa.save_state(state)
    try:
        qa.create_accounts(run, 2, state)
        learners = [item for item in state["accounts"] if item["role"] == "student" and not item["outside_course"]]
        async with httpx.AsyncClient(timeout=60, trust_env=False) as client:
            session = qa.Session(client, api)
            for (language, quiz_title, quiz), profile in zip(QUIZZES, learners, strict=True):
                token = qa.signed_token(profile["id"])
                await session.call(token, "PUT", "/profile/onboarding", student=True,
                                   json={"enrolled_language": language.value, "year_level": 1, "semester": 1})
                before = (await session.call(token, "GET", "/quests", student=True)).json()
                cards = {quest["id"]: quest for quest in before}
                completed = []
                for lang, title, _, _, cases, (_, reference, _) in challenge_specs():
                    if lang != language:
                        continue
                    card = cards[str(foundation_id(language, title))]
                    assert card["title"] == title
                    sample, _ = await session.graded(token, card["id"], reference, dry_run=True)
                    assert sample["evaluation"]["passed_test_cases"] == 2
                    assert sample["evaluation"]["total_test_cases"] == 2
                    assert sample["evaluation"]["hidden_summary"]["total"] == 0
                    result, _ = await session.graded(token, card["id"], reference, dry_run=False)
                    assert result["xp_awarded"] == 30 and result["evaluation"]["passed_test_cases"] == len(cases)
                    assert result["evaluation"]["hidden_summary"] == {"passed": len(cases) - 2, "total": len(cases) - 2}
                    assert all(not case["is_hidden"] for case in result["evaluation"]["test_results"])
                    completed.append(card["id"])
                quiz_card = cards[str(foundation_id(language, "quiz"))]
                assert quiz_card["title"] == quiz_title
                assert "correct_answer" not in str(quiz_card)
                grade = await session.call(token, "POST", "/quests/submit-quiz", student=True,
                                           json={"activity_id": quiz_card["id"], "answers": {
                                               item["id"]: item["correct_answer"] for item in quiz["questions"]}})
                assert grade.json()["xp_awarded"] == 25
                completed.append(quiz_card["id"])
                after = (await session.call(token, "GET", "/quests", student=True)).json()
                assert set(completed).issubset(item["id"] for item in after if item["is_completed"])
                assert not session.failures, session.failures
                print(f"PASS {language.value}: 3 sample runs, 3 official grades, quiz, 115 activity XP, completion, and hidden-case masking.")
    finally:
        qa.cleanup()


if __name__ == "__main__":
    asyncio.run(main())
