<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Text and layout containment

- When adding or changing a screen that displays authored, generated, or user-entered text, keep the complete text readable. Use shrinkable grid and flex children, normal wrapping, and `overflow-wrap: anywhere` for unbroken values. Let controls wrap or stack at narrow widths.
- Extend [the browser layout suite](layout-tests) for the changed surface or shared component. Include a long sentence and an unbroken string where dynamic text can appear. Assert that text and actions fit their own container as well as the viewport. Give code editors and intentionally scrollable tables a local scroll container.
- Install Chromium with `npx playwright install chromium` once, then run `npm run build` and `npm run test:layout` from this directory. The regression workflow runs the browser suite at desktop width, 320 CSS px, and enlarged text. The [quiz tests](layout-tests/quiz-overflow.layout.ts) show how to use the shared containment assertion.
