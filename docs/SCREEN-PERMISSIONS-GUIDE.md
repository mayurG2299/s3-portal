# Screen/Feature-Level RBAC Guide

## Overview

Beyond role-based access control, the S3 Portal supports **granular screen/feature-level permissions**. This allows you to:

- Give specific users access to features their role doesn't normally allow
- Restrict features from users with higher roles if needed
- Grant "VIEW" or "EDIT" level access on individual screens

---

## Architecture

### Database Layer

```prisma
enum PermissionLevel {
  VIEW    // Can only view the screen/feature
  EDIT    // Can view and edit the screen/feature
}

enum ScreenName {
  // Files management
  FILES_LIST
  FILES_UPLOAD
  FILES_DELETE
  FILES_SHARE
  
  // Credentials management
  CREDENTIALS_LIST
  CREDENTIALS_CREATE
  CREDENTIALS_EDIT
  CREDENTIALS_DELETE
  
  // Team management
  TEAM_SETTINGS
  TEAM_MEMBERS
  TEAM_INVITATIONS
  TEAM_DELETE
  
  // Links management
  LINKS_LIST
  LINKS_CREATE
  LINKS_DELETE
  
  // Admin features
  ADMIN_AUDIT_LOG
  ADMIN_SETTINGS
}

model ScreenPermission {
  id              String           @id
  teamMemberId    String
  screenName      ScreenName
  permissionLevel PermissionLevel  @default(VIEW)
  
  teamMember      TeamMember       @relation(fields: [teamMemberId])
}
```

### Default Permissions by Role

**OWNER** - Full access to all screens with EDIT level

**ADMIN** - Access to:
- FILES: LIST, UPLOAD, DELETE, SHARE
- CREDENTIALS: LIST, CREATE, EDIT, DELETE
- TEAM: SETTINGS, MEMBERS, INVITATIONS
- LINKS: LIST, CREATE, DELETE
- ADMIN: AUDIT_LOG

**VIEWER** - Access to:
- FILES: LIST, UPLOAD, SHARE (VIEW level)
- CREDENTIALS: LIST (VIEW level)
- LINKS: LIST, CREATE

---

## Screen Permission Constants

Import available screens:

```typescript
import { SCREENS } from '@/lib/screen-permissions'

// Use like:
SCREENS.FILES_LIST        // 'FILES_LIST'
SCREENS.CREDENTIALS_CREATE // 'CREDENTIALS_CREATE'
SCREENS.TEAM_MEMBERS      // 'TEAM_MEMBERS'
```

---

## Permission Management Functions

### Check Permissions (Server-Side)

```typescript
import {
  canViewScreen,
  canEditScreen,
  getUserScreenPermission,
} from '@/lib/permissions'

// Check if user can view a screen
const canView = await canViewScreen(userId, teamId, SCREENS.FILES_UPLOAD)

// Check if user can edit a screen
const canEdit = await canEditScreen(userId, teamId, SCREENS.CREDENTIALS_EDIT)

// Get specific permission level ('VIEW', 'EDIT', or null)
const permission = await getUserScreenPermission(userId, teamId, SCREENS.FILES_DELETE)
// Returns: 'VIEW' | 'EDIT' | null
```

### Get User Permissions

```typescript
import { getUserScreenPermissions, getUsersWithScreenPermission } from '@/lib/permissions'

// Get all screen permissions for a user in a team
const permissions = await getUserScreenPermissions(userId, teamId)
// Returns: Array<{ screenName, permissionLevel }>

// Get all users with a specific screen permission
const users = await getUsersWithScreenPermission(teamId, SCREENS.FILES_DELETE)
// Returns: Array with user details
```

### Grant/Revoke Permissions

```typescript
import {
  grantScreenPermission,
  revokeScreenPermission,
  setUserScreenPermissions,
} from '@/lib/permissions'

// Grant a single permission
await grantScreenPermission(userId, teamId, SCREENS.FILES_UPLOAD, 'EDIT')

// Revoke a specific permission (returns to role defaults)
await revokeScreenPermission(userId, teamId, SCREENS.CREDENTIALS_DELETE)

// Set multiple permissions at once
await setUserScreenPermissions(userId, teamId, [
  { screenName: SCREENS.FILES_UPLOAD, permissionLevel: 'EDIT' },
  { screenName: SCREENS.CREDENTIALS_LIST, permissionLevel: 'VIEW' },
  { screenName: SCREENS.TEAM_MEMBERS, permissionLevel: 'EDIT' },
])
```

---

## Client-Side Usage

### Using Hooks

```typescript
'use client'
import { useRBAC, useCanViewScreen, useCanEditScreen, useScreenPermission } from '@/components/rbac-provider'
import { SCREENS } from '@/lib/screen-permissions'

export function FileManager() {
  const rbac = useRBAC()
  
  // Individual hooks
  const canUpload = useCanViewScreen(SCREENS.FILES_UPLOAD)
  const canDelete = useCanEditScreen(SCREENS.FILES_DELETE)
  
  // Or use generic hook
  const canViewLinks = useScreenPermission(SCREENS.LINKS_LIST, 'VIEW')
  const canEditSettings = useScreenPermission(SCREENS.TEAM_SETTINGS, 'EDIT')

  if (rbac.loadingScreenPermissions) return <div>Loading...</div>

  return (
    <div>
      {canUpload && <button>Upload File</button>}
      {canDelete && <button>Delete File</button>}
      {canEditSettings && <button>Team Settings</button>}
    </div>
  )
}
```

### Higher-Order Component

```typescript
import { withScreenGuard } from '@/components/rbac-provider'
import { SCREENS } from '@/lib/screen-permissions'

function AdminSettings() {
  return <div>Admin Configuration</div>
}

// Protect with 'VIEW' permission
export default withScreenGuard(AdminSettings, SCREENS.ADMIN_SETTINGS, 'VIEW')

// Or with 'EDIT' permission
export const AdminSettingsEditor = withScreenGuard(
  AdminSettings,
  SCREENS.ADMIN_SETTINGS,
  'EDIT',
  <div>You don't have permission to edit settings</div>
)
```

---

## API Endpoints

### Get Current User's Screen Permissions

```bash
GET /api/permissions/screens?teamId=team-123

Response:
[
  { screenName: 'FILES_UPLOAD', permissionLevel: 'EDIT' },
  { screenName: 'CREDENTIALS_LIST', permissionLevel: 'VIEW' }
]
```

### Grant Screen Permission (Admin)

```bash
POST /api/permissions/screens

Body:
{
  "teamId": "team-123",
  "userId": "user-456",
  "screenName": "FILES_DELETE",
  "permissionLevel": "EDIT"
}

Response:
{
  "id": "perm-789",
  "screenName": "FILES_DELETE",
  "permissionLevel": "EDIT"
}
```

### Revoke Screen Permission (Admin)

```bash
DELETE /api/permissions/screens?teamId=team-123&userId=user-456&screenName=FILES_DELETE

Response:
{ "success": true }
```

### Set Multiple Permissions (Admin)

```bash
PATCH /api/permissions/screens

Body:
{
  "teamId": "team-123",
  "userId": "user-456",
  "permissions": [
    { "screenName": "FILES_UPLOAD", "permissionLevel": "EDIT" },
    { "screenName": "CREDENTIALS_EDIT", "permissionLevel": "VIEW" },
    { "screenName": "TEAM_SETTINGS", "permissionLevel": "EDIT" }
  ]
}

Response:
{ "success": true }
```

---

## Protecting API Routes

### Check Screen Permission in API

```typescript
import { checkScreenPermission, ApiResponse } from '@/lib/api-utils'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SCREENS } from '@/lib/screen-permissions'

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  // Check screen permission
  const { error, auth } = await checkScreenPermission(
    session,
    teamId,
    SCREENS.FILES_DELETE,
    'EDIT'  // Require EDIT level
  )
  
  if (error) return error
  
  // Proceed with deletion
  return ApiResponse.success({ deleted: true })
}
```

---

## Common Patterns

### 1. Allow Specific User to Upload Files (Override)

A VIEWER normally can't delete files. Grant them permission:

```typescript
await grantScreenPermission(
  userId,
  teamId,
  SCREENS.FILES_DELETE,
  'EDIT'
)
```

### 2. Restrict Admin from Sensitive Action

An ADMIN normally can delete credentials. Revoke permission:

```typescript
await revokeScreenPermission(
  userId,
  teamId,
  SCREENS.CREDENTIALS_DELETE
)
```

### 3. Show/Hide Buttons Based on Permission

```typescript
export function FileActions({ fileId }: { fileId: string }) {
  const canDelete = useCanEditScreen(SCREENS.FILES_DELETE)
  const canShare = useCanViewScreen(SCREENS.FILES_SHARE)

  return (
    <div>
      {canShare && (
        <button onClick={() => shareFile(fileId)}>Share</button>
      )}
      {canDelete && (
        <button onClick={() => deleteFile(fileId)}>Delete</button>
      )}
    </div>
  )
}
```

### 4. Conditional API Route

```typescript
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  // Check both role and screen permission
  const roleCheck = checkRole(session, 'ADMIN')
  if (roleCheck.error) return roleCheck.error
  
  // Further restrict by screen permission
  const screenCheck = await checkScreenPermission(
    session,
    teamId,
    SCREENS.CREDENTIALS_CREATE,
    'EDIT'
  )
  if (screenCheck.error) return screenCheck.error
  
  // Both checks passed
  // ... create credential ...
}
```

### 5. Admin Panel to Manage User Permissions

```typescript
'use client'
import { SCREENS } from '@/lib/screen-permissions'

export async function UserPermissionManager({ userId, teamId }: Props) {
  const handleGrantPermission = async (screenName: string) => {
    const response = await fetch('/api/permissions/screens', {
      method: 'POST',
      body: JSON.stringify({
        teamId,
        userId,
        screenName,
        permissionLevel: 'EDIT',
      }),
    })
    
    if (response.ok) {
      // Update UI
      alert('Permission granted!')
    }
  }

  return (
    <div>
      {Object.entries(SCREENS).map(([key, screenName]) => (
        <button
          key={screenName}
          onClick={() => handleGrantPermission(screenName)}
        >
          Grant {key}
        </button>
      ))}
    </div>
  )
}
```

---

## Permission Level Semantics

### VIEW (Level 1)
- User can access and view the screen
- User can perform read-only operations
- Usually allows searching, filtering, exporting

### EDIT (Level 2)
- Includes all VIEW permissions
- User can modify, create, or delete resources
- User can manage settings related to the screen

### No Permission (Level 0)
- Screen/feature is completely hidden
- User gets "Access Denied" if they try to access it
- Feature not available for the user

---

## Database Queries

### Get all permissions for a team member

```typescript
const teamMember = await prisma.teamMember.findUnique({
  where: {
    teamId_userId: { teamId, userId }
  },
  include: {
    permissions: true
  }
})

console.log(teamMember.permissions)
// Array of ScreenPermission records
```

### Update permission level

```typescript
await prisma.screenPermission.update({
  where: {
    teamMemberId_screenName: {
      teamMemberId: 'tm-123',
      screenName: 'FILES_DELETE'
    }
  },
  data: {
    permissionLevel: 'EDIT'
  }
})
```

### Get users who can access specific screen

```typescript
const admins = await prisma.screenPermission.findMany({
  where: {
    screenName: 'ADMIN_SETTINGS',
    permissionLevel: 'EDIT',
    teamMember: {
      teamId: 'team-123'
    }
  },
  include: {
    teamMember: {
      include: {
        user: true
      }
    }
  }
})
```

---

## Best Practices

1. **Always check on server** - Never trust client-side permission checks for security
2. **Cache permissions** - The RBAC provider caches permissions in context
3. **Use hooks over direct API** - Hooks provide better UX and error handling
4. **Log permission changes** - Audit trail for who changed what permissions
5. **Test both scenarios** - Test with and without specific permissions
6. **Combine with roles** - Use screen permissions to refine role-based access
7. **Default to deny** - If permission is not found, deny access
8. **Consider performance** - Batch permission checks when possible

---

## Troubleshooting

### Screen permissions not loading

- Check RBACProvider wraps your app in layout
- Verify `/api/permissions/screens` endpoint is accessible
- Check browser console for API errors

### Permission change not reflecting immediately

- Permissions are cached in RBACProvider context
- Refresh page to re-fetch from server
- Or clear cache and call fetch manually

### User can access screen but shouldn't

- Check if role has default permission for that screen
- Verify no explicit permission grants override
- Check if user's teamId is set correctly in session

