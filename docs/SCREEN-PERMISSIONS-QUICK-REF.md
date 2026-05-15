# Screen Permissions Quick Reference

## Imports

```typescript
// Constants
import { SCREENS } from '@/lib/screen-permissions'

// Server-side functions
import {
  canViewScreen,
  canEditScreen,
  getUserScreenPermission,
  grantScreenPermission,
  revokeScreenPermission,
  setUserScreenPermissions,
  getUserScreenPermissions,
  getUsersWithScreenPermission,
} from '@/lib/permissions'

// Client-side hooks
import {
  useRBAC,
  useScreenPermission,
  useCanViewScreen,
  useCanEditScreen,
  withScreenGuard,
} from '@/components/rbac-provider'

// API utilities
import { checkScreenPermission, ApiResponse } from '@/lib/api-utils'
```

---

## Screen Names (Enum)

```typescript
SCREENS.FILES_LIST
SCREENS.FILES_UPLOAD
SCREENS.FILES_DELETE
SCREENS.FILES_SHARE

SCREENS.CREDENTIALS_LIST
SCREENS.CREDENTIALS_CREATE
SCREENS.CREDENTIALS_EDIT
SCREENS.CREDENTIALS_DELETE

SCREENS.TEAM_SETTINGS
SCREENS.TEAM_MEMBERS
SCREENS.TEAM_INVITATIONS
SCREENS.TEAM_DELETE

SCREENS.LINKS_LIST
SCREENS.LINKS_CREATE
SCREENS.LINKS_DELETE

SCREENS.ADMIN_AUDIT_LOG
SCREENS.ADMIN_SETTINGS
```

---

## Common Operations

### Check Permission (Server)

```typescript
// Single check
const perm = await getUserScreenPermission(userId, teamId, SCREENS.FILES_UPLOAD)
// Returns: 'VIEW' | 'EDIT' | null

// Binary checks
const canView = await canViewScreen(userId, teamId, SCREENS.FILES_UPLOAD)
const canEdit = await canEditScreen(userId, teamId, SCREENS.CREDENTIALS_DELETE)
```

### Check Permission (Client)

```typescript
'use client'

// Using hooks
const canUpload = useCanViewScreen(SCREENS.FILES_UPLOAD)
const canDelete = useCanEditScreen(SCREENS.FILES_DELETE)

// Or generic hook
const hasAccess = useScreenPermission(SCREENS.TEAM_SETTINGS, 'EDIT')

// Via context
const { canViewScreen, canEditScreen } = useRBAC()
const canAccess = canViewScreen(SCREENS.FILES_DELETE)
```

### Grant Permission

```typescript
await grantScreenPermission(userId, teamId, SCREENS.FILES_DELETE, 'EDIT')
```

### Revoke Permission

```typescript
await revokeScreenPermission(userId, teamId, SCREENS.CREDENTIALS_CREATE)
```

### Set Multiple Permissions

```typescript
await setUserScreenPermissions(userId, teamId, [
  { screenName: SCREENS.FILES_UPLOAD, permissionLevel: 'EDIT' },
  { screenName: SCREENS.TEAM_SETTINGS, permissionLevel: 'VIEW' },
])
```

### Get All Permissions for User

```typescript
const permissions = await getUserScreenPermissions(userId, teamId)
// Returns: Array<{ screenName, permissionLevel }>
```

---

## Protect Routes

### Component (Client)

```typescript
'use client'
import { useCanViewScreen } from '@/components/rbac-provider'
import { SCREENS } from '@/lib/screen-permissions'

export function AdminPanel() {
  const canAccess = useCanViewScreen(SCREENS.ADMIN_SETTINGS)
  
  if (!canAccess) return <div>Access Denied</div>
  
  return <div>Admin Panel</div>
}

// Or with HOC
import { withScreenGuard } from '@/components/rbac-provider'

export default withScreenGuard(AdminPanel, SCREENS.ADMIN_SETTINGS)
```

### API Route

```typescript
import { checkScreenPermission, ApiResponse } from '@/lib/api-utils'
import { SCREENS } from '@/lib/screen-permissions'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const { error, auth } = await checkScreenPermission(
    session,
    teamId,
    SCREENS.FILES_DELETE,
    'EDIT'  // Require EDIT level
  )
  
  if (error) return error
  
  // Safe to proceed
  return ApiResponse.success({ success: true })
}
```

---

## Conditional UI

```typescript
'use client'
import { useCanViewScreen, useCanEditScreen } from '@/components/rbac-provider'
import { SCREENS } from '@/lib/screen-permissions'

export function FileActions({ fileId }: { fileId: string }) {
  const canDelete = useCanEditScreen(SCREENS.FILES_DELETE)
  const canShare = useCanViewScreen(SCREENS.FILES_SHARE)

  return (
    <div>
      {canShare && <button>Share File</button>}
      {canDelete && <button>Delete File</button>}
    </div>
  )
}
```

---

## Permission Management Panel

```typescript
'use client'

export function UserPermissions({ userId, teamId }: Props) {
  const handleGrant = async (screenName: string, level: 'VIEW' | 'EDIT') => {
    const res = await fetch('/api/permissions/screens', {
      method: 'POST',
      body: JSON.stringify({ teamId, userId, screenName, permissionLevel: level }),
    })
    if (res.ok) alert('Permission granted!')
  }

  const handleRevoke = async (screenName: string) => {
    const res = await fetch(
      `/api/permissions/screens?teamId=${teamId}&userId=${userId}&screenName=${screenName}`,
      { method: 'DELETE' }
    )
    if (res.ok) alert('Permission revoked!')
  }

  return (
    <div>
      {/* List screens and buttons */}
    </div>
  )
}
```

---

## API Calls

### GET Current Permissions
```typescript
const res = await fetch(`/api/permissions/screens?teamId=${teamId}`)
const permissions = await res.json()
```

### POST Grant Permission
```typescript
const res = await fetch('/api/permissions/screens', {
  method: 'POST',
  body: JSON.stringify({
    teamId,
    userId,
    screenName: 'FILES_DELETE',
    permissionLevel: 'EDIT',
  }),
})
```

### DELETE Revoke Permission
```typescript
const res = await fetch(
  `/api/permissions/screens?teamId=${teamId}&userId=${userId}&screenName=FILES_DELETE`,
  { method: 'DELETE' }
)
```

### PATCH Set Multiple
```typescript
const res = await fetch('/api/permissions/screens', {
  method: 'PATCH',
  body: JSON.stringify({
    teamId,
    userId,
    permissions: [
      { screenName: 'FILES_DELETE', permissionLevel: 'EDIT' },
      { screenName: 'TEAM_SETTINGS', permissionLevel: 'VIEW' },
    ],
  }),
})
```

---

## Permission Levels

| Level | Can View | Can Edit | Can Delete | Notes |
|-------|----------|----------|-----------|-------|
| EDIT | ✓ | ✓ | ✓ | Full access |
| VIEW | ✓ | ✗ | ✗ | Read-only |
| None | ✗ | ✗ | ✗ | No access |

---

## Default Permissions by Role

| Screen | OWNER | ADMIN | VIEWER |
|--------|-------|-------|--------|
| FILES_LIST | EDIT | EDIT | VIEW |
| FILES_UPLOAD | EDIT | EDIT | VIEW |
| FILES_DELETE | EDIT | EDIT | ✗ |
| FILES_SHARE | EDIT | EDIT | VIEW |
| CREDENTIALS_LIST | EDIT | EDIT | VIEW |
| CREDENTIALS_CREATE | EDIT | EDIT | ✗ |
| CREDENTIALS_EDIT | EDIT | EDIT | ✗ |
| CREDENTIALS_DELETE | EDIT | EDIT | ✗ |
| TEAM_SETTINGS | EDIT | EDIT | ✗ |
| TEAM_MEMBERS | EDIT | EDIT | ✗ |
| TEAM_INVITATIONS | EDIT | EDIT | ✗ |
| TEAM_DELETE | EDIT | ✗ | ✗ |
| LINKS_LIST | EDIT | EDIT | VIEW |
| LINKS_CREATE | EDIT | EDIT | VIEW |
| LINKS_DELETE | EDIT | EDIT | ✗ |
| ADMIN_AUDIT_LOG | EDIT | EDIT | ✗ |
| ADMIN_SETTINGS | EDIT | ✗ | ✗ |

---

## Use Cases

### Allow VIEWER to Delete Files
```typescript
await grantScreenPermission(userId, teamId, SCREENS.FILES_DELETE, 'EDIT')
```

### Prevent ADMIN from Deleting Team
```typescript
await revokeScreenPermission(userId, teamId, SCREENS.TEAM_DELETE)
```

### Give READ-only Access to Credentials
```typescript
await grantScreenPermission(userId, teamId, SCREENS.CREDENTIALS_EDIT, 'VIEW')
```

### Bulk Update User Permissions
```typescript
await setUserScreenPermissions(userId, teamId, [
  { screenName: SCREENS.FILES_UPLOAD, permissionLevel: 'EDIT' },
  { screenName: SCREENS.CREDENTIALS_LIST, permissionLevel: 'VIEW' },
  { screenName: SCREENS.LINKS_CREATE, permissionLevel: 'EDIT' },
])
```

---

## Errors

### Access Denied
```
Status: 403
Body: { message: "Forbidden: No access to this screen" }
```

### Not Authenticated
```
Status: 401
Body: { message: "Unauthorized" }
```

### Invalid Input
```
Status: 400
Body: { message: "teamId, userId, and screenName are required" }
```

