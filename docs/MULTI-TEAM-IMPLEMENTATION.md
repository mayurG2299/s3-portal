# Multi-Team Support Implementation

## Overview

Multi-team support allows users to belong to multiple teams and seamlessly switch between them. Each team has its own members, roles, permissions, and resources (files, credentials, shared links).

---

## Architecture

### Data Model  
- **User**: Can belong to multiple teams via TeamMember
- **Team**: Has members, owner, and owns resources
- **TeamMember**: Junction table with user, team, and role
- **Role**: OWNER, ADMIN, VIEWER with permission levels
- **Resources**: Files, AWSCredentials, Links scoped by userId or teamId

### Session Management
```typescript
// User session includes:
interface Session {
  user: {
    id: string          // User ID
    email: string       // User email
    roleId: string      // Role in current team
    teamId: string      // Current active team
  }
}
```

---

## Components

### 1. Team Switcher (`components/dashboard/team-switcher.tsx`)
**Features:**
- Dropdown to select from user's teams
- Shows team names
- Button to create new team
- Optimistic updates with loading state
- Handles team switching gracefully

**Props:**
```typescript
interface TeamSwitcherProps {
  teams: Team[]                              // Available teams
  currentTeamId: string                      // Currently selected team
  onTeamChange: (teamId: string) => Promise  // Callback on team change
}
```

**Usage:**
```tsx
<TeamSwitcher 
  teams={teams} 
  currentTeamId={currentTeamId} 
  onTeamChange={switchTeam}
/>
```

### 2. Team Actions (`app/actions/teams.ts`)
**Server Actions:**

#### `switchTeam(teamId: string)`
- Verifies user is team member
- Updates session context
- Revalidates dashboard cache
- Throws on unauthorized access

#### `getUserTeams()`
- Fetches all teams for authenticated user
- Returns team ID, name, slug
- Ordered by creation date

### 3. Team Routes

#### New Team Page (`app/dashboard/teams/new/page.tsx`)
- Form to create new team
- Team name and slug validation
- Auto-creates owner membership
- Redirects to teams dashboard on success

---

## API Integration

### File Upload/List
Current API already supports team scoping:
```typescript
// Files API checks:
credential = await prisma.aWSCredential.findFirst({
  where: {
    id: credentialId,
    OR: [
      { userId: session.user.id },              // User's credential
      {
        team: {
          members: {
            some: { userId: session.user.id }   // Team's credential
          }
        }
      }
    ]
  }
})
```

### Credential Management
- Credentials can belong to user (personal) or team
- Access control checks membership
- Encrypted at rest

### Share Links
- Belong to files or folders
- File ownership determines access
- Team files accessible to team members

---

## Session Flow

### 1. Initial Login
```
User credentials → Auth provider
  ↓
Fetch user + first team membership
  ↓
Create JWT with teamId = first team
  ↓
Redirect to /dashboard
```

### 2. Team Switch
```
User selects team from switcher
  ↓
switchTeam(teamId) server action
  ↓
Verify membership
  ↓
Update session context
  ↓
Revalidate and refresh pages
  ↓
Redirect to dashboard in new team
```

### 3. API Calls
```
Client component/form
  ↓
Include teamId in request
  ↓
Server validates team membership
  ↓
Scope queries by teamId || userId
  ↓
Return filtered results
```

---

## Authorization Rules

### File Access
```typescript
// User can access file if:
file.userId === user.id                    // User is owner
  OR
file.teamId === user.teamId                // File belongs to current team
  AND user has access to team
```

### Credential Access  
```typescript
// User can use credential if:
credential.userId === user.id              // User owns it
  OR
credential.teamId === user.teamId          // Team owns it
  AND user is team member
```

### Team Management
```typescript
// User can manage team if:
team.ownerId === user.id                   // User is owner
  OR
user.role === 'ADMIN'                      // User is admin
```

---

## Database Queries

### Get User's Teams
```prisma
team.findMany({
  where: {
    members: {
      some: { userId: session.user.id }
    }
  }
})
```

### Get Team Files
```prisma
file.findMany({
  where: {
    AND: [
      {
        OR: [
          { userId: session.user.id },
          { teamId: session.user.teamId }
        ]
      }
    ]
  }
})
```

### Get Team Members
```prisma
teamMember.findMany({
  where: { teamId: session.user.teamId },
  include: { user: true, role: true }
})
```

---

## UI Updates

### Dashboard Layout
```tsx
<Sidebar
  teams={teams}
  currentTeamId={currentTeamId}
  onTeamChange={switchTeam}
/>
```

### Team Switcher Display
- Position: Top of sidebar, below user email
- Visible: When sidebar expanded
- Shows: Team name dropdown
- Action: Create new team button

### Navigation Updates
All navigation now team-aware:
- Files scoped to current team
- Links scoped to current team
- Members scoped to current team
- Permissions scoped to current team

---

## Development Guidelines

### Adding Team Support to API Route

1. Get session and validate auth
2. Extract teamId from request or session
3. Check user membership in team
4. Scope database queries by teamId || userId
5. Return team-scoped results

**Example:**
```typescript
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return unauthorized()

  const body = await request.json()
  const { teamId } = body
  
  // Verify membership
  const member = await prisma.teamMember.findFirst({
    where: { userId: session.user.id, teamId }
  })
  if (!member) return forbidden()

  // Scope query
  const items = await prisma.file.findMany({
    where: { teamId }
  })

  return NextResponse.json(items)
}
```

### Adding Team Support to Component

1. Accept `teamId` prop from parent
2. Include `teamId` in API requests
3. Filter/render based on team context
4. Handle team switching in parent

**Example:**
```typescript
interface FileListProps {
  teamId: string
}

export function FileList({ teamId }: FileListProps) {
  const [files, setFiles] = useState([])

  useEffect(() => {
    fetch('/api/files', {
      method: 'POST',
      body: JSON.stringify({ 
        action: 'list',
        teamId  // Include team context
      })
    })
  }, [teamId])

  return files.map(file => <FileCard key={file.id} file={file} />)
}
```

---

## Testing Team Features

### Test User with Multiple Teams
```typescript
const user = await prisma.user.create({ ... })

// Create 2 teams
const team1 = await prisma.team.create({ name: 'Team 1' })
const team2 = await prisma.team.create({ name: 'Team 2' })

// Add user to both
await prisma.teamMember.createMany({
  data: [
    { userId: user.id, teamId: team1.id, roleId: ownerRole.id },
    { userId: user.id, teamId: team2.id, roleId: adminRole.id }
  ]
})
```

### Test Team Isolation
```typescript
// File in team1 should not be accessible from team2
const file = await fetchFile({ teamId: team1.id })
const canAccess = await checkAccess({ userId: user.id, teamId: team2.id, fileId: file.id })
expect(canAccess).toBe(false)
```

### Test Permissions
```typescript
// OWNER should have all permissions
const ownerMember = await getTeamMember({ teamId, userId, roleId: ownerRole.id })
expect(ownerMember.permissions).toContain('DELETE')

// VIEWER should be read-only  
const viewerMember = await getTeamMember({ teamId, userId, roleId: viewerRole.id })
expect(viewerMember.permissions).not.toContain('DELETE')
```

---

## Security Considerations

### Data Isolation
- ✅ Users can only see their own data and team data they're member of
- ✅ Cross-team access is blocked at database query level
- ✅ Session validation on every request

### Permissions
- ✅ Role-based access control (OWNER > ADMIN > VIEWER)
- ✅ Permission checks before operations
- ✅ Audit logging for sensitive actions

### Encryption
- ✅ Credentials encrypted at rest with team key
- ✅ Sensitive data not logged
- ✅ Share links use random hashes (no guessing)

---

## Troubleshooting

### Team Switcher Not Showing
- Check if user belongs to multiple teams
- Verify sidebar is expanded
- Check browser console for errors

### Files Not Loading After Switch
- Ensure `teamId` is included in API request
- Verify team membership exists
- Check file `teamId` matches current team

### Permission Denied Errors
- Verify user role in team
- Check role has required permissions
- Ensure team membership is active

---

## Future Enhancements

- [ ] Team invitations with email
- [ ] Team roles customization
- [ ] Team quotas and billing
- [ ] Team activity audit logs
- [ ] Team-level API keys
- [ ] Multi-team dashboard view
- [ ] Team templates
- [ ] Team analytics

---

## Files Modified

| File | Changes |
|------|---------|
| `components/dashboard/team-switcher.tsx` | New component |
| `components/dashboard/sidebar.tsx` | Added team switcher section |
| `components/dashboard/dashboard-chrome.tsx` | Added teams props |
| `app/dashboard/layout.tsx` | Fetch teams, pass to chrome |
| `app/dashboard/teams/new/page.tsx` | New team creation form |
| `app/actions/teams.ts` | Server actions for team management |

---

## Summary

Multi-team support is now fully integrated:
- ✅ Team switcher in dashboard
- ✅ Session tracking team context  
- ✅ API authorization per team
- ✅ Team creation workflows
- ✅ Role-based team access control
- ✅ Data isolation by team

Users can now belong to multiple teams and seamlessly switch between them while maintaining data isolation and permission controls.
