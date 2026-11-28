# Issue tracker: local markdown, mirrored to GitHub Issues

Specs and tickets live in two places. **The local markdown file is the source of truth**; a GitHub issue in `K1ezy/ByteQuest_2.0` mirrors it so the work is visible on GitHub. If `gh` is missing or signed out, keep working locally and mirror later.

## Local markdown (always)

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Tickets are one file each at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`, never one combined tickets file
- Triage state is a `Status:` line near the top of each file (role strings in `triage-labels.md`)
- Blocking edges are a `Blocked by: NN, NN` line near the top; a ticket is unblocked when every listed file is resolved
- Comments append under a `## Comments` heading at the bottom

## GitHub mirror (when `gh` is available)

- After writing a spec or ticket file, create its GitHub issue: `gh issue create --title "..." --body-file <file> --label <triage label>`. Then add a `GitHub: #<n>` line near the top of the local file.
- Tickets become sub-issues of the spec's issue: `gh issue create --parent <spec#> ...`, or `Part of #<spec#>` at the top of the body on older `gh`.
- Blocking: add GitHub's native dependency with `gh api --method POST repos/K1ezy/ByteQuest_2.0/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>` (database id from `gh api repos/K1ezy/ByteQuest_2.0/issues/<n> --jq .id`), or a `Blocked by: #<n>` line.
- Status changes go to both places: update the local `Status:` line, then `gh issue edit <n> --add-label/--remove-label`, and `gh issue close <n>` when resolved.
- If the two disagree, the local file wins; update the GitHub issue to match.

**PRs as a request surface: no.** _(Set to `yes` if external PRs should go through `/triage`.)_

## When a skill says "publish to the issue tracker"

Write the file under `.scratch/<feature-slug>/`, then mirror it to GitHub as above.

## When a skill says "fetch the relevant ticket"

Read the local file. If you were only given a GitHub number, find the local file whose `GitHub: #<n>` line matches, or fall back to `gh issue view <n> --json number,title,body,labels,comments`.

## Wayfinding operations

Used by `/wayfinder`, with the same local-first, GitHub-mirror rule.

- **Map**: `.scratch/<effort>/map.md`, mirrored as one issue labelled `wayfinder:map`.
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md` with a `Type:` line (`research`/`prototype`/`grilling`/`task`) and a `Status:` line (`claimed`/`resolved`), mirrored as a sub-issue of the map labelled `wayfinder:<type>`.
- **Blocking**: `Blocked by: NN, NN` locally; native issue dependencies on GitHub.
- **Frontier**: open, unblocked, unclaimed files in `.scratch/<effort>/issues/`; the lowest number wins.
- **Claim**: set `Status: claimed` and save before any work; assign the GitHub issue with `gh issue edit <n> --add-assignee @me`.
- **Resolve**: append the answer under `## Answer`, set `Status: resolved`, add a gist and link to `map.md`'s Decisions-so-far, then comment on and close the GitHub issue.
