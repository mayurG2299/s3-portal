# Screen-Level RBAC - Visual Architecture & Diagrams

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER LOGIN                                 │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────────┐
                    │  next-auth Session │
                    │  ├─ userId         │
                    │  ├─ role           │
                    │  └─ teamId         │
                    └────────┬───────────┘
                             │
                             ▼
                    ┌────────────────────┐
                    │   RBACProvider     │
                    │                    │
                    │  Fetch permissions │
                    │  from /api/...     │
                    └────────┬───────────┘
                             │
                  ┌──────────┴────────────┐
                  │                       │
                  ▼                       ▼
          ┌───────────────┐      ┌──────────────────┐
          │ useRBAC()     │      │useCanViewScreen()│
          │ useCanView    │      │useCanEditScreen()│
          │ useCanEdit    │      │withScreenGuard()│
          └───────┬───────┘      └────────┬─────────┘
                  │                       │
                  └───────────┬───────────┘
                              │
                   ┌──────────▼───────────┐
                   │ PERMISSION CHECK     │
                   │                      │
                   │ 1. Custom permission?│
                   │    └─YES: Use it     │
                   │    └─NO: Use default │
                   │                      │
                   │ Result: VIEW|EDIT|null
                   └──────────┬───────────┘
                              │
                   ┌──────────┴──────────┐
                   │                     │
                   ▼                     ▼
             ┌──────────┐          ┌────────────┐
             │ RENDER   │          │ HIDE/DENY  │
             │ BUTTON   │          │ FEATURE    │
             └──────────┘          └────────────┘
```

---

## Permission Resolution Flow

```
USER REQUESTS SCREEN ACCESS
            │
            ▼
┌─────────────────────────────┐
│ Is user authenticated?      │
└────┬────────────────────┬───┘
     │YES                 │NO
     ▼                    ▼
┌──────────────┐    ┌──────────────┐
│ Continue     │    │ Return 401   │
│ Unauthorized │    │ Redirect to  │
└──────┬───────┘    │ /login       │
       │            └──────────────┘
       ▼
┌─────────────────────────────┐
│ Check CUSTOM permission      │
│ in ScreenPermission table     │
└────┬────────────────────┬────┘
     │FOUND               │NOT FOUND
     ▼                    ▼
┌──────────────┐    ┌──────────────────┐
│ Use custom   │    │ Check DEFAULT    │
│ permission   │    │ by role level    │
└──────┬───────┘    └────────┬─────────┘
       │                     │
       └──────────┬──────────┘
                  │
                  ▼
        ┌─────────────────────┐
        │ Has permission?     │
        └─┬────────────────┬──┘
          │YES             │NO
          ▼                ▼
    ┌─────────────┐  ┌──────────────┐
    │ ALLOW       │  │ DENY (403)   │
    │ VIEW/EDIT   │  │ Access error │
    └─────────────┘  └──────────────┘
```

---

## Permission Hierarchy

```
PERMISSION LEVELS
    ┌──────────────────┐
    │     EDIT (2)     │  Can view + modify
    │  Can do anything │  - Create
    │     on screen    │  - Read
    │                  │  - Update
    │                  │  - Delete
    └────────┬─────────┘
             │
             │ Inherits
             │
    ┌────────▼─────────┐
    │     VIEW (1)     │  Can view only
    │  Read-only       │  - List/read
    │  access          │  - Export/view
    │  No modification │
    └────────┬─────────┘
             │
             │ Implies
             │
    ┌────────▼─────────┐
    │  Can Access      │  Screen is visible
    │  Screen          │  and functional
    └──────────────────┘
```

---

## Role-Based Permission Defaults

```
┌─────────────────────────────────────────────────────────────┐
│                        OWNER (Level 3)                      │
├─────────────────────────────────────────────────────────────┤
│  FILES        │ CREDENTIALS   │ TEAM        │ LINKS  │ADMIN │
│  ✓ List       │ ✓ List        │ ✓ Settings  │ ✓ List │✓ Audit│
│  ✓ Upload     │ ✓ Create      │ ✓ Members   │ ✓ Create│✓ Settings
│  ✓ Delete     │ ✓ Edit        │ ✓ Invite    │ ✓ Delete│      │
│  ✓ Share      │ ✓ Delete      │ ✓ Delete    │        │      │
└─────────────────────────────────────────────────────────────┘
 ALL = EDIT

┌─────────────────────────────────────────────────────────────┐
│                      ADMIN (Level 2)                        │
├─────────────────────────────────────────────────────────────┤
│  FILES        │ CREDENTIALS   │ TEAM        │ LINKS  │ADMIN │
│  ✓ List       │ ✓ List        │ ✓ Settings  │ ✓ List │✓ Audit│
│  ✓ Upload     │ ✓ Create      │ ✓ Members   │ ✓ Create│ ✗ Setings
│  ✓ Delete     │ ✓ Edit        │ ✓ Invite    │ ✓ Delete│      │
│  ✓ Share      │ ✓ Delete      │ ✗ Delete    │        │      │
└─────────────────────────────────────────────────────────────┘
 MOST = EDIT, SOME = VIEW

┌─────────────────────────────────────────────────────────────┐
│                     VIEWER (Level 1)                        │
├─────────────────────────────────────────────────────────────┤
│  FILES        │ CREDENTIALS   │ TEAM        │ LINKS  │ADMIN │
│  ✓ List (RO)  │ ✓ List (RO)   │ ✗ Settings  │ ✓ List │✗ Audit│
│  ✓ Upload (ED)│ ✗ Create      │ ✗ Members   │ ✓ Create│✗ Settings
│  ✗ Delete     │ ✗ Edit        │ ✗ Invite    │ ✗ Delete│      │
│  ✓ Share (RO) │ ✗ Delete      │ ✗ Delete    │        │      │
└─────────────────────────────────────────────────────────────┘
 SOME = VIEW, SOME = EDIT, REST = NO ACCESS

RO = Read-only (VIEW)
ED = Edit (EDIT)
✓ = Has access
✗ = No access
```

---

## Component Permission Check Flow

```
React Component
      │
      ▼
┌──────────────────────────────┐
│ useCanEditScreen(            │
│   SCREENS.FILES_DELETE       │
│ )                            │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ RBACContext.canEditScreen()  │
└──────────────┬───────────────┘
               │
    ┌──────────┴──────────┐
    │                     │
    ▼                     ▼
YES (True)             NO (False)
  │                        │
  ▼                        ▼
┌────────────┐        ┌────────────┐
│ RENDER     │        │ RETURN     │
│ <Delete /> │        │ null or    │
│ BUTTON     │        │ <Denied /> │
└────────────┘        └────────────┘
```

---

## API Route Protection Flow

```
API Request
      │
      ▼
┌────────────────────────┐
│ POST /api/files/delete │
└──────────────┬─────────┘
               │
               ▼
┌────────────────────────────┐
│ checkScreenPermission(     │
│   session,                 │
│   teamId,                  │
│   SCREENS.FILES_DELETE,    │
│   'EDIT'                   │
│ )                          │
└──────────────┬─────────────┘
               │
    ┌──────────┴──────────┐
    │                     │
    ▼                     ▼
 ALLOWED              DENIED
   │                    │
   ▼                    ▼
┌──────────────┐  ┌────────────────┐
│ {error: null}│  │ {error: 403}   │
│ auth object  │  │ Forbidden      │
└──────┬───────┘  └────────┬───────┘
       │                   │
       ▼                   ▼
  PROCEED             RETURN
  DELETE              ERROR
  FILE
```

---

## Permission Grant/Revoke Flow

```
GRANT PERMISSION
      │
      ▼
POST /api/permissions/screens
  Body:
    - userId
    - teamId
    - screenName
    - permissionLevel (VIEW|EDIT)
      │
      ▼
┌──────────────────────┐
│ Check caller is      │
│ ADMIN in team        │
└────┬────────────┬────┘
     │YES         │NO
     ▼            ▼
  ┌──────┐   ┌──────────┐
  │ OK   │   │ 403      │
  └───┬──┘   │ Forbidden│
      │      └──────────┘
      ▼
┌──────────────────────┐
│ Insert/Update        │
│ ScreenPermission     │
│ record               │
└────┬────────────┬────┘
     │SUCCESS     │FAIL
     ▼            ▼
  ┌────────┐  ┌──────────┐
  │ 201    │  │ 500      │
  │ Created│  │ Error    │
  └────────┘  └──────────┘

REVOKE PERMISSION
      │
      ▼
DELETE /api/permissions/screens
  Params:
    - userId
    - teamId
    - screenName
      │
      ▼
┌──────────────────────┐
│ Check caller is      │
│ ADMIN in team        │
└────┬────────────┬────┘
     │YES         │NO
     ▼            ▼
  ┌──────┐   ┌──────────┐
  │ OK   │   │ 403      │
  └───┬──┘   │ Forbidden│
      │      └──────────┘
      ▼
┌──────────────────────┐
│ Delete               │
│ ScreenPermission     │
│ record               │
└────┬────────────┬────┘
     │SUCCESS     │FAIL
     ▼            ▼
  ┌────────┐  ┌──────────┐
  │ 200    │  │ 500      │
  │ OK     │  │ Error    │
  └────────┘  └──────────┘
```

---

## Database Permission Lookup

```
USER wants to access SCREEN

          │
          ▼
┌─────────────────────────────────────┐
│ Query ScreenPermission table:        │
│                                     │
│ WHERE                               │
│   teamMemberId = <user_team_id>    │
│   AND screenName = <screen>        │
└────┬────────────────────┬───────────┘
     │FOUND               │NOT FOUND
     ▼                    ▼
┌──────────────┐   ┌────────────────────┐
│ Use custom   │   │ Check role defaults│
│ permission   │   │                    │
│              │   │ Is screenName in   │
│              │   │ DEFAULT_PERMISSIONS
│              │   │ [userRole]?        │
└──────┬───────┘   └────┬───────┬───────┘
       │               │YES     │NO
       │               ▼        ▼
       │           ┌────────┐ ┌──────┐
       │           │ALLOWED │ │DENIED│
       │           └────────┘ └──────┘
       │
       └─────────────────┬──────────────┘
                         │
                         ▼
                   FINAL DECISION
                   VIEW|EDIT|null
```

---

## Integration Points

```
YOUR APPLICATION
      │
      ├─────────────────────────────────┐
      │                                 │
      ▼                                 ▼
  COMPONENTS                      API ROUTES
      │                                 │
      ├─ useCanViewScreen()             ├─ checkScreenPermission()
      ├─ useCanEditScreen()             ├─ checkRole()
      ├─ useRBAC()                      ├─ checkAuth()
      └─ withScreenGuard()              └─ ApiResponse helpers
      
      │                                 │
      └────────────┬────────────────────┘
                   │
                   ▼
          RBACProvider Context
                   │
                   ├─ Loads permissions from API
                   ├─ Caches in memory
                   └─ Provides hooks/functions
                   
                   │
                   ▼
          Database Queries
                   │
                   ├─ lib/permissions.ts functions
                   ├─ Prisma ORM queries
                   └─ PostgreSQL tables

          ScreenPermission
          TeamMember
          Team
          User
```

---

## Permission Caching Strategy

```
┌──────────────────────────────────┐
│ App Initialization               │
│ - User logs in                   │
│ - Session created                │
│ - User has role & teamId         │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ RBACProvider mounts              │
│ (useEffect hook)                 │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ Fetch /api/permissions/screens   │
│ ?teamId=team-123                 │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ Store in Memory                  │
│ screenPermissions Map:           │
│ {                                │
│   FILES_DELETE: 'EDIT',          │
│   CREDENTIALS_LIST: 'VIEW',      │
│   ...                            │
│ }                                │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ Components use cached data       │
│ (Fast - no extra API calls)      │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ User navigates/updates           │
│ Grant permission for user?       │
│ Revoke permission?               │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ Update via API                   │
│ POST/DELETE /api/permissions/... │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ User page refresh or             │
│ Manually refetch from             │
│ /api/permissions/screens         │
└──────────────┬───────────────────┘
               │
               ▼
         NEW PERMISSIONS
         IN CACHE
```

---

## Feature Permission Matrix

```
                    FILES                  CREDENTIALS              TEAM
             List Upload Delete Share    List Create Edit Delete  Set Members Invite Delete  Links
                                                                                           List Create Del
OWNER        ✓    ✓      ✓      ✓        ✓    ✓      ✓    ✓       ✓    ✓       ✓      ✓     ✓    ✓     ✓
             EDIT EDIT   EDIT   EDIT     EDIT  EDIT  EDIT  EDIT    EDIT EDIT    EDIT   EDIT  EDIT EDIT  EDIT

ADMIN        ✓    ✓      ✓      ✓        ✓    ✓      ✓    ✓       ✓    ✓       ✓      ✗     ✓    ✓     ✓
             EDIT EDIT   EDIT   EDIT     EDIT  EDIT  EDIT  EDIT    EDIT EDIT    EDIT          EDIT EDIT  EDIT

VIEWER       ✓    ✓      ✗      ✓        ✓    ✗      ✗    ✗       ✗    ✗       ✗      ✗     ✓    ✓     ✗
             VIEW EDIT                    VIEW                                              VIEW EDIT

✓ = Has access    ✗ = No access
EDIT = Can modify   VIEW = Read-only
```

---

## Decision Tree for Permission Check

```
                    IS USER AUTHENTICATED?
                         │
                    ┌────┴────┐
                    YES       NO
                    │         │
                    ▼         ▼
                 GET ROLE  RETURN 401
                    │
                    ▼
            IS THERE A CUSTOM
         SCREEN PERMISSION SET?
                    │
                ┌───┴───┐
               YES      NO
                │        │
                ▼        ▼
            USE IT    CHECK ROLE
                │      DEFAULTS
                │        │
                └────┬───┘
                     │
                     ▼
            IS SCREEN IN DEFAULT
            PERMISSIONS FOR ROLE?
                     │
                 ┌───┴───┐
                YES      NO
                │         │
                ▼         ▼
            ALLOW     DENY
            (VIEW/   (403
             EDIT)   Error)
```

---

## Multi-Team Permission Scenario

```
User: alice@example.com
├─ Team 1: "Marketing"
│  ├─ Role: ADMIN
│  ├─ Custom Permissions:
│  │  └─ FILES_DELETE: EDIT ✓
│  └─ Default Permissions:
│     └─ CREDENTIALS_LIST: EDIT ✓
│
├─ Team 2: "Finance"
│  ├─ Role: VIEWER
│  ├─ Custom Permissions:
│  │  └─ CREDENTIALS_EDIT: VIEW ✓ (override)
│  └─ Default Permissions:
│     └─ FILES_LIST: VIEW ✓
│
└─ Team 3: "Engineering"
   ├─ Role: OWNER
   ├─ Custom Permissions: (none)
   └─ Default Permissions:
      └─ ALL: EDIT ✓

When alice views files in Team 1: ✓ ADMIN role allows
When alice deletes in Team 1: ✓ Custom permission allows  
When alice edits credentials in Team 2: ✓ Custom override allows
When alice deletes files in Team 2: ✗ VIEWER role denies
```

---

This visualization system shows how permissions flow through your application at every level!

