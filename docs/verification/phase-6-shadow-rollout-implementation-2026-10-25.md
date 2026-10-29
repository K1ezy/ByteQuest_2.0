# Phase 6 shadow rollout implementation record

**Date:** 2026-10-25  
**Record type:** Static implementation review; not a runtime verification report  
**Status:** Code path implemented, inactive by default; browser/API/database verification and research gates remain open

## Implemented

- FastAPI startup keeps `rule_based` as the active sequencer. It loads the reviewed model pair only when `ML_SHADOW_ENABLED` and `ML_SHADOW_RESEARCH_APPROVED` are both true. Health responses expose the active sequencer and shadow readiness without student-level data.
- Official code and quiz submission handlers construct and commit their existing response/attempt data before calling the optional shadow recorder. Sample/dry-run code execution returns before the recorder. The shadow service skips work when the model did not load successfully, the target activity is not published/in-track, the source attempt does not belong to the student, or the opt-in gates are off.
- Shadow prediction creation and persistence are isolated from the student's committed attempt. Model or persistence failures are logged and return without changing the saved attempt response. Logs do not include a student identifier.
- The student-facing response continues to contain only the Rule 9 recommendation. Candidate model actions, probabilities, and features are not added to that response.
- `GET /api/v1/predict/instructor/analytics` is instructor-authenticated and returns aggregates only: counts, model versions, average probabilities, and accuracy calculated only for labeled outcomes. The instructor page includes an aggregate evaluation panel.
- No schema migration was added. Prediction snapshots use the existing `ml_predictions` table.

## Safety and current state

Both shadow settings default to false. A reviewed empirical model is not currently active; the synthetic Phase 5 artifacts are explicitly rejected by the model loader. Rule-based sequencing remains the only student-facing sequencer.

`ML_SHADOW_RESEARCH_APPROVED` is an operator attestation, not an approval record. ByteQuest does not yet store or enforce individual participant consent for shadow scoring. Therefore, leave the settings disabled and do not run shadow scoring against real learner history until institutional approval, participant consent, and a consent enforcement mechanism are in place. Skipping consent wording for local software development does not authorize research data collection.

## Verification still required

This record is based on source inspection. No automated tests, live API checks, browser walkthrough, or database inspection were run for this Phase 6 change. Before calling Phase 6 runtime-verified, use an approved synthetic fixture or properly approved and consented data to confirm:

1. Both default-off and model-unavailable states leave the student attempt and Rule 9 response unchanged.
2. Sample runs do not create shadow rows; official code and quiz attempts create at most the intended shadow snapshot after the attempt is committed.
3. A shadow persistence/model failure cannot roll back or hide the committed attempt.
4. Student and non-instructor tokens cannot access aggregate instructor analytics; instructor tokens can.
5. The analytics panel renders on mobile and desktop, reports aggregate values, and does not expose learner-level prediction details.
6. The outcome-label join only scores predictions when the subsequent outcome is present.

## Phase 7 handoff

Phase 7 **preparation is underway**, but production deployment and the classroom study have not started. The repository now contains deployment templates and preflight/smoke tooling, a backup/restore runbook, and a Caddy request-body limit; the current state and remaining gates are tracked in [`PHASE7_DEPLOYMENT_READINESS.md`](../PHASE7_DEPLOYMENT_READINESS.md). These local artifacts are not evidence of a running production deployment, successful production restore, load readiness, or research authorization.

Production work still depends on choosing the hosting provider, domains, Judge0 variant, production secrets and service capacity, backup/restore policy, and operational owner. A classroom study additionally requires institutional approval, approved consent wording and procedures, and participant consent. Local implementation cannot establish those external decisions or approvals.
