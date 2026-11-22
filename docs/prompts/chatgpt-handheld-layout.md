# Make ByteQuest fit every phone and tablet

Prompt for ChatGPT. Work in `C:\Users\User\Documents\ByteQuest_2.0` on the current branch. Read `CLAUDE.md`, check the working tree for existing changes, and read each file named below before editing it. Keep the work local for review.

Preserve every existing feature and behaviour unless this plan changes it on purpose. Extend the current components, CSS tokens and tests. Do not add dependencies. Keep `frontend/src/lib/network.ts` as it is, because phones reach the app over plain HTTP.

## Goal

Every ByteQuest screen fits and works on any phone, tablet or iPad, in portrait and landscape, and adjusts automatically to the screen it opens on. On every handheld screen the navigation sits on the left or right side, never along the bottom, and the user chooses which side. Students, instructors and admins get the same navigation, design tokens and components at every size, with no sideways page scrolling, touch-sized controls, and a keyboard that never hides what they are typing.

## Already in place: extend, do not rebuild

These features exist and have tests. Reuse them. Building a second version of any of them is out of scope.

| Feature | Where |
|---|---|
| Navigation that docks left or right. Hold **Menu** for 450 ms, drag it, and it snaps to the nearer edge. The side is saved per account on the device. **Menu position** in **Accessibility settings** has Move left and Move right buttons as a non-drag alternative. Below 850px the navigation is a full-height rail on that side; above 850px the whole sidebar moves to that side. The Menu drawer opens from the chosen edge. | `components/workspace/dockable-navigation.tsx` (`MenuPositionSetting`), used by `components/app-shell.tsx`, `components/instructor/course-shell.tsx` and `components/accessibility-settings.tsx`; `.bq-dock` rules in `app/globals.css` |
| Top bar below 850px; the account menu opens as a bottom sheet | `components/app-shell.tsx`, `components/account-menu.tsx` |
| `viewport-fit=cover`, `interactive-widget=resizes-content`, safe-area padding | `app/layout.tsx`, `app/globals.css` |
| Touch code editor for coarse pointers up to 1023px | `components/arena.tsx` (`TOUCH_EDITOR_QUERY`) |
| Full-screen Chat Assistant below 850px, scrollable code blocks, reply recovery | `components/chat/` |
| High contrast, large text, legible font, reduced motion | `components/accessibility-provider.tsx` |
| Data tables scroll inside `.ws-table-wrap` | `components/workspace/ui.tsx` and the admin and instructor pages |
| Viewport matrix: 320–412px phones, 800×360 landscape, 768 and 1024 tablets, desktop, plus a touch drag of the Menu | `frontend/scripts/qa-responsive.mjs`, `backend/tests/qa_mobile_exam.py --responsive` |

## Side navigation on handheld screens: already built

Below 850px the navigation is a 68px rail fixed to the chosen edge. Content is offset on that side. On short screens the links scroll while **Menu** stays at the top. The old bottom bar and its padding are gone. Check the rail at the new viewport sizes, and keep fixed views such as the chat restore bar clear of it. Do not rebuild it.

## Layout system

- **One breakpoint scale.** `app/globals.css` (about 4,965 lines) switches layout at 14 different widths: 520, 560, 620, 640, 700, 720, 760, 768, 850, 900, 1024, 1100, 1200 and 1220px. `(max-width: 850px)` is hard-coded separately in `account-menu.tsx`, `use-chat-viewport.ts` and `dockable-navigation.tsx`. Define four named ranges:
  - compact: up to 600px
  - medium: up to 850px
  - expanded: up to 1199px
  - wide: 1200px and up

  Keep 850px as the switch between the handheld side rail and the full sidebar. Export the media queries from one module that every component imports. Move an existing query to the nearest named width only when the matrix screenshots show no unintended change; otherwise keep it and leave a one-line reason.
- **Decide touch behaviour by pointer, not width.** `globals.css` has no `(pointer: coarse)` rule and only two `(hover: …)` queries. An iPad in landscape (1024–1366px) gets the desktop sidebar layout on a touch screen.
- **Dynamic viewport units.** Replace the four remaining `100vh` with `100dvh` where they size full-height regions.
- **Short screens.** With the bottom bar gone, the 59px top bar is the only chrome above content. Below about 500px of height, compact it so the arena editor, chat, quizzes and exam answers keep their working height on a landscape phone.

## Touch and input

- **Touch targets.** On coarse pointers, every control is at least 44×44 CSS px, without changing desktop density. Controls measured below 44px on localhost:
  - dashboard **Refresh** and **Show all**: 38px
  - **Change learning track**: 27px
  - date filter chips: 32px
  - landing carousel dots: 4px
  - chat error actions: 28px
  - chat **Copy code**: 32px

  Use one coarse-pointer rule or the existing `.ws-touch-action` class, not a fix for each component.
- **No sticky hover on touch.** Only 2 of the 73 `:hover` rules are guarded. Wrap hover-only styling in `@media (hover: hover)` and keep `:focus-visible` unchanged.
- **On-screen keyboard.** `interactive-widget=resizes-content` handles Android Chrome. iOS Safari ignores it, and nothing uses `visualViewport`. Implement this once, in the shell: at 850px or less, while a text field or the code editor has focus, keep the field and its submit button visible above the keyboard. The side rail stays where it is. This applies on these screens:
  - sign-in
  - chat composer
  - arena editor
  - quiz answers
  - exam answers
  - workshop join code
- **Tablet editor.** Check the arena with touch at 1180×820 and 1366×1024. If Monaco's selection or keyboard fails there, extend `TOUCH_EDITOR_QUERY` to coarse pointers up to 1366px. Do not add a third editor.

## Menu docking: finish what exists

- **Menu position** already lives in **Accessibility settings** with its help text. Don't add a second copy to the Menu drawer.

- After a drag, announce the new side through a polite live region: "Menu moved to the right." The **Menu position** buttons in Accessibility settings already expose `aria-pressed`.
- Show a lifted state when the 450 ms hold activates, so students know they can drag. Animate the snap to the edge with the existing `--dur-*` and `--ease-out` tokens. Skip both animations under reduced motion.
- With the rail on either side, the account sheet, Chat Assistant and **Jump to latest** must not sit under it.

## Screens

- **Dashboard.** On a phone the dashboard is about 3.5 screens tall. Its sections fade in on a stagger (`.dashboard-reveal`, 70 ms per step), so sections below the fold show blank space when a student scrolls straight away. Stagger only the first screen and show the rest immediately.
- **Every route.** Each student, instructor and admin route renders at 320px without widening the page, uses the shared tokens and components, and keeps its primary action reachable without horizontal scrolling. Instructor and admin pages must work on tablets (768–1366px); on phones their tables may stay in their scrolling wrappers.

## Verification and rollout

- Extend `frontend/scripts/qa-responsive.mjs` instead of adding a tool.
  - Add these viewports: 375×667, 390×844, 430×932, 844×390 landscape, 820×1180, 1180×820 and 1366×1024.
  - Add these screens: arena, quiz, Chat Assistant (widget and full page), exams, leaderboard, workshops, profile, and the instructor dashboard.
  - The script already checks the rail on both sides (`assertRail`) and sets the side from Accessibility settings. Extend those checks to the new viewports.
  - Check that no page widens, touch targets are at least 44px in touch contexts, and a focused field stays above the keyboard.
  - Save screenshots for a before-and-after review.
- Run `npx vitest run`, `npx tsc --noEmit`, `npx eslint .`, the matrix, and `backend/tests/qa_mobile_exam.py --responsive`. Keep the existing tests. Add vitest coverage for the shared breakpoint module and the Menu announcement.
- Test by hand on a real iPhone (Safari) and Android phone (Chrome), connected through `OPEN-ON-PHONE-ZEROTIER.bat`:
  - the keyboard in chat and the arena
  - the Menu drag to both sides
  - VoiceOver and TalkBack with the **Menu position** buttons
  - 200% zoom, large text and high contrast
- Report what changed, what was kept, screenshots for each viewport, test results and anything you could not verify.

## Out of scope

- A visual redesign or new brand colours
- Navigation along the top or bottom edge, or placed freely; the rail docks only to the left or right edge
- Syncing the Menu side across devices
- A native app or install prompt
- The Chat Assistant work that was just completed

Use the existing design tokens, components and dependencies, and add none.
