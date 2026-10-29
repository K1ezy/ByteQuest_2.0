# ByteQuest chatbot: implementation plan for DeepSeek V4.1 Flash

This is a **plan and build prompt**, not an implemented feature. It is based on the current ByteQuest 2.0 repository. DeepSeek V4.1 Flash is the coding assistant for this handoff; the app's existing runtime AI provider is Gemini. Do not silently substitute DeepSeek as the runtime provider.

## Product decision

Build one learning assistant with two views of the **same conversation**:

1. A fixed launcher at the bottom-right of authenticated learning pages. Click it to open a compact, docked panel. No draggable window in version 1.
2. A dedicated `/chat` page reached by the **Maximize / Open full page** control beside Minimize and Close in the panel header. Add **Chat Assistant** directly below **Activity Hub** in the Quest Map sidebar.

The panel and page must share message state. Maximize is navigation, not a second chat session. On `/chat`, hide the floating launcher and panel. A **Back to previous page** button uses a safe remembered in-app path with `/quests` fallback. Do not make browser history the only way back.

### Window states and exact controls

| State/action | Required result |
| --- | --- |
| Launcher | Small, fixed button. Clear accessible name: “Open Chat Assistant”. It does not overlap the main action on small viewports. |
| Open | Panel appears without shifting page layout. Focus moves to the chat heading or composer. Existing messages remain. |
| Minimize | Panel closes to launcher. Conversation remains. Focus returns to launcher. |
| Maximize | Navigate to `/chat`; conversation, pending request, draft input, and scroll intent remain. Floating UI disappears on that route. |
| Close | Close panel and clear the current conversation **only after an explicit clear action or confirmation**. Avoid accidental data loss from a small X button. Prefer label “Close panel” for X (same preservation as Minimize), plus a separate “Clear conversation” action. |
| Open sidebar link | Navigate to `/chat` and show the same conversation. |
| Navigate elsewhere | Conversation remains in the shared client state. The panel may remain open on ordinary learning pages; close it automatically on routes where it is disallowed. |

Do not add dragging until the fixed design has been validated. If later required, drag the launcher only, snap to left/right edges, constrain within viewport, and support keyboard placement.

## Placement and responsive layout

**Desktop:** launcher 16–24 px from the bottom/right safe area; panel about 360–400 px wide and at most `min(600px, calc(100dvh - 32px))` tall. Keep transcript scrolling inside the panel, composer fixed at its bottom, no body scroll lock for a non-modal panel. Keep z-index above app content but below critical dialogs/toasts. Do not trap focus or set `aria-modal=true` on a non-modal panel.

**Mobile:** launcher respects safe-area insets. Open chat as a full-width bottom sheet or near-full-screen overlay with a clear close control; do not squeeze the desktop panel into mobile width. If implemented as a modal sheet, make the background inert, manage focus inside it, support Escape, and restore focus on close. Follow the [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) only for this genuinely modal variant.

**Dedicated page:** use the normal site header plus a centered chat workspace with readable transcript width, visible title, status/error area, scrollable messages, and persistent composer. On mobile it fills the available content area. Do not duplicate message rendering and submit logic; make a shared conversation component with compact/full-page variants.

**Visibility:** show on authenticated dashboard, Quest Map, coding arena, lesson-review quiz, and instructor workspace if desired. Hide on home, onboarding, sign-in/account recovery, `/chat`, and **all exam routes** (`/exams` and `/exams/[id]`) for the first release. The route guard belongs in a root-mounted client shell using `usePathname`; the backend must also reject exam-context assistance if any future exam-specific context is accepted. Route hiding is an interface rule, not a security boundary.

## Behavior and scope of the assistant

- Purpose: explain programming concepts, clarify lesson text, suggest next study steps, and give **hints** for coding challenges.
- It must not provide complete challenge solutions, hidden test cases, reference solutions, unpublished activities, quiz answer keys, or exam answers.
- First release: general chat plus optional **public** context for the current published activity (`activity_id`). Validate that activity on the server and check the student's enrolled language. Do not trust client-provided problem statements or role claims.
- If the student is on an active quiz, avoid answer-specific hints before submission. A conservative first release should omit quiz question context entirely and offer concept explanations only.
- Display a short notice that AI can be mistaken. Provide an ordinary error state if Gemini is unavailable; no fabricated response.
- No automatic sending from navigation or keystrokes. Only the Send button or Enter submits; Shift+Enter makes a new line.

## Repo map: exact files to inspect and change

| File | Work |
| --- | --- |
| `frontend/AGENTS.md` | Read first. Before frontend edits, consult relevant installed Next 16 docs under `frontend/node_modules/next/dist/docs/`. |
| `frontend/src/app/layout.tsx` | Mount one client `ChatProvider`/`ChatShell` beneath `AccessibilityProvider`, outside `<main>`, so state survives route navigation. |
| `frontend/src/app/quests/page.tsx` | Insert a `/chat` sidebar `Link` directly after the Activity Hub link; give it selected/`aria-current` behavior. Do not add a second inline chat view to `viewParam`. |
| `frontend/src/app/chat/page.tsx` (new) | Dedicated full-page chat. Reuse shared conversation UI and state. |
| `frontend/src/components/chat/chat-provider.tsx` (new) | Own one conversation, draft, status, request lifecycle, clear action, and optional session persistence. |
| `frontend/src/components/chat/chat-shell.tsx` (new) | Launcher, compact panel, route visibility, navigation to full page. |
| `frontend/src/components/chat/chat-conversation.tsx` (new) | Shared transcript, message rendering, composer, and accessibility behavior. |
| `frontend/src/app/globals.css` | Scoped `.chat-*` styles, responsive sizes, safe-area spacing, reduced motion, high-contrast states. Avoid global selectors affecting Monaco, quizzes, or Quest Map. |
| `frontend/src/lib/api.ts` | Reuse existing authenticated `apiRequest`; extend only if cancellation/timeout behavior truly requires it. |
| `backend/app/api/chat.py` (new) | Authenticated chat endpoint, validation, quota, provider call, safe public activity context, generic errors. |
| `backend/app/main.py` | Register chat router. |
| `backend/app/core/quotas.py` | Add a dedicated chat policy, including per-account and global provider limits. Avoid using the student hint bucket unless its limits intentionally include chat. |
| `backend/app/core/config.py` and `backend/app/services/ai_rag/gemini_client.py` | Reuse server-side Gemini configuration and cached client; add only bounded chat-specific settings if necessary. |
| `backend/app/api/quests_gamification.py`, `backend/app/models/entities.py` | Read for public activity shape and access validation. Do not change database schema for ephemeral v1 chat. |
| `backend/tests/test_api_security.py` and new focused chat tests | Verify authentication, authorization, bounds, secret exclusion, quota/failure behavior. |

## Suggested API contract

`POST /api/v1/chat/messages` (authenticated). Request:

```json
{
  "messages": [
    {"role": "user", "content": "What is a loop invariant?"},
    {"role": "assistant", "content": "..."}
  ],
  "activity_id": null
}
```

Response: `{"reply":"..."}`. The final request message must be from the user. Validate allowed roles, nonblank text, maximum message length, maximum recent turn count, and total payload size. Do not accept `system`, `developer`, tool messages, arbitrary URLs, raw codebase paths, or client-authored privileged context. Cap output tokens and provider timeout. Preserve chronological message order. The backend constructs its own system instruction on every request and treats prior assistant messages as untrusted conversation data, not policy. Return 401/403/422/429/503 as appropriate; never return API keys or provider stack traces. Use `asyncio.to_thread` if calling the synchronous Gemini SDK from an async route. Avoid database transactions held across the provider call.

For v1, keep a bounded conversation in React memory; optionally use `sessionStorage` with a versioned key scoped to the authenticated user ID. Clear it on sign-out/account switch. Never use a single global `localStorage` key shared by accounts. No chat database table, transcript analytics, or research collection in the first release. If persistence across devices is later required, design ownership and retention rules before a new migration.

The provider instruction should require educational hints and refuse requests for full solutions or answer keys, but **server-side data minimization is the primary protection**: the chat request must not include private grading data. Do not reuse the instructor serializer (`_serialize_challenge`) for student context.

## State and error rules

- One request at a time per client conversation; disable Send while pending. Do not duplicate a send on Enter plus form submit.
- Keep the user's message visible while pending. On failure, mark it retryable without appending a fake assistant answer. Retry the same message once the user acts.
- Preserve messages and draft when switching between compact panel and `/chat`. If a request finishes during navigation, append one response to the same conversation.
- Use an AbortController or equivalent on sign-out/clear; ignore stale responses with request IDs. Do not abort merely because the panel closes or the route changes.
- Trim old turns before sending, but do not silently erase visible history. Show a “new conversation” action when the bounded window is reached.
- Scroll to the latest message only if the user was already near the bottom; do not yank them from older messages they are reading.
- Render assistant text as plain text or sanitized Markdown. Never inject raw HTML. Code blocks must wrap without widening the panel.
- Distinguish offline/network error, rate limit, provider unavailable, invalid input, and session expiry. Expose a retry where appropriate.

## Quality gates and acceptance tests

1. **Layout:** at desktop, tablet, mobile, 200% zoom, and narrow viewport, no overflow or covered Send/Close controls. Opening chat causes no page layout shift. Test Quest Map sidebar, coding arena/Monaco, quiz review, dashboard, and instructor workspace.
2. **Navigation:** panel → Maximize → `/chat` retains transcript and draft; sidebar Chat Assistant opens the same thread; navigate away → reopen retains it; `/chat` has no duplicate floating launcher.
3. **Controls:** Open, Minimize, Close panel, Clear conversation, keyboard Enter/Shift+Enter/Escape, focus restoration, visible focus rings, touch targets, screen-reader names. Avoid `aria-modal=true` on desktop non-modal panel.
4. **Security:** unauthenticated POST rejected; oversized/invalid roles rejected; forged activity ID rejected; wrong-language/unpublished activity rejected; public/student response cannot contain reference solution, hidden tests, quiz keys, invite codes, or exam data.
5. **Reliability:** double-click Send sends once; API timeout and quota surface clear errors; navigation during pending request does not duplicate or lose reply; sign-out clears account-scoped state; provider outage leaves UI functional.
6. **Performance:** no provider call or large chat bundle on initial page load; load conversation UI on demand. Inspect bundle/build output and profile opening, scrolling, and typing on a lower-end device. Honor `prefers-reduced-motion`.
7. **Regression:** run backend chat/security tests, `frontend` typecheck/lint/build, and local browser end-to-end checks with authenticated student/instructor accounts. Report checks not run and runtime services unavailable.

## Ready-to-paste DeepSeek V4.1 Flash implementation prompt

```text
Implement the ByteQuest chatbot described in docs/CHATBOT_IMPLEMENTATION_PLAN_FOR_DEEPSEEK.md. This is an implementation task: edit the repository, add focused tests, run checks, and report results. Follow that document as the product and technical contract.

Key decisions: one shared conversation; fixed launcher and docked desktop panel; mobile sheet; Maximize navigates to a dedicated /chat page; add Chat Assistant immediately below Activity Hub in the Quest Map sidebar; preserve transcript and draft across maximize/navigation; hide chat on /chat and all exam routes. Do not add dragging in v1. Keep the panel non-modal on desktop. Use the existing authenticated API helper and server-side Gemini integration, with a new bounded chat endpoint and dedicated quotas. DeepSeek V4.1 Flash is coding this feature, not the app's runtime provider.

Read frontend/AGENTS.md and the relevant installed Next documentation before editing frontend code. Inspect existing layout, Quest Map sidebar, accessibility settings, Gemini client, security dependencies, and quota patterns. Keep access control and private grading content on the server. Do not send reference solutions, hidden tests, quiz correct answers, exam data, or invite codes to the model or browser. No database migration is needed for the ephemeral first version.

Implement incrementally: (1) shared state and responsive chat UI, (2) dedicated page and sidebar navigation, (3) authenticated FastAPI endpoint with validation/quota/provider timeout and safe context, (4) focused security and interaction tests, (5) typecheck/lint/build and local end-to-end verification. Resolve any conflict by preserving existing learning and exam flows. If a runtime service is unavailable, state what could not be verified; do not claim a full pass.

At the end, list exact files changed, behavior delivered, test command results, and remaining limitations. Do not stop at mock UI or an architectural proposal.
```
