# S3 Portal - Complete Project Overview

**Last Updated:** January 14, 2026  
**Status:** Development Ready ✅  
**Server:** http://localhost:3000  
**Database:** PostgreSQL on port 5433 (Docker)

---

## 🎯 Project Vision

A production-grade, self-hosted S3 file portal for teams - think "GitHub for S3". Zero-trust security model where users bring their own AWS credentials, the app encrypts them, and all access is mediated through encrypted, scoped, expiring tokens. No vendor lock-in, no proprietary backend, no SaaS dependency.

---

## 📚 Tech Stack

### Frontend
- **Next.js 14.1.0** - React framework with App Router
- **TypeScript** - Type safety throughout
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Headless accessible UI components
- **React Dropzone** - File upload with drag-and-drop
- **Lucide React** - Icon library

### Backend
- **Next.js API Routes** - Server-side API endpoints
- **Next.js Server Actions** - Server-side functions (experimental)
- **Prisma ORM** - Database toolkit
- **PostgreSQL** - Primary database (Docker container)
- **next-auth v4.24.6** - Authentication (stable version)

### Security & Encryption
- **Node.js Crypto Module** - AES-256-GCM encryption
- **PBKDF2** - Key derivation (100,000 iterations)
- **scrypt** - Password hashing
- **Share hashes** - Randomized link hash generation
- **JWT** - Session tokens (via next-auth v4.24.6)

### AWS Integration
- **AWS SDK v3** - Modular AWS SDK
  - `@aws-sdk/client-s3` - S3 operations
  - `@aws-sdk/client-cloudfront` - CDN integration
  - `@aws-sdk/client-sts` - Temporary credentials
  - `@aws-sdk/s3-request-presigner` - Presigned URLs

### Development
- **Zod** - Runtime type validation
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration

---

## 🏗️ Architecture Decisions

### 1. **Zero-Trust Security Model**
**Decision:** Never store raw AWS credentials
- All AWS credentials encrypted at rest with AES-256-GCM
- User passwords hashed with scrypt (no plaintext stored)
- Credentials decrypted only in memory, only when needed
- Key derivation uses PBKDF2 (100k iterations) with per-credential salt

**Why:** Prevents credential theft even if database is compromised

### 2. **Direct S3 Uploads (No Proxy)**
**Decision:** Use presigned URLs for direct browser-to-S3 uploads
- Generate presigned POST URLs with 15-minute expiry
- Files never touch the application server
- Reduces bandwidth costs and server load

**Why:** Scalability and cost efficiency

### 3. **Next.js App Router vs Pages Router**
**Decision:** Use App Router (Next.js 14)
- Server Components by default (better performance)
- Built-in loading/error states
- Simplified data fetching with async/await
- Better file-system based routing

**Why:** Modern Next.js best practices, better DX

### 4. **PostgreSQL on Port 5433**
**Decision:** Run PostgreSQL Docker container on non-standard port
- Standard port 5432 often occupied by system PostgreSQL
- Avoids conflicts with existing databases
- Easy to stop/start without affecting other services

**Why:** Developer convenience and isolation

### 5. **next-auth v4 vs v5**
**Decision:** Use stable v4.24.6 instead of v5 beta
- v5 beta has compatibility issues with Next.js 14.1
- v4 is production-tested and stable
- Credentials provider works reliably

**Why:** Stability over cutting-edge features

### 6. **JWT Sessions vs Database Sessions**
**Decision:** Use JWT-based sessions
- No database queries on every request
- Stateless authentication
- Scales horizontally without session store

**Why:** Performance and scalability

### 7. **Prisma vs Raw SQL**
**Decision:** Use Prisma ORM
- Type-safe database queries
- Automatic migrations
- Better developer experience
- Supports multiple databases (PostgreSQL/SQLite)

**Why:** Type safety and productivity

### 8. **Dashboard UI Shell (Sidebar + Chrome)**
**Decision:** Use a controlled, client-side shell for navigation
- `DashboardChrome` wraps all dashboard pages and manages the sidebar open/closed state
- `Sidebar` is a controlled component with explicit `isOpen`, `onToggle`, `onClose` props
- Mobile shows an overlay and auto-closes on navigation; desktop shifts content with `md:ml-64`/`md:ml-20`
- Accessibility: focus-ring styles, `aria-current` for active items, labeled toggle

**Why:** Keeps server layouts lean while providing a responsive, accessible navigation experience

---

## 📁 File Structure Explained

```
s3-portal/
│
├── app/                          # Next.js App Router (main application)
│   ├── api/                      # API Route Handlers
│   │   ├── auth/
│   │   │   ├── [...nextauth]/   # NextAuth dynamic catch-all route
│   │   │   │   └── route.ts     # GET/POST handlers for auth
│   │   │   └── register/
│   │   │       └── route.ts     # User registration endpoint
│   │   ├── credentials/
│   │   │   └── route.ts         # AWS credentials CRUD (GET/POST/DELETE)
│   │   ├── files/
│   │   │   └── route.ts         # File operations (list/upload/delete)
│   │   ├── links/
│   │   │   └── route.ts         # Shareable links CRUD
│   │   └── share/
│   │       └── [hash]/
│   │           └── route.ts     # Public share access (no auth required)
│   │
│   ├── dashboard/                # Protected dashboard area
│   │   ├── layout.tsx           # Loads client chrome wrapper
│   │   ├── page.tsx             # Dashboard home (stats overview)
│   │   ├── credentials/
│   │   │   └── page.tsx         # Manage AWS credentials
│   │   ├── files/
│   │   │   └── page.tsx         # File browser & upload
│   │   ├── links/
│   │   │   └── page.tsx         # Manage shared links
│   │   ├── teams/
│   │   │   └── page.tsx         # Team management (TODO)
│   │   └── settings/
│   │       └── page.tsx         # User settings
│   │
│   ├── login/
│   │   └── page.tsx             # Login form
│   ├── register/
│   │   └── page.tsx             # Registration form
│   ├── share/
│   │   └── [hash]/
│   │       └── page.tsx         # Public file share page
│   │
│   ├── layout.tsx               # Root layout (HTML, fonts, providers)
│   ├── page.tsx                 # Home page (redirects to dashboard if logged in)
│   └── globals.css              # Global styles + Tailwind directives
│
├── components/                   # React Components
│   ├── ui/                      # Reusable UI components (Radix-based)
│   │   ├── button.tsx           # Button with variants
│   │   ├── input.tsx            # Form input
│   │   ├── label.tsx            # Form label
│   │   ├── card.tsx             # Card container
│   │   ├── dialog.tsx           # Modal dialog
│   │   ├── toast.tsx            # Toast notifications
│   │   ├── toaster.tsx          # Toast provider
│   │   ├── progress.tsx         # Progress bar
│   │   └── select.tsx           # Dropdown select
│   ├── file-upload.tsx          # Drag-drop file uploader with progress
│   └── dashboard/               # Dashboard shell components
│       ├── sidebar.tsx          # Collapsible, accessible sidebar
│       └── dashboard-chrome.tsx # Client wrapper controlling sidebar
│
├── lib/                          # Core library functions
│   ├── auth.ts                  # NextAuth configuration
│   ├── crypto.ts                # Encryption/decryption utilities
│   ├── aws.ts                   # AWS SDK wrapper functions
│   ├── db.ts                    # Prisma client singleton
│   └── utils.ts                 # Utility functions (cn helper)
│
├── hooks/                        # React Hooks
│   └── use-toast.ts             # Toast notification hook
│
├── prisma/                       # Database
│   └── schema.prisma            # Database schema definition
│
├── types/                        # TypeScript type definitions
│   └── next-auth.d.ts           # NextAuth type extensions
│
├── scripts/                      # Automation scripts
│   ├── setup.sh                 # Main project setup
│   ├── check-system.sh          # System requirements check
│   └── setup-db.sh              # PostgreSQL Docker setup
│
├── .env                          # Environment variables (generated)
├── .env.example                 # Environment template
├── .dockerignore                # Docker ignore patterns
├── .gitignore                   # Git ignore patterns
├── Dockerfile                   # Production Docker image
├── docker-compose.yml           # Multi-container setup
├── middleware.ts                # Auth middleware (route protection)
├── next.config.js               # Next.js configuration
├── package.json                 # Dependencies
├── postcss.config.js            # PostCSS (for Tailwind)
├── tailwind.config.ts           # Tailwind configuration
├── tsconfig.json                # TypeScript configuration
│
└── Documentation
    ├── README.md                # Quick start guide
    ├── DEPLOYMENT.md            # Production deployment guide
    ├── QUICKSTART.md            # 5-minute getting started
    ├── PROJECT-SUMMARY.md       # High-level overview
    └── PROJECT-OVERVIEW.md      # This file (complete reference)
```

---

## 🗄️ Database Schema

### User
Stores user accounts
```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String   // scrypt hash
  name         String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

### Team
Team/organization support (future)
```prisma
model Team {
  id        String   @id @default(cuid())
  name      String
  ownerId   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### TeamMember
Team membership with roles
```prisma
model TeamMember {
  id        String   @id @default(cuid())
  userId    String
  teamId    String
  roleId    String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### AWSCredential
Encrypted AWS credentials (CRITICAL SECURITY)
```prisma
model AWSCredential {
  id               String   @id @default(cuid())
  userId           String
  teamId           String?
  name             String   // User-friendly name
  encryptedAccessKey String // base64 blob (salt+iv+tag+ciphertext)
  encryptedSecretKey String // base64 blob (salt+iv+tag+ciphertext)
  region           String   // AWS region
  bucket           String   // S3 bucket name
  cloudfrontDomain String?  // Optional CDN
  cloudfrontKeyPairId String?
  encryptedCloudfrontPrivateKey String? // base64 blob (salt+iv+tag+ciphertext)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

**Security Notes:**
- AWS access key and secret key are encrypted separately
- Encrypted using AES-256-GCM with a server master key derived from `ENCRYPTION_KEY`
- Each credential has a unique salt and IV
- Auth tag ensures data integrity (detects tampering)

### File
File metadata (not the actual file)
```prisma
model File {
  id           String   @id @default(cuid())
  key          String   // S3 object key (path)
  name         String
  size         BigInt
  contentType  String?
  etag         String?
  parentPath   String   @default("/")
  userId       String
  teamId       String?
  credentialId String
  metadata     Json?
  tags         String[]
  description  String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

### Link
Shareable links with expiry
```prisma
model Link {
  id            String    @id @default(cuid())
  hash          String    @unique  // URL-safe hash
  type          LinkType  @default(PUBLIC) // PUBLIC, PRESIGNED, CLOUDFRONT
  fileId        String
  expiresAt     DateTime?
  passwordHash  String?
  maxDownloads  Int?
  downloadCount Int       @default(0)
  allowDownload Boolean   @default(true)
  allowPreview  Boolean   @default(true)
  userId        String
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

### AccessLog
Audit trail for shared links
```prisma
model AccessLog {
  id           String   @id @default(cuid())
  linkId       String?
  userId       String?
  teamId       String?
  ipAddress    String
  userAgent    String?
  action       String
  resourceType String?
  resourceId   String?
  success      Boolean
  errorMessage String?
  metadata     Json?
  createdAt    DateTime @default(now())
}
```

---

## 🔐 Security Architecture

### 1. **Password Security**
```typescript
// User password flow:
User Password → scrypt (salted) → passwordHash (stored in DB)
```

**Never stored:** Raw password  
**Stored:** scrypt hash for verification  
**Used for:** Authentication only

### 2. **AWS Credentials Encryption**
```typescript
// Encryption process:
ENCRYPTION_KEY + salt → PBKDF2 (100k) → 32-byte key
                           ↓
AWS Credentials → AES-256-GCM
                     ↓
          base64(salt + iv + authTag + ciphertext)
```

**Algorithm:** AES-256-GCM  
**Key Derivation:** PBKDF2 with 100,000 iterations  
**Integrity:** GCM auth tag prevents tampering  
**Uniqueness:** Random salt + IV per credential

### 3. **Session Security**
```typescript
// JWT session flow:
Login Success → next-auth → JWT Token (signed with NEXTAUTH_SECRET)
                              ↓
              HTTP-only cookie (browser can't access)
                              ↓
              Middleware validates on each request
```

**Token Type:** JWT  
**Storage:** HTTP-only cookie  
**Expiry:** 30 days (configurable)  
**Protection:** CSRF protection built-in

### 4. **S3 Access Pattern**
```typescript
// File upload flow:
1. User clicks "Upload"
2. Frontend requests presigned URL from backend
3. Backend decrypts AWS credentials
4. Backend generates presigned POST URL (15-min expiry)
5. Frontend uploads directly to S3
6. No file data touches app server
```

**Security:** Presigned URLs have:
- Time expiration (15 minutes)
- Content-type restrictions
- Size limits
- Bucket/key restrictions

---

## 🔄 Key Flows

### Registration Flow
1. User enters email + password on `/register`
2. Frontend sends POST to `/api/auth/register`
3. Backend:
   - Validates email format with Zod
   - Checks if email already exists
  - Hashes password with `hashPassword()` (scrypt)
   - Creates user in database
   - Returns success/error
4. User redirected to `/login`

### Login Flow
1. User enters credentials on `/login`
2. Frontend calls `signIn()` from next-auth/react
3. next-auth:
   - Sends credentials to authorize function
   - Verifies password hash
   - Creates JWT session
   - Sets HTTP-only cookie
4. User redirected to `/dashboard`

### Add AWS Credentials Flow
1. User fills form on `/dashboard/credentials`
2. Frontend sends POST to `/api/credentials` with:
   ```json
   {
     "name": "Production S3",
     "accessKey": "AKIA...",
     "secretKey": "...",
     "region": "us-east-1",
     "bucket": "my-bucket"
   }
   ```
3. Backend:
   - Gets user session
   - Validates credentials with AWS SDK
   - Encrypts credentials with `encrypt()`
   - Stores encrypted data + IV + authTag in DB
4. Raw credentials discarded from memory

### File Upload Flow
1. User drags file to `/dashboard/files`
2. Frontend requests presigned URL from `/api/files` (POST)
3. Backend:
   - Gets user session
   - Fetches user's AWS credentials (encrypted)
   - Decrypts credentials in memory
   - Generates presigned POST URL
   - Returns URL + required fields
4. Frontend uploads directly to S3 with FormData
5. Frontend sends metadata to `/api/files` (POST)
6. Backend creates File record in database

### Share Link Flow
1. User clicks "Share" on a file
2. Frontend sends POST to `/api/links`:
   ```json
   {
     "fileId": "cuid123",
     "type": "PRESIGNED",
     "expiresIn": 86400,
     "password": "optional-pass",
     "maxDownloads": 5,
     "allowDownload": true,
     "allowPreview": true
   }
   ```
3. Backend:
  - Generates unique hash
  - Creates Link record
  - Returns share URL: `/share/abc123xyz`
4. Anyone with link can access (with password if set)

---

## ⚙️ Configuration Files

### `.env` (Environment Variables)
```bash
# Database
DATABASE_URL="postgresql://s3portal:PASSWORD@localhost:5433/s3portal?schema=public"

# Authentication
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<random-32-plus-chars>"

# Encryption (for AWS credentials)
ENCRYPTION_KEY="<random-32-char-key>"
```

**Critical:** Never commit `.env` to git! Use `.env.example` template

### `next.config.js`
```javascript
module.exports = {
  experimental: {
    serverActions: true,  // Enable server actions
  },
  output: 'standalone',   // For Docker deployment
}
```

### `tsconfig.json`
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]  // Import alias: import { db } from '@/lib/db'
    }
  }
}
```

### `tailwind.config.ts`
```typescript
{
  darkMode: ["class"],  // Enable dark mode with class
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
}
```

---

## 🛠️ Development Setup

### Current State (as of Jan 13, 2026)
✅ PostgreSQL running in Docker on port 5433  
✅ Database migrated and ready  
✅ next-auth v4.24.6 configured  
✅ All dependencies installed  
✅ Dev server running on http://localhost:3000  

### Quick Commands
```bash
# Start dev server
npm run dev

# Database commands
docker start s3-portal-postgres   # Start DB
docker stop s3-portal-postgres    # Stop DB
npx prisma studio                  # View DB in browser

# Run system check
./check-system.sh

# Reset database
docker stop s3-portal-postgres
docker rm s3-portal-postgres
docker volume rm s3portal_postgres_data
./setup-db.sh
```

---

## 🏗️ Code Organization Patterns

### 1. **API Route Pattern**
```typescript
// app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  // 1. Authenticate
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Validate input (with Zod)
  // 3. Perform operation
  // 4. Return response
  return NextResponse.json({ data: 'success' })
}
```

### 2. **Server Component Pattern**
```typescript
// app/dashboard/page.tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  
  // Fetch data directly (no useEffect needed)
  const data = await prisma.file.findMany({
    where: { userId: session.user.id }
  })

  return <div>{/* Render data */}</div>
}
```

### 3. **Client Component Pattern**
```typescript
'use client'  // MUST be at top for client components

import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'

export default function ClientComponent() {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/example', { method: 'POST' })
      const data = await res.json()
      toast({ title: 'Success!' })
    } catch (error) {
      toast({ title: 'Error', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return <button onClick={handleSubmit}>Submit</button>
}
```

---

## 🔍 Important Implementation Details

### 1. **Why getServerSession vs auth()?**
```typescript
// ❌ OLD (next-auth v5 beta)
import { auth } from '@/lib/auth'
const session = await auth()

// ✅ NEW (next-auth v4 stable)
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
const session = await getServerSession(authOptions)
```
**Reason:** v5 beta had compatibility issues with Next.js 14.1

### 2. **Why middleware uses getToken?**
```typescript
// middleware.ts
import { getToken } from 'next-auth/jwt'

// Can't use getServerSession in middleware (edge runtime)
const token = await getToken({ 
  req: request, 
  secret: process.env.NEXTAUTH_SECRET 
})
```
**Reason:** Middleware runs in Edge Runtime, can't access full Node.js APIs

### 3. **Why Prisma singleton pattern?**
```typescript
// lib/db.ts
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```
**Reason:** Prevents "too many database connections" in development (hot reload)

### 4. **Why port 5433 for PostgreSQL?**
**Reason:** Port 5432 often occupied by system PostgreSQL on macOS. Using 5433 avoids conflicts.

---

## 📦 Dependencies Explained

### Production Dependencies
```json
{
  "next": "14.1.0",              // React framework
  "react": "^18.2.0",            // UI library
  "next-auth": "4.24.6",         // Authentication (stable)
  "@prisma/client": "^5.7.1",    // Database client
  "zod": "^3.22.4",              // Validation
  "@aws-sdk/client-s3": "^3.x", // S3 operations
  "react-dropzone": "^14.2.3",   // File uploads
  "lucide-react": "^0.307.0",    // Icons
  "@radix-ui/react-*": "^1.x"    // UI primitives
}
```

### Dev Dependencies
```json
{
  "typescript": "^5.3.3",        // Type checking
  "prisma": "^5.7.1",            // Database toolkit
  "@types/*": "latest",          // Type definitions
  "tailwindcss": "^3.4.0",       // CSS framework
  "autoprefixer": "^10.4.16",    // CSS vendor prefixes
  "postcss": "^8.4.32"           // CSS processing
}
```

---

## 🚀 Deployment Options

### 1. **Docker (Recommended)**
```bash
docker build -t s3-portal .
docker run -p 3000:3000 --env-file .env s3-portal
```

### 2. **Docker Compose**
```bash
docker-compose up -d
```

### 3. **Platform-Specific**
- **Vercel**: `vercel --prod`
- **Railway**: `railway up`
- **Fly.io**: `fly deploy`
- **EC2**: Traditional server deployment

---

## 🔮 Future Enhancements

### Phase 1 (MVP Complete) ✅
- [x] User registration/login
- [x] AWS credentials encryption
- [x] File upload/download
- [x] Shareable links
- [x] Basic file browser

### Phase 2 (Team Features)
- [ ] Team creation and management
- [ ] Team member invitations
- [ ] Role-based access control (Owner/Admin/Viewer)
- [ ] Team-scoped credentials
- [ ] Activity logs per team

### Phase 3 (Advanced Features)
- [ ] Multi-factor authentication (2FA)
- [ ] S3 bucket browsing (folder navigation)
- [ ] Bulk file operations
- [ ] File search and filtering
- [ ] CloudFront CDN integration
- [ ] Batch download (zip)
- [ ] File versioning support

### Phase 4 (Enterprise)
- [ ] SSO integration (SAML/OAuth)
- [ ] Audit logs and compliance
- [ ] Usage analytics
- [ ] Webhooks for events
- [ ] API for programmatic access

---

## 🐛 Known Issues & Limitations

### Current Limitations
1. **No file preview** - Files must be downloaded to view
2. **No folder support** - Flat file listing only
3. **Team features incomplete** - Models exist but UI not implemented
4. **No batch operations** - One file at a time
5. **No mobile optimization** - Desktop-first UI

### Technical Debt
1. **Error handling** - Some routes need better error messages
2. **Loading states** - More loading indicators needed
3. **Form validation** - Client-side validation incomplete
4. **Tests** - No unit/integration tests yet
5. **Documentation** - API documentation needed

---

## 📝 Development Notes

### Testing the Application

1. **Create Account**
   ```
   Visit: http://localhost:3000/register
   Email: test@example.com
   Password: TestPassword123!
   ```

2. **Add AWS Credentials**
   ```
   Go to: /dashboard/credentials
   - Name: My S3 Bucket
   - Access Key: Your AWS access key
   - Secret Key: Your AWS secret key
   - Region: us-east-1
   - Bucket: your-bucket-name
   ```

3. **Upload File**
   ```
   Go to: /dashboard/files
   - Drag and drop a file
   - Wait for upload
   - See file in list
   ```

4. **Create Share Link**
   ```
   Click "Share" on any file
   - Set expiry date (optional)
   - Set password (optional)
   - Copy link
   - Test in incognito window
   ```

### Debugging Tips

**Database Issues**
```bash
# Check if Postgres is running
docker ps | grep postgres

# View logs
docker logs s3-portal-postgres

# Connect to DB
docker exec -it s3-portal-postgres psql -U s3portal
```

**Authentication Issues**
```bash
# Check session
# Visit: http://localhost:3000/api/auth/session

# Clear cookies and try again
# DevTools → Application → Cookies → Delete all
```

**Build Issues**
```bash
# Clean rebuild
rm -rf .next node_modules
npm install
npm run dev
```

---

## 🎓 Learning Resources

### Next.js App Router
- [Next.js Docs](https://nextjs.org/docs)
- [App Router Guide](https://nextjs.org/docs/app)

### Prisma
- [Prisma Docs](https://www.prisma.io/docs)
- [Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)

### AWS SDK v3
- [AWS SDK Docs](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/)
- [S3 Examples](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/s3-examples.html)

### Encryption
- [Node.js Crypto](https://nodejs.org/api/crypto.html)
- [AES-GCM Guide](https://en.wikipedia.org/wiki/Galois/Counter_Mode)

---

## 🤝 Contributing Guidelines

### Code Style
- Use TypeScript strict mode
- Follow existing patterns
- Add comments for complex logic
- Use Zod for validation
- Handle errors gracefully

### Git Workflow
```bash
# Create feature branch
git checkout -b feature/your-feature

# Commit with meaningful message
git commit -m "Add file preview feature"

# Push and create PR
git push origin feature/your-feature
```

### Before Committing
- [ ] TypeScript compiles without errors
- [ ] Code formatted (Prettier)
- [ ] No console.logs left
- [ ] Tested locally
- [ ] Updated documentation if needed

---

## 📞 Support & Contact

### Getting Help
1. Check this documentation first
2. Review existing code for patterns
3. Check Next.js/Prisma docs
4. Ask in team chat

### Reporting Issues
Include:
- What you tried to do
- What happened
- Error messages (full stack trace)
- Steps to reproduce
- Environment (OS, Node version, etc.)

---

## 🎉 Success Criteria

You'll know the project is working when:
- ✅ Dev server starts without errors
- ✅ Can register a new account
- ✅ Can login with credentials
- ✅ Can add AWS credentials
- ✅ Can upload files to S3
- ✅ Can see files in dashboard
- ✅ Can create shareable links
- ✅ Can access shared files without login

---

**Project Status:** Ready for development ✅  
**Next Step:** Start testing features and building team functionality!

---

_Last updated: January 13, 2026 - All systems operational_ 🚀
