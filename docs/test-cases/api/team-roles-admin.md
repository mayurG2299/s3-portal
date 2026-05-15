# API Tests: Team, Roles, Permissions, Admin

## `/api/team/members` POST

### API-TEAM-001 Add member success
- Priority: Critical
- Preconditions: actor can manage team
- Data Pack: `PACK-TEAM`
- Expected: team member created with target role.
- AccessLog Assertions: member-add success.

### API-TEAM-002 Add member forbidden
- Priority: Critical
- Preconditions: viewer/non-member actor
- Expected: `403`.

## `/api/team/members` GET

### API-TEAM-010 List members scoped
- Priority: Important
- Preconditions: authenticated team actor
- Expected: only current team members returned.

## `/api/team/members/role` PATCH

### API-TEAM-020 Role change success with hierarchy
- Priority: Critical
- Preconditions: actor has manage rights and hierarchy permits
- Expected: role updated.

### API-TEAM-021 Role change blocked by hierarchy/self-change constraints
- Priority: Critical
- Preconditions: actor attempts disallowed mutation
- Expected: `400` or `403`.

## `/api/team/invites` GET

### API-INV-001 List pending invites for current user
- Priority: Important
- Preconditions: pending invite fixtures
- Expected: only matching email invites returned.

## `/api/team/invites` POST

### API-INV-010 Send invite success
- Priority: Critical
- Preconditions: actor can manage invites
- Expected: invite created with pending status and expiry.

### API-INV-011 Send invite duplicate or existing-member rejection
- Priority: Important
- Preconditions: duplicate or existing member target
- Expected: validation failure.

## `/api/team/invites/[id]` PATCH

### API-INV-020 Accept invite success
- Priority: Critical
- Preconditions: invite belongs to actor email and is pending
- Expected: membership created and invite status updated.

### API-INV-021 Decline invite success
- Priority: Important
- Preconditions: pending invite
- Expected: invite status canceled.

### API-INV-022 Expired or mismatched invite denied
- Priority: Critical
- Preconditions: expired invite or different actor email
- Expected: denied and no membership changes.

## `/api/roles` GET/POST

### API-ROLE-001 Roles list success
- Priority: Important
- Preconditions: authenticated actor with access
- Expected: roles returned with permission metadata where implemented.

### API-ROLE-002 Create custom role success
- Priority: Critical
- Preconditions: actor can manage roles
- Expected: role created with valid level constraints.

### API-ROLE-003 Create custom role denied for unauthorized actor
- Priority: Critical
- Preconditions: viewer or non-member
- Expected: `403`.

## `/api/roles/[id]` GET/DELETE

### API-ROLE-010 Get role details success
- Priority: Important
- Preconditions: valid role id and authorized actor
- Expected: role details returned.

### API-ROLE-011 Delete role success and system-role protection
- Priority: Critical
- Preconditions: custom role vs system role fixture
- Expected:
1. custom role deletion allowed where valid.
2. protected/system role deletion blocked.

## `/api/roles/permissions` POST

### API-ROLEPERM-001 Update role permission matrix success
- Priority: Critical
- Preconditions: actor with manage rights
- Expected: role permission row updated.

### API-ROLEPERM-002 Unauthorized update denied
- Priority: Critical
- Preconditions: unauthorized actor
- Expected: `403`.

## `/api/permissions/screens` GET/POST/DELETE/PATCH

### API-SCREENPERM-001 Read member screen permissions
- Priority: Important
- Preconditions: authorized actor
- Expected: per-member screen permissions returned.

### API-SCREENPERM-002 Grant and revoke screen permission
- Priority: Critical
- Preconditions: authorized actor and target team member
- Expected: permission row created/updated/deleted correctly.

### API-SCREENPERM-003 Unauthorized screen permission mutation denied
- Priority: Critical
- Preconditions: viewer/non-member
- Expected: `403`.

## `/api/admin/audit` GET

### API-ADM-001 Audit retrieval success
- Priority: Critical
- Preconditions: actor with admin audit access
- Expected: logs returned with filters honored.

### API-ADM-002 Audit retrieval denied for unauthorized actor
- Priority: Critical
- Preconditions: viewer/non-member
- Expected: `403`.

## `/api/admin/quota` GET/POST

### API-ADM-010 Quota read and update success
- Priority: Critical
- Preconditions: actor with `ADMIN_SETTINGS`
- Expected: read and mutation succeed with validated limits.

### API-ADM-011 Quota access denied for missing permission
- Priority: Critical
- Preconditions: actor without admin settings permission
- Expected: `403`.

## `/api/admin/reconcile` POST

### API-ADM-020 Reconcile trigger success
- Priority: Critical
- Preconditions: authorized actor and target team context
- Expected: reconcile job executes and returns summary.

### API-ADM-021 Reconcile trigger denied
- Priority: Critical
- Preconditions: unauthorized actor
- Expected: `403`.
