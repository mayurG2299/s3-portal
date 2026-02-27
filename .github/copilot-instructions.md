Copilot Instructions — S3 Portal
This is a self-hosted S3 file management portal built for offices and teams who want full control over their data without relying on third-party cloud services. Companies bring their own S3-compatible credentials (AWS, Cloudflare R2, MinIO, Backblaze B2) and manage files through a clean web UI.
Stack: Next.js 14 (App Router), TypeScript, Prisma, PostgreSQL, AWS SDK v3, Tailwind CSS, shadcn/ui, Docker

Project Architecture
app/                   # Next.js App Router pages and API routes
  api/                 # All backend API routes
    admin/             # Admin-only endpoints (quota, reconcile, audit)
    files/             # File CRUD, upload, verify, preview-url
    links/             # Shareable link management
  dashboard/           # Client-side UI pages
components/            # Reusable React components
hooks/                 # Custom React hooks
lib/                   # Core business logic
  crypto.ts            # AES-256-GCM encryption, PBKDF2, scrypt passwords
  storage-quota.ts     # Team storage quota management
  s3-sync.ts           # S3 ↔ DB reconciliation
  cron.ts              # Background jobs (invites, reconciliation)
  api-utils.ts         # Auth helpers, permission middleware, response helpers
  permissions.ts       # RBAC permission checks
  audit.ts             # AccessLog writing
  aws.ts               # AWS SDK wrappers (presign, list, metadata)
prisma/
  schema.prisma        # Full data model
  migrations/          # SQL migration files
scripts/
  cron-worker.ts       # Standalone cron process
types/                 # Shared TypeScript types
__tests__/             # Jest test files

Core Principles
1. Security First
This tool handles AWS credentials and private file storage. Every decision must treat security as the top priority.

Never expose AWS credentials to the frontend or API responses. Credentials are decrypted server-side only, used momentarily, and never serialized to JSON responses.
Always encrypt credentials at rest using lib/crypto.ts (AES-256-GCM + PBKDF2). Never store plaintext keys in the database.
Presigned URLs only. File access always goes through short-lived presigned S3 URLs (max 15 minutes), never direct bucket access.
Authentication on every API route. Use getServerSession(authOptions) at the top of every route handler. Return 401 immediately if session is missing.
Authorization after authentication. After confirming identity, always verify the user has permission to access the requested resource using checkScreenPermission or requireScreenPermission from lib/api-utils.ts.
Verify resource ownership. When a user accesses a file, credential, or bucket, confirm it belongs to their team or user — never trust IDs from the request body alone.

2. Permission System
The app uses a screen-based RBAC system. Always use the centralized helpers — never write inline permission logic.
typescript// ✅ Correct — use centralized helper
const auth = await requireScreenPermission(session, teamId, 'FILES_LIST', 'VIEW')

// ❌ Wrong — never do inline role checks in route handlers
if (session.user.role !== 'ADMIN') return ...
Available ScreenName values:
FILES_LIST, FILES_UPLOAD, FILES_DELETE, FILES_SHARE, CREDENTIALS_LIST, CREDENTIALS_CREATE, CREDENTIALS_EDIT, CREDENTIALS_DELETE, TEAM_SETTINGS, TEAM_MEMBERS, TEAM_INVITATIONS, TEAM_DELETE, LINKS_LIST, LINKS_CREATE, LINKS_DELETE, ADMIN_AUDIT_LOG, ADMIN_SETTINGS
3. Audit Everything
Every meaningful user action must be logged to AccessLog. Use logUserAction from lib/audit.ts.
typescriptawait logUserAction({
  request,
  action: 'FILE_PREVIEW',       // descriptive past-tense action string
  success: true,
  userId: session.user.id,
  teamId: file.teamId,
  resourceType: 'file',
  resourceId: file.id,
  metadata: { key: file.key },  // any extra context
})
Always log on both success AND failure paths. On failure, include errorMessage.
4. Storage Quota
All file writes must respect team storage quotas. The flow is:
checkQuotaBeforeUpload → [allow/deny] → upload → incrementUsage
delete → decrementUsage
Use helpers from lib/storage-quota.ts. Never skip the quota check before an upload or multipart init.
5. API Response Consistency
Always use ApiResponse helpers from lib/api-utils.ts for consistent HTTP responses:
typescriptimport { ApiResponse } from '@/lib/api-utils'

return ApiResponse.success({ file })           // 200
return ApiResponse.notFound()                  // 404
return ApiResponse.forbidden()                 // 403
return ApiResponse.unauthorized()              // 401
return ApiResponse.validationError('...')      // 400
return ApiResponse.error('...', 500)           // 500

Code Style & Conventions
TypeScript

Strict mode is on. No any unless absolutely unavoidable and documented with a comment explaining why.
Always define return types on exported functions.
Use interface for object shapes, type for unions and aliases.
Prefer unknown over any for error handling: catch (err: unknown).

File & Naming Conventions

API routes: app/api/[resource]/route.ts — one file per resource grouping
Components: PascalCase — FilePreviewModal.tsx
Lib utilities: camelCase — storage-quota.ts, api-utils.ts
All new server-side logic goes in lib/, not inside route handlers
Route handlers should be thin: validate → call lib function → return response

React Components

All client components must have 'use client' at the top
Keep components focused — split large components when they exceed ~200 lines
Use useCallback for handlers passed as props or used in useEffect deps
Always handle loading, error, and empty states in UI
Use toast from @/hooks/use-toast for user-facing feedback

Prisma / Database

Never use raw SQL unless Prisma ORM cannot express it (e.g., GREATEST)
Always include relevant indexes when adding new models — check existing schema for patterns
Use BigInt for byte sizes, never number (files can exceed 2GB)
Use cascade deletes appropriately — if a parent is deleted, children should clean up
Run npx prisma generate after any schema change
Create a migration file for every schema change: npx prisma migrate dev --name description

Error Handling
typescript// ✅ Always catch and handle S3 errors explicitly
try {
  const meta = await getS3ObjectMetadata(config, key)
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : 'Unknown S3 error'
  // Check for NoSuchKey — file deleted from S3 but still in DB
  if (message.includes('NoSuchKey') || message.includes('NotFound')) {
    return ApiResponse.error('File no longer exists in S3', 404)
  }
  return ApiResponse.error('Failed to access S3', 500)
}

Open Source Standards
Since this is a public open source project, every contribution must meet these standards:
Security

Never commit secrets. .env is gitignored. All sensitive values go in .env.example with placeholder values and comments explaining what each variable is for.
No hardcoded credentials, tokens, bucket names, or account IDs anywhere in code or tests.
If you add a new required env variable, add it to .env.example with a description comment.
Dependency updates should be reviewed — avoid adding heavy or poorly-maintained packages.

Documentation

Every new lib/ file must have a JSDoc comment at the top explaining what it does and why.
Every exported function must have a JSDoc comment explaining parameters and return value.
Non-obvious logic must have an inline comment explaining the reasoning, not just what it does.
If you add a new API endpoint, document it in the relevant area with method, path, auth requirement, and example request/response.

Testing

Every new utility function in lib/ should have a corresponding test in __tests__/.
Test files mirror the source structure: lib/crypto.ts → __tests__/lib/crypto.test.ts
Tests must not make real S3 or database calls — mock them.
Run npm test before considering any feature complete.
Aim for coverage on the critical path: encryption, permission checks, quota logic.

Git Hygiene

Branch names: feature/description, fix/description, chore/description
Commit messages follow Conventional Commits:

feat: add file preview modal
fix: prevent negative storage quota values
chore: add StorageQuota migration
security: encrypt CloudFront private key at rest


One logical change per commit — don't bundle unrelated changes
Never commit directly to master/main — use PRs

Docker & Deployment

The app must always be deployable with docker-compose up from a fresh clone with only .env configured.
Never add steps to the setup process that aren't reflected in setup.sh or documented in README.
If a new service dependency is added (e.g., Redis), it must be added to docker-compose.yml and docker-compose.production.yml.


Common Patterns to Follow
New API Route Template
typescriptimport { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireScreenPermission, ApiResponse } from '@/lib/api-utils'
import { logUserAction } from '@/lib/audit'

export async function GET(request: NextRequest) {
  // 1. Authenticate
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return ApiResponse.unauthorized()

  // 2. Authorize
  const auth = await requireScreenPermission(session, session.user.teamId!, 'SCREEN_NAME', 'VIEW')

  // 3. Validate input
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return ApiResponse.validationError('id is required')

  // 4. Business logic (call lib/ functions, not inline)
  try {
    const result = await someLibFunction(id, auth.userId)
    if (!result) return ApiResponse.notFound()

    // 5. Audit log
    await logUserAction({ request, action: 'RESOURCE_READ', success: true, userId: auth.userId, resourceType: 'resource', resourceId: id })

    // 6. Return
    return ApiResponse.success({ result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    await logUserAction({ request, action: 'RESOURCE_READ', success: false, userId: auth.userId, resourceType: 'resource', resourceId: id, errorMessage: message })
    return ApiResponse.error(message)
  }
}
New Prisma Model Checklist
When adding a new model:

 Add to prisma/schema.prisma
 Add appropriate @@index directives for all foreign keys and common query fields
 Add cascade delete behavior on foreign keys where appropriate
 Create migration: npx prisma migrate dev --name add_model_name
 Run npx prisma generate
 Add the relation to the parent model as well

S3 Operations
Always use the wrapper functions in lib/aws.ts — never instantiate S3Client directly in route handlers or components. If a new S3 operation is needed, add it to lib/aws.ts first.

What NOT To Do

❌ Don't use localStorage or sessionStorage for anything security-related
❌ Don't return AWS credentials, decrypted keys, or password hashes in API responses
❌ Don't skip the quota check before any file write operation
❌ Don't write permission checks inline in route handlers — use lib/api-utils.ts
❌ Don't add *.md to .gitignore — documentation files must be tracked
❌ Don't use console.log for production logging — use console.error only for actual errors
❌ Don't hardcode expiry times — presigned URLs max 15 minutes, use named constants
❌ Don't use any without a comment explaining why it's unavoidable
❌ Don't make direct DB calls from React components — always go through API routes
❌ Don't commit .env files or any file containing real secrets


Environment Variables Reference
All required variables must be present in .env.example. Key ones:
VariableDescriptionDATABASE_URLPostgreSQL connection stringENCRYPTION_KEYMaster key for AES-256-GCM, min 32 bytes (generate with openssl rand -hex 32)NEXTAUTH_SECRETNextAuth session signing secretNEXTAUTH_URLFull URL of the app (e.g. http://localhost:3000)

Running Locally
bash# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your values

# Set up database
npx prisma migrate dev
npx prisma generate

# Start dev server
npm run dev

# Start cron worker (separate terminal)
npx ts-node scripts/cron-worker.ts

# Run tests
npm test

# Run with Docker
docker-compose up