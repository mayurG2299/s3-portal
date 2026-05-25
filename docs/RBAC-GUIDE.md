# Role-Based Access Control (RBAC) Guide

## Overview

The S3 Portal implements a comprehensive role-based access control system with three role levels:

- **OWNER** (Level 3): Team owner - full control
- **ADMIN** (Level 2): Team administrator - manage resources, users, and settings
- **VIEWER** (Level 1): Team member - view and access resources based on permissions

---

## Architecture

### 1. **Database Layer** (`prisma/schema.prisma`)

```prisma
enum Role {
  OWNER
  ADMIN
  VIEWER
}

model TeamMember {
  id        String   @id @default(cuid())
  teamId    String
  userId    String
  role      Role     @default(VIEWER)
  // ...
}
```

Each user's relationship to a team includes their role, determining what they can do.

---

## Components

### 1. **Authentication Enhancement** (`lib/auth.ts`)

The JWT token and session now include role information:

```typescript
// Token includes:
{
  id: string
  email: string
  role: Role
  teamId: string
}
```

**Usage in components:**
```typescript
const { data: session } = useSession()
const userRole = session?.user?.role // 'OWNER' | 'ADMIN' | 'VIEWER'
const teamId = session?.user?.teamId
```

---

### 2. **Permission Utilities** (`lib/permissions.ts`)

Helper functions for checking permissions:

#### Role Checking
```typescript
import { hasRole, isOwner, isAdmin, isViewer } from '@/lib/permissions'

// Check if user has at least a role level
hasRole(userRole, 'ADMIN') // true if ADMIN or OWNER

// Specific role checks
isOwner(userRole)   // true only if OWNER
isAdmin(userRole)   // true if ADMIN or OWNER
isViewer(userRole)  // true if any role
```

#### Resource Access
```typescript
import {
  canAccessTeam,
  canManageTeam,
  isTeamOwner,
  canAccessCredential,
  canModifyCredential,
  canAccessFile,
} from '@/lib/permissions'

// Check team access
await canAccessTeam(userId, teamId)      // Is user a member?
await canManageTeam(userId, teamId)      // Is user admin/owner?
await isTeamOwner(userId, teamId)        // Is user owner?

// Check credential access
await canAccessCredential(userId, credentialId)   // Can view?
await canModifyCredential(userId, credentialId)   // Can edit/delete?

// Check file access
await canAccessFile(userId, fileId)      // Can access?
```

#### User Team Information
```typescript
import { getUserRoleInTeam, getUserTeams, getUserPrimaryTeam } from '@/lib/permissions'

// Get user's role in specific team
const role = await getUserRoleInTeam(userId, teamId)

// Get all teams user is in
const teams = await getUserTeams(userId)
// Returns: Array<{ id, name, role, ... }>

// Get primary team (first team user joined)
const primaryTeam = await getUserPrimaryTeam(userId)
```

---

### 3. **RBAC Provider** (`components/rbac-provider.tsx`)

React context for accessing RBAC info in client components:

#### Setup
Wrap your app layout with the provider:

```typescript
// app/layout.tsx
import { RBACProvider } from '@/components/rbac-provider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <RBACProvider>
          {children}
        </RBACProvider>
      </body>
    </html>
  )
}
```

#### Hook: `useRBAC()`
Access the full RBAC context:

```typescript
'use client'
import { useRBAC } from '@/components/rbac-provider'

export function MyComponent() {
  const { userId, role, teamId, isOwner, isAdmin, isViewer, hasRole, loading } = useRBAC()

  if (loading) return <div>Loading...</div>

  return (
    <div>
      <p>Your role: {role}</p>
      <p>Team ID: {teamId}</p>
      {isAdmin && <button>Admin Action</button>}
      {hasRole('ADMIN') && <div>Admin Panel</div>}
    </div>
  )
}
```

#### Hook: `useCanAccess()`
Simple hook to check if user has a specific role:

```typescript
const canAccessAdminFeature = useCanAccess('ADMIN')

if (canAccessAdminFeature) {
  return <AdminPanel />
}
```

#### Hook: `useRoleGuard()`
Convenient alias for `useCanAccess()`:

```typescript
const canManage = useRoleGuard('ADMIN')
```

#### HOC: `withRoleGuard()`
Higher-order component to protect entire components:

```typescript
function AdminPanel() {
  return <div>Admin only content</div>
}

export default withRoleGuard(AdminPanel, 'ADMIN', <p>Access Denied</p>)
```

---

### 4. **Middleware** (`middleware.ts`)

Route-level access control for protected pages:

```typescript
// Protected routes requiring specific roles:
/dashboard/teams/*         → Requires ADMIN
/dashboard/credentials/*   → Requires ADMIN
/dashboard/settings/*      → Requires VIEWER
/dashboard/files/*         → Requires VIEWER
/dashboard/links/*         → Requires VIEWER
```

Routes automatically redirect to `/dashboard` if user lacks required role.

---

### 5. **API Utilities** (`lib/api-utils.ts`)

Helper functions for protecting API routes:

#### `checkAuth(session)`
Verify authentication:

```typescript
import { checkAuth, ApiResponse } from '@/lib/api-utils'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const { error, auth } = checkAuth(session)
  
  if (error) return error  // Returns 401
  
  // Use auth.userId, auth.role, auth.teamId
  const userId = auth!.userId
}
```

#### `checkRole(session, minimumRole)`
Verify authentication AND role:

```typescript
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const { error, auth } = checkRole(session, 'ADMIN')
  
  if (error) return error  // Returns 401 or 403
  
  // User has ADMIN or OWNER role
}
```

#### `ApiResponse` helpers
Consistent API response formatting:

```typescript
import { ApiResponse } from '@/lib/api-utils'

// Success
return ApiResponse.success(data)           // 200
return ApiResponse.success(data, 201)      // 201

// Errors
return ApiResponse.error('Message', 500)
return ApiResponse.unauthorized()          // 401
return ApiResponse.forbidden()             // 403
return ApiResponse.notFound()              // 404
return ApiResponse.validationError('Msg')  // 400
```

---

## Common Patterns

### 1. **Protect an API Route**

```typescript
// app/api/admin/users/route.ts
import { checkRole, ApiResponse } from '@/lib/api-utils'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const { error, auth } = checkRole(session, 'ADMIN')
  
  if (error) return error
  
  // Now safe to proceed - user is ADMIN or OWNER
  // auth.userId, auth.role available
  
  return ApiResponse.success({ created: true }, 201)
}
```

### 2. **Conditional Rendering in Components**

```typescript
'use client'
import { useRBAC } from '@/components/rbac-provider'

export function TeamSettings() {
  const { isAdmin, isOwner } = useRBAC()

  return (
    <div>
      <div>General Settings</div>
      
      {isAdmin && (
        <div>
          <h3>Admin Controls</h3>
          <button>Manage Members</button>
        </div>
      )}
      
      {isOwner && (
        <div>
          <h3>Owner Controls</h3>
          <button>Delete Team</button>
        </div>
      )}
    </div>
  )
}
```

### 3. **Server-Side Authorization Check**

```typescript
// app/dashboard/admin/page.tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireRole } from '@/lib/permissions'
import { redirect } from 'next/navigation'

export default async function AdminPage() {
  const session = await getServerSession(authOptions)
  const auth = requireRole(session, 'ADMIN')
  
  if (!auth) {
    redirect('/dashboard')
  }

  return <div>Admin Page</div>
}
```

### 4. **Check Resource-Specific Access**

```typescript
// app/api/credentials/[id]/route.ts
import { canModifyCredential, ApiResponse } from '@/lib/permissions'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkAuth } from '@/lib/api-utils'

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const { error, auth } = checkAuth(session)
  
  if (error) return error
  
  const id = new URL(request.url).searchParams.get('id')
  
  const canDelete = await canModifyCredential(auth!.userId, id!)
  if (!canDelete) {
    return ApiResponse.forbidden()
  }

  // Proceed with deletion
}
```

---

## Role Hierarchy

The system implements a role hierarchy where higher roles inherit permissions of lower roles:

```
OWNER (Level 3)
  ├─ All ADMIN permissions
  └─ Team deletion, ownership transfer
    
ADMIN (Level 2)
  ├─ All VIEWER permissions
  └─ Manage credentials, members, settings
    
VIEWER (Level 1)
  └─ View resources, access files/links
```

Check permissions with: `hasRole(userRole, requiredRole)`

```typescript
const userRole = 'ADMIN'
hasRole(userRole, 'VIEWER')  // true (ADMIN > VIEWER)
hasRole(userRole, 'ADMIN')   // true (ADMIN = ADMIN)
hasRole(userRole, 'OWNER')   // false (ADMIN < OWNER)
```

---

## Database Queries

### Get users by role in a team
```typescript
const admins = await prisma.teamMember.findMany({
  where: {
    teamId: 'team-123',
    role: 'ADMIN',
  },
  include: { user: true },
})
```

### Change user role
```typescript
await prisma.teamMember.update({
  where: {
    teamId_userId: {
      teamId: 'team-123',
      userId: 'user-456',
    },
  },
  data: { role: 'ADMIN' },
})
```

### Get user's teams with roles
```typescript
const teams = await prisma.teamMember.findMany({
  where: { userId: 'user-456' },
  include: { team: true },
})

// teams[i].role -> OWNER | ADMIN | VIEWER
// teams[i].team  -> Full team data
```

---

## Best Practices

1. **Always check auth before checking role** - Invalid auth fails before role check
2. **Use server functions when possible** - `getServerSession()` is more secure than relying on client-side state
3. **Check resource ownership, not just role** - A user can be ADMIN in one team but not another
4. **Fail closed** - Default to denying access if uncertain
5. **Log access attempts** - Log authorization failures for security audit trails
6. **Use TypeScript** - Import types from `@prisma/client` for type safety

---

## Troubleshooting

### Session doesn't include role
- Ensure `auth.ts` callbacks are updated to include role in JWT and session
- Check `NextAuth` version is 4.24.6+

### RBACProvider error
- Wrap app with `RBACProvider` in root layout
- Call `useRBAC()` only in client components (`'use client'`)

### API route returns 403
- Check user has required role for team
- Verify resource (credential, file) belongs to accessible team
- Use `ApiResponse.forbidden()` for permission errors

