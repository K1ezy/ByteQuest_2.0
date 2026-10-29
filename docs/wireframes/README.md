# ByteQuest web app wireframes

Open the [revised classroom pilot flows](pilot-v2.html) first. The [original route map](index.html) remains a reference for existing screens. Both allow desktop and phone review.

These are grayscale, route-aligned wireframes for review, not production UI. Current screens reflect the app routes and components as of 2026-10-28. The research consent route is implemented but institutional consent text is still pending.

## Coverage

| Journey | Screens | App route or component |
| --- | --- | --- |
| Entry and account | Home, sign in, sign up, reset password, track selection | `/`, `/onboarding` |
| Quest discovery | Quest map, group details, join group, create group, leaderboard | `/quests`, `/quests?view=leaderboard` |
| Learning | Quiz question, quiz review, quiz result, code arena, arena result | `/quiz/[id]`, `/arena/[id]` |
| Progress | Journey drawer, progress and badges | shared header and quest map |
| Instructor | Studio, documents, challenge generation, quiz generation, review and publish, analytics | `/instructor` |
| Research choice | Consent status and withdrawal | `/account/research` |

## Desktop and Mobile Pilot Flows (`pilot-v2.html`)

The revised classroom pilot wireframe (`pilot-v2.html`) specifies explicit responsive behavior and UX states across desktop and phone viewports for key classroom resilience requirements:

### 1. Offline / Network Reconnect Banner
- **Desktop Flow:**
  - Placed immediately above the active workspace (Code Arena, Quiz, Exam) as an accessible alert banner (`role="status"`, `aria-live="assertive"`).
  - Triggers on `window.addEventListener('offline')` or `!navigator.onLine`.
  - Informs the student that the network connection is lost, switches the draft sync state to `offline-local` ("Offline Mode — saved locally to device"), and continues caching code edits into `localStorage`.
  - When connection is restored (`online` event), automatically triggers a background sync to the server and updates status to `synced` with a timestamp ("Draft synced at HH:MM:SS").
- **Mobile Flow:**
  - Rendered as a full-width sticky banner at the top of the screen (`device.phone` viewport) to maintain visibility without obscuring touch keyboards or editor controls.
  - Collapses verbose text into a high-contrast compact pill ("Offline — Draft Saved") while keeping touch targets accessible.

### 2. Pending / Queued Grading State
- **Desktop Flow:**
  - Displays a recoverable grading lifecycle card (`Queued` → `Running tests` → `Completed` / `Retry available`) on `/submissions/[id]` or submission confirmation screens.
  - Preserves the submission job ID and client idempotency key (`sha256(user_id + activity_id + code)`).
  - Employs progressive backoff polling against `/api/submission-jobs/{id}` or `/api/submissions/{id}`.
  - Allows the student to navigate back to `/dashboard` or `/quests` and return later; grading persists server-side without being aborted by navigation or tab closure.
- **Mobile Flow:**
  - Converts the two-column grid into a single-column stacked card (`.phone .grid { grid-template-columns: 1fr; }`).
  - Action buttons ("Return to dashboard", "Check result") expand to full width with 48px touch targets for easy thumb navigation on mobile devices.

### 3. Research Consent & Withdrawal State (Disabled Collection Notice)
- **Desktop Flow:**
  - Rendered in `/account/research` with a hard safety lock indicator: *"Research Telemetry Disabled (`v0.0-pending-approval`)"*.
  - Clearly explains that institutional policy, approved consent wording, and data retention approvals are pending; zero telemetry is recorded or exported during pilot mode.
  - Provides a "Withdraw from Research" action that immediately sets `research_consent_status = 'withdrawn'` and records `withdrawn_at = NOW()`.
  - Explains the strict non-coercion guarantee: withdrawing never affects grades, quest progress, or platform access.
- **Mobile Flow:**
  - Stacked card layout with clear typography hierarchy and high-contrast badges.
  - Explanatory policy text is neatly formatted above full-width confirmation/withdrawal controls.

### 4. Active Exam Priority Banner & Timed Attempt Lock
- **Desktop Flow:**
  - **Dashboard Priority:** Active or upcoming exams render at the very top of `/dashboard` with high-contrast emphasis (`card.emphasis`, applying the Von Restorff effect) before any standard learning quests.
  - **Timed Attempt Lock:** Upon starting an attempt (`/exams/[id]`), starter code and test suite are locked to an immutable snapshot. A server-authoritative countdown timer is prominently displayed in the top bar.
  - Autosaves are debounced every 5 seconds and triggered on `visibilitychange`.
  - Hints and reference solutions are strictly suppressed during exams.
  - Upon timer expiry, client and server auto-submit the latest saved snapshot.
- **Mobile Flow:**
  - Priority exam banner occupies top viewport position with distinct border and accent coloring.
  - Question navigator wraps gracefully, and the timer stays pinned in the header so students are always aware of remaining time.

## Review checklist

1. Confirm the entry, quest, quiz, arena, and instructor paths reflect the intended product.
2. Resolve whether research consent is required before enabling individual analytics.
3. Confirm group permissions and publishing workflow before building new UI from these wireframes.

