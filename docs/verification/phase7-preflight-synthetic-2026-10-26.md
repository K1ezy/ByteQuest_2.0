# Phase 7 synthetic deployment preflight — 2026-10-26

## Result

The VPS preflight accepted a fully populated synthetic configuration, rendered a valid Compose configuration, and rejected an image reference missing its SHA-256 digest.

## Scope and method

- Used an isolated temporary fixture outside the repository with copies of the Compose template, Caddyfile, and preflight script.
- Supplied dummy credentials, placeholder domains, and fake-format SHA-256 digests. No real secret or production endpoint was used.
- Ran the preflight through the Windows Docker CLI from WSL Ubuntu because Docker's Linux integration is not installed in that WSL distribution.
- Compose validation ran with `docker compose config --quiet`. No image pull, container creation, or service startup was requested.
- Removed the Caddy digest in a follow-up negative case; the preflight rejected it with the expected digest-pinning error.

## Evidence

Successful case output:

```text
Production settings passed local validation. No secret values were displayed.
Backend DB connection ceiling for one Compose replica: 2 workers x (5 pool + 5 overflow) = 20 connections.
VPS Compose configuration is valid. No services were started.
```

Negative case:

```text
ERROR: CADDY_IMAGE must be a release-reviewed image reference pinned by sha256 digest.
```

## Limits

This verifies the local preflight's acceptance and rejection behavior and Compose syntax for the synthetic fixture. It does not verify real credentials, image digests, DNS, TLS, production Supabase connectivity, VPS capacity, Judge0 execution, or application health. No containers were pulled or started. Production deployment remains blocked on the operator decisions and production resources listed in [`../PHASE7_DEPLOYMENT_READINESS.md`](../PHASE7_DEPLOYMENT_READINESS.md).
