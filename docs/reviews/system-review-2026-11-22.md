# ByteQuest system review: 22 November 2026

A whole-system review covering product and UX, visual design, accessibility, frontend and backend architecture, data, the machine-learning design and pipeline, testing, operations, security and documentation. It builds on the [21 November critique](system-critique-2026-11-21.md) and covers the work since then: the chart tooltips (PR #2), the admin pilot tools (PR #3), and the ML screens and consent flow (PR #4).

**Method.** Code and history were read through the knowledge graph and targeted reads: module sizes, styling and error contracts were measured, and the CI workflow and plans were checked. The running app was exercised locally in the browser. Nothing here was checked on a physical phone, with a screen reader, or on the hosted stack.

## Verdict

ByteQuest has a **trustworthy core**:

- one authorization module;
- append-only attempts and idempotent rewards;
- durable grading jobs;
- privacy suppression for small groups;
- an unusually careful ML methodology.

Its weaknesses are no longer correctness bugs. They are **operational fragility** (the whole classroom depends on one Windows PC), **integration debt** (four open PRs stacked on an unmerged branch, with `main` far behind) and **accumulated surface sprawl**: a 5,000-line stylesheet with many class families, two error contracts, very large modules, and decisions scattered across long plan documents.

The ML design is sound. Its weakest point is evidence: at about 30 consented learners, the test partition holds about 6 learners, so results will be wide and probably "indicative only".

**Overall: about 7 / 10**, up from 6.5 on 21 November, held back mostly by operations and maintainability rather than behaviour.

## Scorecard

| Area | Score | Why |
|---|---:|---|
| Product and UX flows | 7 | Clear role journeys. The dashboard leads with the next action, and admin setup is now smooth. Gaps: the leaderboard design, no in-app notifications, and Memory Check never seen working in the demo. |
| Visual design system | 5.5 | Shared `ws-` components exist, but `globals.css` is 5,018 lines with 12 or more class families (`ws-`, `ic-`, `pilot-`, `dashboard-`, `bq-`, `auth-`, `arena-`, `workshop-`, `chat-`…) and Tailwind-style utility pockets in onboarding, submissions and the legal pages. |
| Accessibility and phones | 7 | Strong foundations: focus rings, reduced motion, high contrast, table views for charts, 44 px targets. Never verified with real assistive technology or a physical phone. |
| Frontend architecture | 6 | Clean route groups and a shared workspace provider. Very large modules: `lib/workspace.ts` 1,108 lines, `arena.tsx` 1,055, the exam page 1,051, `review/[id]` 977, onboarding 866. |
| Backend architecture and API | 7 | `course_access` and `attempt_visibility` are good deep modules: archiving a course needed two functions changed, not twenty. Large routers (`admin.py` 1,375 lines, `workshops.py` 796, `exams.py` 744) and two error contracts. |
| Data and domain model | 7.5 | Append-only attempts, version fingerprints, durable jobs and 45 migrations. The domain language is overloaded ("block", "course" against "workshop" against "track") and there is no glossary or ADRs. |
| ML methodology | 8 | Student-disjoint split, preprocessing fitted on training only, baselines, Brier score, bootstrap intervals, an adequacy rule, refusal to serve synthetic runs, consent gating and pseudonymous exports. |
| ML evidence readiness | 4 | No approved model yet. Classroom scale gives a very small test partition, and one known train/serve skew is documented but unresolved. |
| Testing and CI | 7 | Real-Postgres integration tests, about 230 frontend tests, and CI running pytest, lint, typecheck, vitest and build. No browser or end-to-end test in CI, and several large pages have no tests. |
| Operations and reliability | 4 | Hosted pilot at 0 of 6 gates. Docker Desktop stopped twice during this review session, taking the database down. `/readyz` checks only the database, and there is no error tracking or alerting. |
| Security and privacy | 7.5 | JWTs verified locally, default-deny RLS, quotas, a single authorization path, and the consent model. One gap: consent version changes (H5). No written data-retention or deletion procedure. |
| Documentation | 5 | Abundant but sprawling: 26 top-level docs, dated status snapshots and prompts. It is hard to tell which document is current. |

## What is working well (keep)

- **Authorization in one place.** `course_access` and the shared visibility clauses decide who sees what. New rules, such as archived courses, land in one spot.
- **Data integrity by construction.** Attempts are append-only (enforced by a trigger), XP is idempotent, exam embargoes and grading jobs are durable, and every consequential admin action is audited.
- **Privacy by default.** Cohorts under 5 learners are suppressed, research exports are pseudonymous, and nothing reaches the models without consent.
- **Honest interface copy.** Unavailable features say why, and practice is clearly separated from official submission.
- **ML rigor.** The plan's decisions D1–D20 freeze the method against the manuscript, and the code enforces it (schema 3, adequacy, the refusal to serve synthetic runs).

## Findings

Severity reflects risk to the pilot and the defense, not effort.

### High

**H1. The classroom depends on one PC that went down twice in one session.**

- **Evidence:** Docker Desktop stopped on its own twice today, and each time local Supabase, and so the whole app, was unreachable until a manual restart. Grading also depends on a Judge0 VM on the same machine. Hosted acceptance is 0 of 6 gates.
- **Fix:** Either complete the hosted pilot (Vercel, hosted Supabase and the KVM 2 server, per the [release gates](../SYSTEM_STATUS_AND_RELEASE_PLAN.md)), or harden the local path:
  - start Docker Desktop at logon;
  - add a watchdog that restarts Supabase and checks the API, worker and Judge0;
  - give the launcher a visible "classroom ready" check;
  - run one full dress rehearsal on the classroom network.

**H2. Integration debt: four PRs stacked on an unmerged branch, and `main` far behind.**

- **Evidence:** PRs #2, #3 and #4 all sit on PR #1. Each conflicts with `main` until #1 lands, and they conflict with each other on the regenerated `graphify-out/` files.
- **Fix:**
  - Merge #1 next, then #2–#4.
  - Install graphify's `merge-driver` (`graphify hook install`) so `graph.json` merges by union.
  - Rebuild the report after merging, or stop committing the generated report files.
  - Keep future branches short-lived off `main`.

**H3. Two error contracts.**

- **Evidence:** Faculty and admin routes return `{code, message}`. Learner, exam, workshop and pilot routes mostly return plain strings: `exams.py` 37, `rag_instructor.py` 21, `pilot.py` 21, `workshops.py` 15, `submissions.py` 12.
- **Effect:** The frontend cannot branch on the cause, such as `attempt_expired` against `course_archived`, so learners get generic messages, and tests assert on prose.
- **Fix:** Add one helper that builds a coded error, then migrate router by router, learner-facing routes first.

**H4. Styling sprawl.**

- **Evidence:** One 5,018-line `globals.css` serves at least 12 class families. Onboarding, submissions and the legal pages use Tailwind-style utilities with hard-coded colours, which bypass the theme and high-contrast tokens. There are two heading components (`PageHeading` in the workspace kit, `PageHeader` in the instructor kit).
- **Effect:** Visual inconsistency, dead CSS, and every UI change risks collisions.
- **Fix:** This is UI/UX slice 6:
  - write a `DESIGN.md` of the tokens and component roles;
  - move each surface's CSS next to its components;
  - retire one heading component;
  - remove unused rules with a stylelint check;
  - replace the utility pockets with tokens.

**H5. A consent version change silently drops consented students (found in this review).**

- **Evidence:** `GET /pilot/research/consent` returns the student's latest `choice` but not which version it was for. The new Dashboard card hides once any choice exists, while `consented_student_ids` counts only `accepted` on the *current* version.
- **Effect:** If the consent version changes during the pilot, after an ethics revision for example, every earlier answer stops counting, and those students are never asked again.
- **Fix:**
  - Return `choice_version`.
  - Treat a choice on an older version as unanswered, so the card and page ask again.
  - Add a test.

  This is small, and should land before the pilot.
- **Status: fixed on 22 November 2026** on `feat/ml-evaluation-page`. `GET /pilot/research/consent` now reports an answer to an older form as unanswered and returns `previous_version`. The card and the Research participation page explain that the form changed and ask again. A regression test covers the version change end to end.

**H6. ML evidence will be thin at classroom scale.**

- **Evidence:** About 30 consented learners and a 60/20/20 student-disjoint split leave about 6 learners in the test partition. That is exactly the adequacy minimum, with wide bootstrap intervals.
- **Effect:** The SOP 4 comparison may be "indicative only". This is a research-design risk, not a code bug.
- **Fix:**
  - Maximise consent uptake (the card helps) and the number of challenges per learner during the pilot.
  - Present the result as a feasibility study with intervals.
  - As a supplementary analysis, not a change to the frozen method, consider grouped cross-validation, which uses every learner for evaluation. Record it as an erratum or future work with your adviser.

### Medium

**M1. Large modules with mixed concerns.**

- **Backend:** `admin.py` (1,375 lines) mixes accounts, courses, enrollment, materials, activities, settings, monitoring and audit. `exams.py` (744) mixes authoring, scheduling, attempts and release.
- **Frontend:** `lib/workspace.ts` (1,108) mixes types, fetchers and formatting for every role. `arena.tsx`, the exam page and `review/[id]` are each about 1,000 lines.
- **Fix:** split by domain behind the existing interfaces. These are the first candidates for `/improve-codebase-architecture`.

**M2. No end-to-end test in CI.**
CI runs pytest, lint, typecheck, vitest and build. The responsive matrix (`qa-responsive.mjs`) and the multi-role rehearsal (`qa_live_multi_role.py`) are manual. Add a small Playwright smoke job: sign in as each role, open the main pages, and complete one practice submission. Run it on PRs or nightly.

**M3. Big screens without tests.**
No tests cover:

- `instructor/review/[id]` (977 lines);
- the Materials studio;
- the Arena and quiz runner pages;
- Chat;
- the Leaderboard;
- the account pages.

The admin pages got tests in PR #3. Test these through their own interfaces when they're next changed.

**M4. Overloaded domain language, no glossary or ADRs.**

- **Evidence:** "Block" means the student's letter (`A`) and also a workshop's label (`4CS-A`). Course, Workshop, Track, Quest and Activity overlap in the UI copy. Decisions such as D1–D20 and the workshop rules live inside long plan documents.
- **Fix:** a `GLOSSARY.md` and ADRs in `docs/adr/`. `/grill-with-docs` builds both as it goes.

**M5. Documentation sprawl.**
There are 26 top-level docs, several dated status snapshots (20 and 21 November, the release plan, the master plan) and prompt files, so it is hard to know which is current. Keep one living status page, archive dated snapshots, and let ADRs hold decisions.

**M6. Observability.**
There is no error tracking, structured request IDs, metrics or alerting. `/readyz` checks only the database. For the pilot, add:

- request-ID logging;
- an error tracker;
- uptime checks on the API, worker heartbeat and Judge0;
- one place that shows "is the classroom healthy right now".

**M7. Known train/serve skew.**
`days_since_last_attempt` is the gap up to the first submission offline, but is close to 0 live, because the forecast is taken at snapshot time. It is documented but not mitigated, and shadow-window forecasts will lean on a feature distribution the model never saw. State it as a limitation, and consider scoring only when a learner opens the challenge, closer to t0.

**M8. Training script monolith.**
`ml_pipeline/train_compare.py` (1,145 lines) holds validation, the synthetic generator, splitting, tuning, evaluation, bootstrap and artifact I/O. Splitting it into modules (data, split, train, evaluate, report) keeps the frozen method but makes each stage testable on its own.

**M9. Leaderboard design.**
It is one all-time XP ranking, so late joiners and newly enrolled students cannot catch up. Course, workshop or weekly views, or personal bests, are a product decision with pedagogical weight.

**M10. Consent and data governance.**
There is no written retention period, deletion-request procedure or re-consent policy. Withdrawal does not retract earlier exports, and the UI now says so honestly. Write a one-page data management plan with your adviser and ethics board, and link it from the consent page.

### Low

- **L1.** Charts use Recharts' `role="application"`. Screen-reader users should rely on **View as table**; say so in each chart's description.
- **L2.** Some labels still differ between the menu and the page, for example "Course & Instructor Management" in the menu against the "Courses" tab.
- **L3.** No in-app notification centre: the bell shows recent course activity, and exam notices go only by email.
- **L4.** Demo seed data and real data share the local database. Exports exclude it because seeded students have no consent, but a `demo` marker on seeded rows would make that explicit.
- **L5.** Forecast bands give a label and a probability but no reason. Explaining the main factors is a new capability, which ML plan D1 excludes. Keep it for after the defense.

## What to add

| Addition | Why | When |
|---|---|---|
| Re-consent on version change (H5) | Keeps pilot data valid if the consent form is revised | Before the pilot |
| Hosted pilot, or a hardened local launcher with a watchdog (H1) | A classroom cannot depend on Docker Desktop staying up | Before the pilot |
| End-to-end smoke job in CI (M2) | Catches cross-role breakage that unit tests miss | Next |
| Coded errors everywhere (H3) | Specific, actionable messages and stable tests | Next |
| Error tracking and uptime checks (M6) | You learn about outages before students do | Before the pilot |
| `DESIGN.md` and the styling consolidation (H4) | One visual system that is cheaper to change | UI/UX slice 6 |
| `GLOSSARY.md` and ADRs (M4) | Shared language for people and agents; decisions you won't re-argue | Any time, ideally first |
| Data management plan (M10) | Ethics, retention and deletion in writing | Before the pilot |
| Grouped cross-validation as a supplementary analysis (H6) | Better use of a small sample | After the pilot, with your adviser |
| Forecast explanations, leaderboard views, notification centre (L5, M9, L3) | Instructor trust and student motivation | After the defense |

## Recommended order

1. **Merge PR #1**, then #2, #3 and #4. Install the graph merge driver first (H2).
2. **Fix re-consent on version change** (H5). It's small, with a test.
3. **Classroom reliability** (H1): pick hosted or hardened local, then rehearse once on the real network.
4. **Observability** (M6) and a **CI smoke job** (M2).
5. **Coded errors** (H3), learner routes first.
6. **UI/UX slice 6** (H4): `DESIGN.md`, CSS consolidation, one heading component.
7. **Architecture deepening** (M1, M8), one module at a time.

## How to run this (skill flows)

- **To choose architecture work:** run `/improve-codebase-architecture`. It surveys the codebase for deepening opportunities in the modules above (`admin.py`, `exams.py`, `lib/workspace.ts`, `train_compare.py`), presents them as a report, and grills you on the one you pick.
- **For each chosen item:** run `/grill-with-docs`. It is the same interview as before, but it also writes `GLOSSARY.md` and ADRs as it goes, which closes M4. Then use `/to-spec` and `/to-tickets` for multi-session work, or `/implement` for a single session.
- **For H5 and other small, clear fixes:** use `/tdd` directly.
