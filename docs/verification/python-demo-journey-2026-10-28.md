# Python demo journey — 2026-10-28

## Implemented

- The local Python seed now publishes a reviewed fundamentals quiz and an **Add Two Numbers** coding challenge in one quest group.
- The challenge has two visible and two hidden cases. Its saved reference solution must pass the real Judge0 verification endpoint before instructor review and publication. If Judge0 is unavailable, the challenge remains a draft and the seed can be rerun safely.
- The Python smoke script joins the group, completes the quiz, runs the visible cases, submits code officially, checks hidden-case privacy, and reads the resulting progress and dashboard. All student changes are rolled back.
- The dashboard completion count excludes successful attempts on unpublished activities.

## Local evidence

- The reference solution produced the expected output on all four fixture inputs in the local Python interpreter.
- Once the Judge0 VM was reachable, the local seed published the quiz and verified challenge. A second seed run reused the same group and activity IDs.
- The live Python smoke script passed its join, quiz, sample run, official grading, privacy, and dashboard checks. It confirmed the transaction rollback left student membership and progress unchanged.
- Backend `python -m pytest -q --tb=short`: **14 passed**, with one upstream Starlette TestClient deprecation warning. The new integration test covers the combined quiz and challenge path using the test transport for Judge0.
- Python compilation passed. `git diff --check` found no whitespace issues in tracked changes.

## Browser walkthrough

- In Edge as the local Python student, the demo group was already joined. The group initially showed 0 of 2 quests complete.
- **Python Fundamentals Check** was answered through the browser review flow and graded 3/3 (100%), awarding 30 XP.
- The **Add Two Numbers** editor accepted the Python solution. The first sample job remained queued because the local launcher had started FastAPI and Next.js without the separate grading worker. Starting that worker processed the queued job; a fresh browser sample run reported all visible cases passed and created no attempt.
- The official browser submission job `e41ef4b0-2c8d-4404-9ffa-78a93a62c4c1` completed on the live Judge0 VM: 4 of 4 tests passed, challenge attempt 1, and 50 XP awarded.
- After a dashboard reload, the Python track showed 2 of 2 published activities complete (100%), 105 total XP, one badge, and both passing activities in recent attempts. The quest map also showed 2 of 2 quests complete. The 105 XP is the account total, which includes an earlier quiz attempt.
- The dashboard's long synthetic pseudonym caused horizontal overflow at the observed 786 px browser width. The greeting was simplified and the header constrained; the page now fits without horizontal scrolling. A hydration warning on reload came from initializing online state from `navigator` during render; the initial render now matches the server and the warning did not recur after reload.
- The one-click launcher now starts and reuses the grading worker, restarting it when the Judge0 VM address changes. Manual startup instructions include the worker command.
- The updated launcher parsed successfully in PowerShell; frontend lint and TypeScript checks passed. After the dashboard change, a fresh browser load showed no hydration warning.
