# Traceability Matrix

This matrix ensures every screen and API route has explicit test coverage.

## Screen Coverage

| Screen | Test IDs |
|---|---|
| `/` | `SCR-PUB-001`, `SCR-PUB-002` |
| `/login` | `SCR-PUB-010`, `SCR-PUB-011` |
| `/register` | `SCR-PUB-020`, `SCR-PUB-021` |
| `/share/[hash]` | `SCR-PUB-030`, `SCR-PUB-031`, `SCR-PUB-032` |
| `/dashboard` | `SCR-CORE-001` |
| `/dashboard/files` | `SCR-CORE-010`, `SCR-CORE-011`, `SCR-CORE-012` |
| `/dashboard/credentials` | `SCR-CORE-020` |
| `/dashboard/settings` | `SCR-CORE-030`, `SCR-CORE-031` |
| `/dashboard/links` | `SCR-CORE-040` |
| `/dashboard/profile` | `SCR-CORE-050` |
| `/dashboard/debug` | `SCR-CORE-060` |
| `/dashboard/teams` | `SCR-TEAM-001`, `SCR-TEAM-002` |
| `/dashboard/teams/new` | `SCR-TEAM-010` |
| `/dashboard/invitations` | `SCR-TEAM-020`, `SCR-TEAM-021` |
| `/dashboard/admin/audit` | `SCR-ADM-001`, `SCR-ADM-002` |
| `/dashboard/admin/permissions` | `SCR-ADM-010`, `SCR-ADM-011` |

## API Coverage

| API Route | Method(s) | Test IDs |
|---|---|---|
| `/api/auth/register` | POST | `API-AUTH-001`, `API-AUTH-002` |
| `/api/health` | GET | `API-HEALTH-001`, `API-HEALTH-002` |
| `/api/account/password` | POST | `API-ACC-001`, `API-ACC-002` |
| `/api/account/delete` | POST | `API-ACC-010`, `API-ACC-011` |
| `/api/account/members` | GET | `API-ACC-020`, `API-ACC-021` |
| `/api/users/lookup` | GET | `API-LOOKUP-001`, `API-LOOKUP-002` |
| `/api/files` | POST | `API-FILE-001` to `API-FILE-007` |
| `/api/files` | DELETE | `API-FILE-010`, `API-FILE-011` |
| `/api/files` | PATCH | `API-FILE-020`, `API-FILE-021` |
| `/api/files/verify` | POST | `API-FILE-030`, `API-FILE-031` |
| `/api/files/download` | GET | `API-FILE-040`, `API-FILE-041` |
| `/api/files/[fileId]/preview-url` | GET | `API-FILE-050`, `API-FILE-051` |
| `/api/files/[fileId]/preview-content` | GET | `API-FILE-060`, `API-FILE-061` |
| `/api/credentials` | GET | `API-CRED-001`, `API-CRED-002` |
| `/api/credentials` | POST | `API-CRED-010`, `API-CRED-011` |
| `/api/credentials` | PUT | `API-CRED-020`, `API-CRED-021` |
| `/api/credentials` | DELETE | `API-CRED-030`, `API-CRED-031` |
| `/api/credentials/cdn` | PUT | `API-CRED-040`, `API-CRED-041` |
| `/api/links` | POST | `API-LINK-001`, `API-LINK-002`, `API-LINK-003` |
| `/api/links` | GET | `API-LINK-010` |
| `/api/links` | DELETE | `API-LINK-020`, `API-LINK-021` |
| `/api/share/[hash]` | GET | `API-SHARE-001`, `API-SHARE-002`, `API-SHARE-003` |
| `/api/team/members` | POST | `API-TEAM-001`, `API-TEAM-002` |
| `/api/team/members` | GET | `API-TEAM-010` |
| `/api/team/members/role` | PATCH | `API-TEAM-020`, `API-TEAM-021` |
| `/api/team/invites` | GET | `API-INV-001` |
| `/api/team/invites` | POST | `API-INV-010`, `API-INV-011` |
| `/api/team/invites/[id]` | PATCH | `API-INV-020`, `API-INV-021`, `API-INV-022` |
| `/api/roles` | GET | `API-ROLE-001` |
| `/api/roles` | POST | `API-ROLE-002`, `API-ROLE-003` |
| `/api/roles/[id]` | GET | `API-ROLE-010` |
| `/api/roles/[id]` | DELETE | `API-ROLE-011` |
| `/api/roles/permissions` | POST | `API-ROLEPERM-001`, `API-ROLEPERM-002` |
| `/api/permissions/screens` | GET, POST, DELETE, PATCH | `API-SCREENPERM-001`, `API-SCREENPERM-002`, `API-SCREENPERM-003` |
| `/api/admin/audit` | GET | `API-ADM-001`, `API-ADM-002` |
| `/api/admin/quota` | GET, POST | `API-ADM-010`, `API-ADM-011` |
| `/api/admin/reconcile` | POST | `API-ADM-020`, `API-ADM-021` |

## Journey and NFR Coverage

| Area | Test IDs |
|---|---|
| End-to-end lifecycle | `E2E-01` to `E2E-05` |
| Non-functional performance | `NFR-PERF-001`, `NFR-PERF-002` |
| Non-functional resilience | `NFR-RES-001`, `NFR-RES-002` |
| Non-functional security | `NFR-SEC-001`, `NFR-SEC-002` |
| Non-functional audit | `NFR-AUDIT-001`, `NFR-AUDIT-002` |
| Compatibility | `NFR-COMPAT-001`, `NFR-COMPAT-002` |
