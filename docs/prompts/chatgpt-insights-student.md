# ByteQuest Insights, part 2 of 4: students

Prompt for ChatGPT. Work in `C:\Users\User\Documents\ByteQuest_2.0` on the current branch. Run this after `docs/prompts/chatgpt-insights-foundation.md` is done and verified. Read `CLAUDE.md`, check the working tree for existing changes, and read each file named below before editing it. Run `graphify query "<question>"` before you grep, and `graphify update .` after code changes. Keep the work local for review: do not commit, push or create branches.

Preserve every existing feature and behaviour unless this plan changes it on purpose. Extend the current components, CSS tokens and tests. Do not add dependencies. This part needs no migration. Never run `supabase db reset`. Frontend paths are under `frontend/src/` unless they start with `backend/`, `docs/` or `frontend/scripts/`.

## Goal

A student sees what to do now on the dashboard and their full record on the profile. Each figure appears once, every chart works on a phone without hover, and every weak topic links straight to practice.

## Already in place: extend, do not rebuild

| Feature | Where |
|---|---|
| Recommended next, quest completion ring, Rewards card (level, XP bar, badge list), recent attempts | `app/(workspace)/dashboard/page.tsx`, `GET /pilot/dashboard`, `GET /quests/progress` |
| Recent progress against the previous 3, 7 or 30 days | `components/progress-recap.tsx`, `backend/app/services/gamification/progress_recap.py` |
| Mastery Memory check | `components/memory-check.tsx` |
| Profile Progress tab, after the foundation the student's only analytics tab: Debugger's Codex, solving habits, 30-day activity, score `Sparkline`, `BarList` by type and topic, exam history, badges | `app/(workspace)/profile/page.tsx`, `components/profile/debugger-codex.tsx`, `GET /profile/me/analytics` |
| Quest Map concept filter (page state only, matched on `topic_concept`) and the Mastery Map | `app/(workspace)/quests/page.tsx` (`changeView`, around line 247), `components/mastery-map.tsx` |
| Leaderboard | `components/leaderboard.tsx` |
| From the foundation: the line chart, `MeterList`, `NotEnoughData`, `MeasureDefinitions`, the labels map, the two-tab profile | `components/insights/`, `lib/insight-metrics.ts` |

## One badge list

The full badge list appears on both the dashboard and the profile. Keep the profile's, because it is complete.

- **Profile, Progress → Badges:**
  - This is the only full list.
  - Show the description as visible text; today it is only a `data-tooltip`, which touch screens cannot open.
  - Keep the badge image, name, "+XP" and the award date.
  - Give the section `id="badges"`.
- **Dashboard, Rewards:**
  - Keep the level, the XP bar and "XP to Level N".
  - Replace the badge list with "Badges · N", the most recently awarded badge, and a **See all badges** link to `/profile?tab=activity#badges`. Check how `/quests/progress` orders badges before choosing the newest.
  - Keep the Leaderboard link.
  - Leave the API unchanged.

## Score trend and breakdowns

- Replace the profile `Sparkline` with the foundation line chart: one series, attempt date on the x axis, score on the y axis. Use a summary such as "From 40% to 85% across 12 attempts". It gets **View as table**.
- Replace `BarList` with `MeterList` for "Performance by activity type" and "Average score by topic". `BarList` has one other caller, Accounts by role in the admin Stewardship tab; convert it in the same change, then delete `BarList`.
- Remove the `profile-spark-*` and `profile-bars` CSS once nothing uses it.

## Topic practice links

Weak topics today end in nothing. Link each one to its quests.

- **Quest Map:**
  - Read `?concept=` on load into the existing concept filter, with the same effect as `changeView("list", concept)`.
  - Write `concept` into the URL when the Mastery Map selects one, so Back returns to the filtered list.
  - Clearing the filter removes the parameter.
  - An unknown concept shows the existing "no quests match" state with Clear filters.
- **Profile, "Average score by topic":**
  - Each topic row links to `/quests?concept=<topic>` with `encodeURIComponent`.
  - The link text names the topic, for example "Practise Loops".
  - The "General" fallback topic (`profiles.py`, around line 498) has no link, because it is not a quest concept.
- **Debugger's Codex:** each recorded topic links the same way. Today the topics are joined into one sentence in `debugger-codex.tsx`.
- Check that `TopicBreakdown.topic` and Codex topics use the same `topic_concept` strings the Quest Map matches.
- Every link is at least 44px tall on coarse pointers.

## Handheld rules

Follow `docs/prompts/chatgpt-handheld-layout.md`:

- One breakpoint scale. Use its shared breakpoint module if it exists; otherwise add no new width.
- 44×44px touch targets on coarse pointers.
- Hover-only styling inside `@media (hover: hover)`.
- Design tokens only.

The dashboard reveal stagger belongs to that prompt; do not change it here. Check that the shorter Rewards card fits at 375px.

## Verification and rollout

- Run these before and after, and report the real numbers:

  ```
  cd backend && .venv/Scripts/python -m pytest -q -p no:cacheprovider
  cd frontend && npx tsc --noEmit
  cd frontend && npx eslint src
  cd frontend && npx vitest run
  ```

- Add vitest coverage for:
  - Rewards: count, newest badge and link
  - profile badge descriptions are visible text
  - the Quest Map reads and writes `?concept=`
  - topic links on the profile and the Codex, including no link for "General"
  - the profile trend renders its table and summary
- Extend `frontend/scripts/qa-responsive.mjs` with `/dashboard`, `/profile?tab=activity` and `/quests?concept=<a seeded topic>` at its viewports.
- Test by hand on a phone through `OPEN-ON-PHONE-ZEROTIER.bat`:
  1. Tap a topic on the profile.
  2. Land on the filtered Quest Map.
  3. Press Back to return to the profile.
  4. Read every badge description without hovering.
- Report what changed, test counts and anything you could not verify.

## Out of scope

- New student analytics screens, peer comparison or class averages for students
- Changes to the recommender, the recent progress card, streaks, XP rules or the leaderboard
- Weekly goals or new gamification mechanics
- Instructor and admin work (parts 3 and 4)

Use the existing design tokens, components and dependencies, and add none.
