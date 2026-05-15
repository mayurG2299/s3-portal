# Screen Tests: Team and Admin

## `/dashboard/teams`

### SCR-TEAM-001 Team management visibility and role restrictions
- Priority: Critical
- Preconditions: Team with owner, admin, viewer
- Data Pack: `PACK-TEAM`, `PACK-ROLES`
- Steps:
1. Open page as owner.
2. Open as admin.
3. Open as viewer.
- Expected:
1. Owner/admin can access and manage members.
2. Viewer is redirected or denied.
- Status: Not Run

### SCR-TEAM-002 Invite send flow and duplicate prevention
- Priority: Critical
- Preconditions: Pending invite fixture for target email
- Data Pack: `PACK-INVITES`
- Steps:
1. Send invite to new user.
2. Send duplicate invite.
- Expected:
1. First invite created.
2. Duplicate attempt rejected with clear error.
- Status: Not Run

## `/dashboard/teams/new`

### SCR-TEAM-010 Team create success and slug validation
- Priority: Important
- Preconditions: Authenticated user
- Data Pack: `PACK-TEAM`
- Steps:
1. Submit valid team name/slug.
2. Submit duplicate slug.
3. Submit invalid slug format.
- Expected:
1. Valid create succeeds.
2. Duplicate/invalid slug rejected.
- Status: Not Run

## `/dashboard/invitations`

### SCR-TEAM-020 Invitation accept and decline flows
- Priority: Important
- Preconditions: Pending invite for logged-in user
- Data Pack: `PACK-INVITES`
- Steps:
1. Accept pending invite.
2. Decline separate pending invite.
- Expected:
1. Accept creates membership and updates status.
2. Decline updates status to canceled.
- Status: Not Run

### SCR-TEAM-021 Expired invite behavior
- Priority: Important
- Preconditions: Expired invite exists
- Data Pack: `PACK-INVITES`
- Steps:
1. Attempt accept on expired invite.
- Expected:
1. Request denied with expiry message.
2. Membership not created.
- Status: Not Run

## `/dashboard/admin/audit`

### SCR-ADM-001 Audit list access control
- Priority: Critical
- Preconditions: Access logs exist
- Data Pack: `PACK-TEAM`
- Steps:
1. Open page as owner/admin.
2. Open as viewer.
- Expected:
1. Authorized actor sees logs.
2. Unauthorized actor denied.
- Status: Not Run

### SCR-ADM-002 Audit row integrity
- Priority: Important
- Preconditions: Perform upload and failed delete to generate logs
- Data Pack: `PACK-FILES`
- Steps:
1. Trigger success and failure actions.
2. Open audit page.
- Expected:
1. Rows include action, actor, success, resource and timestamp.
- Status: Not Run

## `/dashboard/admin/permissions`

### SCR-ADM-010 Screen permission assignment and revoke
- Priority: Critical
- Preconditions: Team members and custom role fixtures
- Data Pack: `PACK-ROLES`, `PACK-TEAM`
- Steps:
1. Grant `FILES_DELETE: EDIT` to custom role member.
2. Revoke permission.
3. Validate UI changes.
- Expected:
1. Permission updates persist.
2. Effective capability changes on protected actions.
- Status: Not Run

### SCR-ADM-011 Permission self-lockout prevention
- Priority: Important
- Preconditions: Owner/admin account executing changes
- Data Pack: `PACK-ROLES`
- Steps:
1. Attempt to revoke own critical admin permission.
- Expected:
1. Behavior is explicit and safe.
2. If allowed by design, document recovery path.
- Status: Not Run
