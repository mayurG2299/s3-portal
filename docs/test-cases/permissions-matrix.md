# Permissions Matrix

Expected behavior matrix for protected flows.

## Actors

- OWNER
- ADMIN
- VIEWER
- CUSTOM_EDIT
- CUSTOM_VIEW
- NON_MEMBER
- UNAUTHENTICATED

## Capability Matrix

Legend:

- `ALLOW_EDIT`
- `ALLOW_VIEW`
- `DENY_403`
- `DENY_401`

| Capability | OWNER | ADMIN | VIEWER | CUSTOM_EDIT | CUSTOM_VIEW | NON_MEMBER | UNAUTHENTICATED |
|---|---|---|---|---|---|---|---|
| Files list | ALLOW_VIEW | ALLOW_VIEW | ALLOW_VIEW | ALLOW_VIEW | ALLOW_VIEW | DENY_403 | DENY_401 |
| File upload init | ALLOW_EDIT | ALLOW_EDIT | depends screen permission | ALLOW_EDIT | DENY_403 | DENY_403 | DENY_401 |
| File delete | ALLOW_EDIT | ALLOW_EDIT | DENY_403 | depends screen permission | DENY_403 | DENY_403 | DENY_401 |
| File preview URL | ALLOW_VIEW | ALLOW_VIEW | ALLOW_VIEW | ALLOW_VIEW | ALLOW_VIEW | DENY_403 | DENY_401 |
| File download | ALLOW_VIEW | ALLOW_VIEW | ALLOW_VIEW | ALLOW_VIEW | ALLOW_VIEW | DENY_403 | DENY_401 |
| Credentials list | ALLOW_VIEW | ALLOW_VIEW | DENY_403 | depends screen permission | DENY_403 | DENY_403 | DENY_401 |
| Credentials create/update/delete | ALLOW_EDIT | ALLOW_EDIT | DENY_403 | depends screen permission | DENY_403 | DENY_403 | DENY_401 |
| Links create/delete | ALLOW_EDIT | ALLOW_EDIT | DENY_403 | depends screen permission | DENY_403 | DENY_403 | DENY_401 |
| Invite send | ALLOW_EDIT | ALLOW_EDIT | DENY_403 | depends screen permission | DENY_403 | DENY_403 | DENY_401 |
| Team member role change | ALLOW_EDIT | ALLOW_EDIT with hierarchy limits | DENY_403 | DENY_403 unless granted | DENY_403 | DENY_403 | DENY_401 |
| Admin quota and reconcile | ALLOW_EDIT | ALLOW_EDIT only if `ADMIN_SETTINGS` EDIT | DENY_403 | DENY_403 unless granted | DENY_403 | DENY_403 | DENY_401 |
| Public share access via hash | ALLOW_VIEW | ALLOW_VIEW | ALLOW_VIEW | ALLOW_VIEW | ALLOW_VIEW | ALLOW_VIEW | ALLOW_VIEW |

## PERM Test Requirements

1. Every protected endpoint must have one `PERM-*` positive and one `PERM-*` negative case.
2. Every UI-hidden action must have a direct API abuse test.
3. Every cross-team resource ID must be tested against non-owner actors.
4. Every permission denial path should assert a corresponding failure audit log when route logic logs failures.
