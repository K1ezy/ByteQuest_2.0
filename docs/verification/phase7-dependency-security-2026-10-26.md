# Phase 7 dependency security review (2026-10-26)

## Scope

Audited the frontend npm dependency tree and the backend's hashed Linux x86_64 Python runtime lock. The review used synthetic/local package metadata only; it did not access or change student data.

## Findings and changes

- The frontend audit found a critical DOMPurify advisory in the `monaco-editor` dependency tree (`dompurify` 3.4.15). Added an npm override to require DOMPurify 3.4.17 or newer within the current major, then refreshed the lockfile. The frontend audit reported zero vulnerabilities after the update.
- The Python lock audit found advisories for `python-jose` 3.5.0 and its `ecdsa` dependency. ByteQuest uses this library only to decode Supabase tokens and already restricted the accepted algorithm to HS256. Replaced it with PyJWT, preserving HS256 and the `authenticated` audience requirement. This removes both packages from the runtime dependency graph.
- Regenerated both hashed Python locks (`requirements.lock` and `requirements-dev.lock`) for the documented Python 3.11 Linux x86_64 target. The backend audit then reported no known vulnerabilities in the runtime lock.

## Verification performed

- `npm install` updated one package and reported zero vulnerabilities.
- `npm audit --omit=dev` reported zero vulnerabilities.
- `uv pip compile requirements.txt --output-file requirements.lock --python-version 3.11 --python-platform x86_64-unknown-linux-gnu --generate-hashes` completed successfully.
- `uv pip compile requirements-dev.txt --output-file requirements-dev.lock --python-version 3.11 --python-platform x86_64-unknown-linux-gnu --generate-hashes` completed successfully.
- `uvx --from pip-audit pip-audit --disable-pip --no-deps -r requirements.lock` reported no known vulnerabilities. `--no-deps` is appropriate here because uv's hashed lock already pins the complete transitive runtime graph; it also avoids trying to install the Linux-only `uvloop` wheel in the Windows environment.
- A synthetic HS256 JWT with the `authenticated` audience decoded successfully through ByteQuest's auth helper; a token signed with the wrong secret was rejected with HTTP 401.
- `npm run typecheck` passed.
- `npm run build` passed for Next.js 16.4.2 and generated the static routes. The build read `frontend/.env.local`; this verifies the local build only, not Vercel environment configuration or a deployed flow.
- `git diff --check` passed; Git printed only the repository's existing LF-to-CRLF working-tree notices.

## Remaining checks and limits

- The full npm audit was clean after the update; the explicitly captured production-only audit was also clean.
- Vulnerability feeds change over time. Repeat audits before creating the production image and deployment.
- This review does not audit the Judge0 container images, operating system packages, Vercel deployment, or the future VPS image digests.
