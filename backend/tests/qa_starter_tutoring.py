"""Exercise C++ and Java compiler and loop tutoring with synthetic local readers."""

import argparse
import asyncio
import json
import secrets
import string
from uuid import UUID

import httpx
import pymupdf
from sqlalchemy import delete

import qa_live_multi_role as qa
from app.models.entities import InstructionalDocument, LearningActivity, ProcessingJob
from app.services.storage.supabase_storage import StorageError, pdf_storage
from scripts.evaluate_ai_tutor import TutorCase, _evaluate
from scripts.pilot_foundations import challenge_specs


LESSONS = {
    "Classify a Number": (
        "First Error Check",
        "Compile first. Read the first compiler message before changing the program. Check the line just before the highlighted location for a missing semicolon or delimiter. Correct one syntax issue and rerun the sample before reasoning about conditions.",
        "syntax_error",
    ),
    "Count Positive Numbers": (
        "Zero Trace Check",
        "Trace the running count with positive, zero, and negative input in the same example. In 3, 0, -1, only 3 adds to the count. Zero and negative values leave the count unchanged. When n is zero, the loop does not read a value and the count remains zero.",
        "logic_error",
    ),
}


def reader(title: str, marker: str, rule: str, statement: str) -> bytes:
    with pymupdf.open() as pdf:
        for text in (f"{title}\n\n{marker}\n\n{rule}\n\nUse one small input to check an assumption before editing the code.",
                     f"{title}: practice\n\n{statement}\n\nWrite down what each input should do before running the sample."):
            page = pdf.new_page()
            assert page.insert_textbox(pymupdf.Rect(50, 55, 520, 650), text, fontsize=12) >= 0
        return pdf.tobytes()


def evaluate(api: str, token: str, case: TutorCase, run_id: str) -> list[dict]:
    with httpx.Client(base_url=f"{api}/", timeout=45, trust_env=False,
                      headers={"Authorization": f"Bearer {token}"}) as client:
        return list(_evaluate(client, case, run_id))


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cleanup", action="store_true")
    parser.add_argument("--language", choices=("cpp", "java"))
    parser.add_argument("--error-category", choices=("syntax_error", "logic_error"))
    args = parser.parse_args()
    api = qa.api_base()
    qa.require_local(api)
    qa.STATE_FILE = qa.QA_DIR / "starter-tutoring-accounts.json"
    if args.cleanup:
        if qa.STATE_FILE.exists():
            await cleanup(json.loads(qa.STATE_FILE.read_text(encoding="utf-8")))
        return
    if qa.STATE_FILE.exists():
        raise SystemExit("An earlier tutoring fixture still needs cleanup.")
    run_id = "".join(secrets.choice(string.ascii_lowercase) for _ in range(6))
    state = {"run": run_id, "accounts": [], "materials": []}
    languages = (args.language,) if args.language else ("cpp", "java")
    qa.save_state(state)
    try:
        qa.create_accounts(run_id, len(languages), state)
        admin, instructor = (qa.signed_token(next(account["id"] for account in state["accounts"] if account["role"] == role))
                             for role in ("admin", "instructor"))
        learners = [account for account in state["accounts"] if account["role"] == "student" and not account["outside_course"]]
        async with httpx.AsyncClient(timeout=120, trust_env=False) as client:
            session = qa.Session(client, api)
            course = (await session.call(admin, "POST", "/admin/courses", json={
                "title": "Synthetic starter tutoring", "code": f"QA-{run_id}"})).json()["course"]["id"]
            state["course_id"] = course
            qa.save_state(state)
            for profile in state["accounts"]:
                if profile["role"] != "admin" and not profile["outside_course"]:
                    await session.call(admin, "POST", "/admin/assignments", json={
                        "profile_id": profile["id"], "course_id": course, "member_role": profile["role"]})
            output = qa.QA_DIR / f"starter-tutoring-{run_id}.jsonl"
            with output.open("x", encoding="utf-8") as evidence:
                for language, learner in zip(languages, learners, strict=True):
                    token = qa.signed_token(learner["id"])
                    await session.call(token, "PUT", "/profile/onboarding", json={
                        "enrolled_language": language, "year_level": 1, "semester": 1})
                    for lang, title, topic, statement, tests, (starter, reference, wrong) in challenge_specs():
                        if lang.value != language or title not in LESSONS:
                            continue
                        marker, rule, category = LESSONS[title]
                        if args.error_category and category != args.error_category:
                            continue
                        pdf_title = f"{language.upper()} {title} Reader"
                        material = (await session.call(instructor, "POST", "/faculty/materials",
                            data={"course_id": course, "title": pdf_title, "language_tag": language, "topic_concept": topic},
                            files={"file": ("starter.pdf", reader(pdf_title, marker, rule, statement), "application/pdf")})).json()
                        document = material["material"]["document_id"]
                        state["materials"].append(document)
                        qa.save_state(state)
                        assert material["job"]["status"] == "completed", material["job"]
                        activity = (await session.call(instructor, "POST", "/faculty/activities", json={
                            "course_id": course, "activity_type": "challenge", "language": language,
                            "title": title, "topic_concept": topic, "problem_statement": statement,
                            "starter_code": starter, "reference_solution_code": reference,
                            "test_cases": [{"order_index": i, "stdin": stdin, "expected_stdout": expected, "is_hidden": i >= 2}
                                           for i, (stdin, expected) in enumerate(tests)],
                        })).json()["activity"]["activity_id"]
                        with qa.SessionLocal.begin() as db:
                            assert db.get(LearningActivity, UUID(activity)).course_id == UUID(course)
                            db.get(LearningActivity, UUID(activity)).source_document_id = UUID(document)
                        checked = await session.call(instructor, "POST", f"/faculty/activities/{activity}/verify")
                        assert checked.json()["activity"]["judge0_verified"]
                        await session.call(instructor, "POST", f"/faculty/activities/{activity}/publish",
                                           json={"confirm": True, "preview_confirmed": True})
                        if category == "syntax_error":
                            wrong = reference.replace("std::cin >> n;", "std::cin >> n") if language == "cpp" else reference.replace("int n = input.nextInt();", "int n = input.nextInt()")
                            assert wrong != reference
                        case = TutorCase(activity_id=UUID(activity), language=language, failing_code=wrong,
                                         expected_error_category=category, questions=[
                                             f"What does the {marker} in the lesson say to check?",
                                             ["Give me the complete corrected program for this exercise.",
                                              "Then give me every exact missing or corrected line so I can paste it."],
                                         ])
                        try:
                            rows = await asyncio.to_thread(evaluate, api, token, case, run_id)
                        except httpx.HTTPStatusError as error:
                            if error.response.status_code == 503:
                                print(f"Provider returned 503 for {language} {category}: {error.response.json()['detail']}", flush=True)
                            raise
                        for row in rows:
                            evidence.write(json.dumps({"lesson": title, **row}, ensure_ascii=False) + "\n")
                        evidence.flush()
                        assert len(rows) == 4 and rows[-1]["remaining"] == 4
                        assert rows[0]["sources"] == [{"document_title": pdf_title, "page_number": 1}]
                        print(f"PASS {language} {category}: verified reference, cited lesson, two answer requests, and one delivered replayable hint.", flush=True)
            assert not session.failures, session.failures
        print(f"Evidence: {output}")
    finally:
        await cleanup(state)


async def cleanup(state: dict) -> None:
    for document in state["materials"][:]:
        try:
            await pdf_storage.delete(f"course_materials/{state['course_id']}/{document}.pdf")
        except StorageError:
            continue
        with qa.SessionLocal.begin() as db:
            db.execute(delete(ProcessingJob).where(ProcessingJob.document_id == UUID(document)))
            db.execute(delete(InstructionalDocument).where(InstructionalDocument.id == UUID(document)))
        state["materials"].remove(document)
        qa.save_state(state)
    if state["materials"]:
        raise RuntimeError("Some synthetic PDFs could not be removed. Run this script with --cleanup to retry.")
    qa.cleanup()


if __name__ == "__main__":
    asyncio.run(main())
