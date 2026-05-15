# S3 Portal - Code Structure & Architecture Documentation

## Overview

S3 Portal is a production-grade, self-hosted file management system for teams built with Next.js 14. It implements a zero-trust security model where users bring their own AWS credentials, and all file access is mediated through encrypted, scoped tokens.

**Tech Stack:**
- Frontend: Next.js 14 (App Router), React 18, TypeScript
- Backend: Next.js API Routes (serverless)
- Database: PostgreSQL with Prisma ORM
- Authentication: NextAuth.js v4
- Storage: AWS S3 (user-managed)
- UI Framework: Tailwind CSS + Radix UI
- Security: AES-256-GCM encryption, randomized share link hashes

---

## Directory Structure & Architecture

### `/app` - Next.js App Router (Frontend + API Routes)

The main application code following Next.js 14 App Router conventions.

#### **`/app/layout.tsx`**
- Root layout wrapper for the entire application
- Sets up global metadata, fonts (Inter), and UI providers (Toaster)
- Imports global styles from `globals.css`

#### **`/app/page.tsx`**
- Landing page (root `/` route)
- Typically redirects authenticated users to dashboard

#### **`/app/globals.css`**
- Global styles and Tailwind CSS directives
- Base styling for the entire application

#### **Authentication Routes** (`/app/login`, `/app/register`)
- `login/page.tsx` - Login page with email/password form
- `register/page.tsx` - User registration form
- Handled by NextAuth.js with credentials provider

#### **`/app/dashboard` - Protected Application Routes**

Main authenticated user interface. All routes require authentication via middleware.

**Layout structure:**
```
dashboard/
├── layout.tsx          # Dashboard layout wrapper
├── page.tsx           # Dashboard homepage/overview
├── admin/             # Admin-only screens (requires level 50+)
├── credentials/       # AWS credential management (admin-only)
├── debug/             # Debug utilities page
├── files/             # File browser & management
├── links/             # Share links management
├── settings/          # User & team settings
└── teams/             # Team management (admin-only)
```

**Key Dashboard Pages:**

- **`files/page.tsx`** (Level 10+)
  - Main file browser interface
  - Drag-drop file upload capability
  - Direct S3 uploads via presigned URLs
  - File listing and organization

- **`credentials/page.tsx`** (Level 50+)
  - Manage AWS S3 credentials
  - Add/edit/delete credential sets
  - View which credentials are in use

- **`links/page.tsx`** (Level 10+)
  - Create and manage shareable links
  - Set expiry dates, passwords, download limits
  - View sharing statistics

- **`teams/page.tsx`** (Level 50+)
  - Team management interface
  - Add/remove team members
  - Assign roles and permissions

- **`admin/permissions/page.tsx`** (Level 50+)
  - Screen-level permission management
  - Role-based access control configuration
  - Permission matrix for screens

- **`settings/page.tsx`** (Level 10+)
  - User profile settings
  - Team settings management

- **`debug/page.tsx`**
  - Development debugging tools
  - Session info, role info, etc.

#### **`/app/api` - REST API Routes**

Serverless backend API endpoints following RESTful conventions.

**Authentication & Authorization:**
```
/api/auth/
├── [...nextauth]/route.ts         # NextAuth.js configuration & handlers
├── register/route.ts              # User registration endpoint
└── credentials/route.ts           # AWS credential encryption/storage
```

**File Management:**
```
/api/files/route.ts                # File listing, upload initiation
```

**Sharing:**
```
/api/links/route.ts                # Create/manage shareable links
/api/share/[hash]/route.ts         # Public file access via hash
```

**Permissions & Roles:**
```
/api/permissions/
└── screens/route.ts               # Screen permission management
/api/roles/
├── route.ts                        # List/create roles
├── [id]/route.ts                   # Update/delete specific role
└── permissions/route.ts            # Role-permission mapping
```

**Team Management:**
```
/api/team/
└── members/
    ├── route.ts                    # Add/list/remove team members
    └── role/route.ts               # Update member roles
```

---

### `/components` - React Components

Reusable React components organized by feature/domain.

#### **UI Components** (`/components/ui/`)
Base-level, generic components used throughout the app:
- `button.tsx` - Styled button component
- `card.tsx` - Card container component
- `checkbox.tsx` - Checkbox input component
- `dialog.tsx` - Modal dialog component
- `input.tsx` - Text input component
- `label.tsx` - Form label component
- `select.tsx` - Dropdown select component
- `progress.tsx` - Progress bar component
- `toast.tsx` - Toast notification component
- `toaster.tsx` - Toast notification container

**Design Pattern:** These use Radix UI primitives with Tailwind styling for consistent, accessible UI.

#### **Feature Components** (`/components/`)

- **`file-upload.tsx`**
  - File upload component with drag-drop
  - Handles presigned URL integration
  - Upload progress tracking

- **`rbac-provider.tsx`**
  - React context provider for RBAC state
  - Manages user roles, permissions, and access levels
  - Wraps dashboard with permission context

- **`screen-permissions-example.tsx`**
  - Example component demonstrating screen-level permissions
  - Used for reference and testing

#### **Admin Components** (`/components/admin/`)

Dashboard admin tools:

- **`permission-management.tsx`**
  - UI for managing screen-level permissions
  - Configure which roles can see which screens
  - Permission matrix visualization

- **`role-management.tsx`**
  - CRUD interface for custom roles
  - Create, update, delete roles
  - Configure role hierarchy (level-based)

- **`user-role-management.tsx`**
  - Assign roles to team members
  - Update member permissions
  - View member role assignments

- **`screen-permission-matrix.tsx`**
  - Visual matrix showing roles vs. screens
  - Toggle permissions at intersection
  - Preview permission changes

- **`invite-user-form.tsx`**
  - Form to invite new users to team
  - Email-based invitations

#### **Dashboard Components** (`/components/dashboard/`)

- **`sign-out-button.tsx`**
  - Sign-out button for authenticated users
  - Clears session and redirects to login

- **`sidebar.tsx`**
  - Collapsible, accessible sidebar with keyboard-focus styles
  - Controlled component: receives `isOpen`, `onToggle`, `onClose`
  - Highlights active route, closes automatically on mobile navigation

- **`dashboard-chrome.tsx`**
  - Client wrapper that manages sidebar state and responsive behavior
  - Expands on `md+`, collapses on mobile by default
  - Shifts main content margin based on sidebar width

---

### `/lib` - Utility Libraries & Business Logic

Core business logic, utilities, and database access patterns.

#### **Database & ORM**

- **`db.ts`**
  - Prisma client instantiation
  - Single source of database access
  - Handles connection pooling and lifecycle

#### **Authentication**

- **`auth.ts`**
  - NextAuth.js configuration
  - Credentials provider setup
  - Session strategy configuration
  - User serialization/callback logic

#### **AWS Integration**

- **`aws.ts`**
  - AWS SDK v3 client initialization (S3, CloudFront, STS)
  - Presigned URL generation
  - CloudFront signed URLs
  - Credential management helpers

- **`crypto.ts`**
  - AES-256 encryption/decryption functions
  - Used for storing AWS credentials securely
  - Password hashing and verification utilities

#### **Core Business Logic**

- **`permissions.ts`** (466 lines)
  - Role-level checking functions:
    - `hasRoleLevel()` - Check if user meets minimum role level
    - `hasRoleName()` - Check specific role name
    - `isOwner()` - Check if user is owner (level 100)
    - `isAdmin()` - Check if user is admin (level 50+)
    - `isViewer()` - Check if user has access (level 10+)
  - Database queries for user permissions
  - Team-based access control

- **`screen-permissions.ts`**
  - Screen-level permission constants
  - Default permission configuration
  - Permission checking for UI screens
  - Dynamic permission level management

#### **Utilities**

- **`utils.ts`**
  - General utility functions
  - String helpers, type guards, etc.

- **`api-utils.ts`**
  - API response formatting
  - Error handling and responses
  - Validation utilities

---

### `/types` - TypeScript Type Definitions

- **`next-auth.d.ts`**
  - Extends NextAuth.js types
  - Defines custom session structure
  - Adds role and permission types to session

---

### `/prisma` - Database Schema & Migrations

#### **`schema.prisma`** (223 lines)

Core data model for the application:

**Key Models:**

1. **`User`** - Application users
   - Email, password (hashed)
   - Authentication credentials
   - Relations to teams, roles, credentials

2. **`Team`** - Team/organization entity
   - Team name and metadata
   - Members with roles
   - Shared credentials and files

3. **`TeamMember`** - User team membership
   - Links users to teams
   - Associates roles with users per team
   - Enables team-based permissions

4. **`Role`** - Permission roles
   - Built-in: OWNER (100), ADMIN (50), VIEWER (10)
   - Custom roles supported
   - Level-based hierarchy for easy comparison
   - Screen-level permissions

5. **`AWSCredential`** - Encrypted AWS credentials
   - User brings their own AWS credentials
  - Stored encrypted (AES-256-GCM)
   - Associated with team or user
   - Links to CloudFront for CDN delivery

6. **`File`** - File metadata
   - Maps S3 objects to database records
   - Tracks file ownership and team
   - Stores metadata (size, type, etag)
   - Parent path for folder organization

7. **`Link`** - Shareable file links
   - Public or password-protected
   - Expiry dates and download limits
  - Randomized hash-based access
   - Access logging

8. **`AccessLog`** - Audit trail
   - Logs all file/link access attempts
   - IP addresses, user agents
   - Success/failure tracking
   - Compliance and debugging

9. **`ScreenPermission`** - Screen-level RBAC
   - Per-screen role permissions
   - Dynamic screen access control
   - Default permissions for new roles

#### **`seed.ts`**
- Database seeding script
- Creates default users, teams, roles
- Populates test data for development

#### **`migrations/`**
- Database migration history
- `20240113000000_init/` - Initial schema
- `20260115000000_add_screen_permissions/` - Add screen RBAC
- `20260115162949_custom_roles/` - Custom role support
- `20260115163536_custom_roles/` - Custom role fixes

---

### `/hooks` - React Hooks

- **`use-toast.ts`**
  - Custom hook for triggering toast notifications
  - Provides `toast()` function to components
  - Integrates with Toaster component

---

### `/docs` - Documentation

Comprehensive documentation:
- `PROJECT-OVERVIEW.md` - High-level project goals
- `PROJECT-SUMMARY.md` - Executive summary
- `QUICKSTART.md` - Getting started guide
- `SETUP.md` & `DEPLOYMENT.md` - Setup and deployment
- `RBAC-GUIDE.md` - Role-based access control documentation
- `RBAC-IMPLEMENTATION.md` - RBAC technical details
- `SCREEN-PERMISSIONS-GUIDE.md` - Screen-level permissions
- `SCREEN-PERMISSIONS-IMPLEMENTATION.md` - Technical implementation
- `CUSTOM-ROLES-COMPLETE.md` - Custom role feature documentation

---

### `/scripts` - Utility Scripts

- **`make-admin.ts`** - Promote a user to admin role
- **`list-users.ts`** - List all users in system
- **`fix-users-without-teams.ts`** - Migration script for user-team associations

---

### Configuration Files

- **`package.json`** - Dependencies and npm scripts
- **`tsconfig.json`** - TypeScript configuration
- **`next.config.js`** - Next.js configuration
- **`tailwind.config.ts`** - Tailwind CSS configuration
- **`postcss.config.js`** - PostCSS configuration
- **`middleware.ts`** - Next.js middleware for route protection

#### **`middleware.ts`** - Route Protection
Implements authentication and authorization middleware:
- Protects `/dashboard` routes requiring authentication
- Enforces role-based access control
- Routes mapped to required permission levels:
  - `/dashboard/admin/**` → Level 50+ (ADMIN)
  - `/dashboard/credentials/**` → Level 50+ (ADMIN)
  - `/dashboard/files/**` → Level 10+ (VIEWER)
  - `/dashboard/teams/**` → Level 50+ (ADMIN)
- Redirects unauthenticated users to login

- **`.env.local`** - Environment variables (not in repo)
  - `NEXTAUTH_SECRET` - Session signing key
  - `DATABASE_URL` - PostgreSQL connection string
  - `ENCRYPTION_KEY` - Master key for credential encryption
  - `NEXT_PUBLIC_APP_URL` - Public app URL for share links

- **`docker-compose.yml`** - Docker composition for local development
- **`Dockerfile`** - Container image definition
- **`setup.sh` & `setup-db.sh`** - Setup scripts

---

## Authentication & Authorization Flow

### Authentication (NextAuth.js)

1. **Credentials Provider**
  - Email + password login
  - Passwords hashed with scrypt
  - JWT sessions via NextAuth

2. **Session Management**
  - JWT tokens in secure HTTP-only cookies
  - Session extended from NextAuth.js with custom data
  - User role information included in session

### Authorization (RBAC)

1. **Role Hierarchy (Level-based)**
   ```
   OWNER (level 100)
   ├── Full access to all features
   
   ADMIN (level 50)
   ├── Can manage credentials, teams, roles
   ├── Can manage permissions
   
   VIEWER (level 10)
   ├── Can access files and links
   ├── Can upload files
   └── Cannot manage settings/admin features
   ```

2. **Permission Checking**
   - Middleware checks role level for protected routes
   - Components use permission helpers from `lib/permissions.ts`
   - Screen-level permissions for granular control
   - Database queries verify permission at access time

3. **Team-Based Access**
   - Users have roles per team (via TeamMember)
   - File/credential access scoped to team
   - Different permission levels in different teams

---

## Data Flow & Security Architecture

### File Upload Flow

1. User initiates upload in file browser component
2. Frontend requests presigned URL from `/api/files`
3. Backend generates AWS presigned URL (scoped, time-limited)
4. Frontend receives URL, uploads directly to S3
5. Upload callback notifies backend to record file metadata
6. File entry created in database with S3 metadata

**Why this design?**
- Server never handles file bytes (zero server storage)
- Credentials never leave server (only used server-side)
- Direct S3 upload ensures faster transfers
- Presigned URLs prevent direct credential exposure

### File Sharing Flow

1. User creates share link in UI with settings (expiry, password, limit)
2. Backend generates cryptographic hash (nano-id)
3. Link stored in database with expiry/limits and optional password hash
4. Public URL `/share/[hash]` shared with recipient
5. Recipient accesses via hash
6. Backend checks expiry/limit/password
7. If valid, generates temporary presigned download URL
8. Recipient downloads directly from S3

**Why this design?**
- Links are random and hard to guess
- Settings verified server-side
- Limits enforced at access time
- CloudFront support is optional when configured

### Credential Security

1. User provides AWS access key + secret key
2. Backend encrypts with AES-256-GCM using a derived master key
3. Encrypted blob stored in database
4. Master key kept in environment (never in code)
5. When credentials needed, decrypted on-demand
6. Decrypted credentials used only for S3 SDK calls

**Why this design?**
- Credentials never stored in plaintext
- Even database breach doesn't expose AWS credentials
- Each credential set is independently encrypted
- Credentials specific to S3 bucket (zero AWS account access)

---

## API Endpoints Summary

### Authentication
- `POST /api/auth/signin` - Login (NextAuth)
- `POST /api/auth/signout` - Logout (NextAuth)
- `POST /api/auth/register` - Register new user
- `POST /api/auth/credentials` - Validate credentials

### Files
- `GET /api/files` - List files in bucket (with filters)
- `POST /api/files` - Initiate upload, get presigned URL
- `DELETE /api/files` - Delete file from S3

### Sharing
- `GET /api/links` - List user's share links
- `POST /api/links` - Create new share link
- `PUT /api/links/[id]` - Update link settings
- `DELETE /api/links/[id]` - Delete link
- `GET /api/share/[hash]` - Public access to shared file

### Credentials
- `GET /api/auth/credentials` - List AWS credentials
- `POST /api/auth/credentials` - Add new credentials
- `PUT /api/auth/credentials/[id]` - Update credentials
- `DELETE /api/auth/credentials/[id]` - Delete credentials

### Permissions
- `GET /api/permissions/screens` - Get screen permissions
- `POST /api/permissions/screens` - Update screen permissions

### Roles
- `GET /api/roles` - List all roles
- `POST /api/roles` - Create custom role
- `PUT /api/roles/[id]` - Update role
- `DELETE /api/roles/[id]` - Delete role
- `GET /api/roles/permissions` - Get role-permission mapping

### Team
- `GET /api/team/members` - List team members
- `POST /api/team/members` - Add team member
- `DELETE /api/team/members/[id]` - Remove team member
- `PUT /api/team/members/role` - Update member role

---

## Design Principles

### 1. **Zero-Trust Security**
- Never trust client-side security claims
- Always verify permissions server-side
- Encrypt sensitive data (credentials)
- Assume credentials might be compromised

### 2. **No Vendor Lock-in**
- Users bring own AWS credentials
- No proprietary authentication
- Can export data anytime
- Portable to self-hosted environments

### 3. **Type Safety**
- Full TypeScript codebase
- Prisma for type-safe database
- API request/response validation with Zod
- Compile-time checking

### 4. **Performance**
- Direct S3 uploads (no server bottleneck)
- CloudFront for CDN delivery
- Database indexing on frequently queried fields
- Presigned URLs with time limits

### 5. **Scalability**
- Stateless API design (serverless-ready)
- Database-backed session state
- Horizontal scaling of Next.js instances
- Delegated storage to S3 (unlimited)

### 6. **User Experience**
- Drag-drop file uploads
- Real-time progress tracking
- Shareable links with simple UI
- Clean dashboard interface

---

## Development Environment Setup

### Prerequisites
- Node.js 18+
- PostgreSQL (or SQLite for development)
- AWS account with S3 bucket

### Local Setup
```bash
# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local

# Create/migrate database
npm run db:generate
npm run db:push

# Seed database with test data
npm run db:seed

# Start development server
npm run dev
```

### Scripts Available
- `npm run dev` - Start development server (http://localhost:3000)
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Sync schema to database
- `npm run db:migrate` - Create new migration
- `npm run db:seed` - Seed database
- `npm run db:studio` - Open Prisma Studio GUI

---

## Security Considerations

### Implemented
✅ CSRF protection (NextAuth handles)
✅ XSS prevention (React escaping)
✅ SQL injection prevention (Prisma ORM)
✅ Secure password hashing (scrypt)
✅ Encrypted credential storage (AES-256-GCM)
✅ Randomized share link hashes (optional password protection)
✅ Rate limiting ready (can add)
✅ Audit logging (AccessLog model)
✅ Session-based authentication
✅ Middleware-based route protection

### Considerations
- Configure NEXTAUTH_SECRET securely (random string)
- Use HTTPS in production
- Regular security updates for dependencies
- Monitor AccessLog for suspicious activity
- Rotate encryption keys periodically (manual process)
- Regular backups of PostgreSQL database
- AWS IAM credentials should be scoped to single S3 bucket

---

## Future Enhancement Areas

1. **Two-Factor Authentication**
   - TOTP support via authenticator apps
   - Backup codes for recovery

2. **Advanced Sharing**
   - Folder-level sharing
   - Conditional access (IP whitelisting, time-based)
   - Share expiry auto-cleanup

3. **Audit & Compliance**
   - More detailed logging
   - Compliance report generation
   - Data retention policies

4. **Collaboration**
   - Real-time presence
   - Comments on files
   - File versioning

5. **Performance**
   - Caching layer (Redis)
   - Batch operations
   - Large file streaming

6. **Integrations**
   - Slack notifications
   - Webhook support
   - Third-party storage backends
