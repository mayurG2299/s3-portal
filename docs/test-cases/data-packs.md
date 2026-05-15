# Data Packs

Use these deterministic fixtures for all manual test runs.

## Common Actors

- `U_OWNER_A`: owner.a@example.com
- `U_ADMIN_A`: admin.a@example.com
- `U_VIEWER_A`: viewer.a@example.com
- `U_CUSTOM_EDIT_A`: custom.edit.a@example.com
- `U_CUSTOM_VIEW_A`: custom.view.a@example.com
- `U_NON_MEMBER`: outsider@example.com
- `U_OWNER_B`: owner.b@example.com

## Teams

- `TEAM_A`: primary QA team
- `TEAM_B`: isolation validation team

## Roles

- `ROLE_OWNER` level `100`
- `ROLE_ADMIN` level `50`
- `ROLE_VIEWER` level `10`
- `ROLE_CUSTOM_EDITOR` level `40` with explicit EDIT for file and links flows
- `ROLE_CUSTOM_VIEWER` level `30` with VIEW-only for file and links flows

## PACK-AUTH

Preconditions:

1. All users have valid password hashes.
2. One deleted user exists: `U_DELETED` with `deletedAt` set.
3. NextAuth session cookie can be issued for each actor.

## PACK-TEAM

Preconditions:

1. `U_OWNER_A`, `U_ADMIN_A`, `U_VIEWER_A`, `U_CUSTOM_EDIT_A`, `U_CUSTOM_VIEW_A` are members of `TEAM_A`.
2. `U_OWNER_B` is owner of `TEAM_B`.
3. `U_NON_MEMBER` belongs to neither team.

## PACK-CREDS

Preconditions:

1. Team credential `CRED_A1` in `TEAM_A` with region `us-east-1`.
2. Personal credential `CRED_OWNER_PERSONAL` for `U_OWNER_A`.
3. Team credential `CRED_B1` in `TEAM_B`.

## PACK-BUCKETS

Preconditions:

1. `BUCKET_A_DOCS` linked to `CRED_A1`.
2. `BUCKET_A_MEDIA` linked to `CRED_A1`.
3. `BUCKET_B_PRIVATE` linked to `CRED_B1`.
4. One bucket in `TEAM_A` has CloudFront config (`CF domain`, `keyPairId`, encrypted private key).

## PACK-FILES

Preconditions:

1. `FILE_A_IMG` image/png 120 KB.
2. `FILE_A_PDF` application/pdf 900 KB.
3. `FILE_A_TXT` text/plain 4 KB.
4. `FILE_A_MD` text/markdown 8 KB.
5. `FILE_A_CSV` text/csv 20 KB.
6. `FILE_A_LARGE` video/mp4 150 MB.
7. `FILE_B_SECRET` in `TEAM_B` for cross-team denial tests.

## PACK-LINKS

Preconditions:

1. `LINK_PUBLIC_OK`: valid public preview+download link.
2. `LINK_PASSWORD_OK`: password-protected link with known test password.
3. `LINK_EXPIRED`: expired link.
4. `LINK_MAXED`: link at `downloadCount == maxDownloads`.

## PACK-QUOTA

Preconditions:

1. `TEAM_A` limit: 100 GB, used: 60 GB.
2. Boundary state fixture: used 99.9 GB.
3. Unlimited fixture: `limitBytes = null` for one team.

## PACK-INVITES

Preconditions:

1. `INVITE_PENDING_A`: pending invite for `U_NON_MEMBER` to `TEAM_A`.
2. `INVITE_EXPIRED_A`: expired invite.
3. `INVITE_ACCEPTED_A`: accepted invite history row.

## Reset Protocol

1. Re-apply seed and migration baseline.
2. Recreate links and invites with known IDs.
3. Reconcile S3 fixture objects to expected keys.
4. Reset `StorageQuota.usedBytes` to pack defaults.
5. Clear only test-generated `AccessLog` rows after each wave.
