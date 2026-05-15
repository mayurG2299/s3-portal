# End-to-End Journeys

## E2E-01 New user to shared access lifecycle
- Priority: Critical
- Packs: `PACK-AUTH`, `PACK-TEAM`, `PACK-CREDS`, `PACK-FILES`, `PACK-LINKS`
- Flow:
1. Register new user.
2. Login and land on dashboard.
3. Create credential and bucket.
4. Upload file and verify metadata.
5. Preview file.
6. Create share link.
7. Open share link anonymously.
8. Revoke link and confirm denied access.
- Assertions:
1. DB rows created across user/team/credential/file/link.
2. Access logs present for upload/preview/share/delete actions.

## E2E-02 Invite and permission evolution
- Priority: Critical
- Packs: `PACK-INVITES`, `PACK-ROLES`, `PACK-TEAM`
- Flow:
1. Owner sends invite.
2. Invitee accepts.
3. Admin changes invitee role.
4. Owner changes screen permissions.
5. Invitee attempts file delete and credential update.
- Assertions:
1. Capability changes match updated role/screen permissions.
2. Forbidden actions return proper denial.

## E2E-03 Quota boundary and recovery
- Priority: Critical
- Packs: `PACK-QUOTA`, `PACK-FILES`
- Flow:
1. Set usage near quota.
2. Upload file within limit.
3. Upload file exceeding limit.
4. Delete existing file.
5. Retry blocked upload.
- Assertions:
1. Quota increments/decrements correctly.
2. Exceeding upload blocked before write.

## E2E-04 Reconcile after out-of-band S3 drift
- Priority: Important
- Packs: `PACK-FILES`, `PACK-QUOTA`
- Flow:
1. Remove object directly in S3 (outside app).
2. Trigger admin reconcile.
3. Refresh files UI.
- Assertions:
1. stale DB rows removed or corrected.
2. quota usage updated to reflect reality.

## E2E-05 Owner account deletion with transfer
- Priority: Critical
- Packs: `PACK-TEAM`
- Flow:
1. Owner requests account deletion without transfer target.
2. Retry with valid transfer target.
3. Validate team continuity.
- Assertions:
1. First request fails validation.
2. Second succeeds with ownership transfer and owner soft-delete.
