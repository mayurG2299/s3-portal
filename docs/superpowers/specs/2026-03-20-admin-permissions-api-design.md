# Admin Permissions API Route Design

**Date:** 2026-03-20

## Overview
Adds a RESTful API route for admin permissions management. Supports listing all team members and their screen permissions, updating permissions for a team member, and auditing changes. Follows existing security, RBAC, and audit patterns.

## Endpoints

### GET /api/admin/permissions?teamId=...
- Lists all team members and their screen permissions for the specified team.
- Requires admin/owner access.
- Response: Array of members with user info, role, and screen permissions.

### POST /api/admin/permissions
- Updates screen permissions for a team member.
- Requires admin/owner access.
- Request: `{ teamId, userId, permissions: [{ screenName, permissionLevel }] }`
- Response: Updated permissions for the user.

## Audit Logging
- All changes are logged via `logUserAction` for both success and failure.

## Error Handling
- Uses `ApiResponse` helpers for consistent responses.
- Returns 401/403 for unauthorized/forbidden, 404 for not found, 400 for validation errors.

## Security
- Authentication and authorization enforced via `requireScreenPermission`.
- Verifies resource ownership for all operations.

## Testing
- Unit tests for all endpoints, mocking DB and AWS calls.
- Test cases for permission checks, error handling, and audit logging.

## Implementation Plan
- Add route file: `app/api/admin/permissions/route.ts`
- Implement GET and POST handlers.
- Integrate audit logging and error handling.
- Add unit tests in `__tests__/admin/permissions.test.ts`
- Update docs and RBAC diagrams as needed.
