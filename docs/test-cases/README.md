# S3 Portal Manual Test Suite

This folder contains the complete manual QA suite for screen coverage and API flow coverage.

## Scope

- All user-facing screens in `app/**/page.tsx`
- All API routes in `app/api/**/route.ts`
- Permissions across OWNER, ADMIN, VIEWER, custom EDIT, custom VIEW, non-member, unauthenticated
- Positive, negative, boundary, concurrency, security, and audit side-effect checks

## Test ID Conventions

- `SCR-*`: UI screen behavior tests
- `API-*`: Endpoint contract and business behavior tests
- `PERM-*`: Permission matrix and access abuse tests
- `E2E-*`: End-to-end user journeys
- `NFR-*`: Non-functional (performance, resilience, compatibility, audit)

## Status Values

Use one status for each test case during execution:

- `Not Run`
- `Pass`
- `Fail`
- `Blocked`

## Execution Waves

1. Wave 0 Smoke: auth, files list/upload, preview, share, role mutation
2. Wave 1 Security: permission bypass, ownership, cross-team isolation
3. Wave 2 Core Business: credentials, links, invites, profile/account
4. Wave 3 Admin and Ops: audit, quota, reconcile, error paths
5. Wave 4 NFR: resilience, large files, browser and mobile checks

## Release Gate

Release is blocked if any of these are true:

1. Any `Critical` test fails.
2. Any `NFR-SEC` test fails.
3. Any `NFR-AUDIT` test fails.
4. Any permission abuse `PERM-*` test fails.

## Files

- `data-packs.md`: reusable fixtures and reset protocol
- `traceability-matrix.md`: screen and API to test ID mapping
- `permissions-matrix.md`: actor-by-capability expected behavior
- `screens/*.md`: UI test cases
- `api/*.md`: API test cases
- `e2e-journeys.md`: cross-screen and cross-API scenarios
- `non-functional.md`: high-value manual NFR checks
