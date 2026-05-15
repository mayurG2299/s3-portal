# S3 Portal - Project Summary

## ✅ What Has Been Built

A **production-grade, self-hosted S3 file portal** with zero-trust security architecture.

### Core Features Implemented

#### 🔐 Security (Zero-Trust Architecture)
- ✅ AES-256-GCM encryption for AWS credentials
- ✅ PBKDF2 key derivation with salt (100,000 iterations)
- ✅ Randomized share link hashes
- ✅ Password hashing with scrypt
- ✅ Session-based authentication (NextAuth v4.24.6, JWT)
- ✅ CSRF protection built-in
- ✅ No plaintext secrets ever stored or logged

#### 📤 File Management
- ✅ Direct S3 uploads via presigned URLs (no server file handling)
- ✅ **Multipart uploads for files ≥50MB** with parallel part processing (up to 3 concurrent)
- ✅ Automatic progress tracking and retry on failure
- ✅ Drag-and-drop file upload UI
- ✅ File browser with folder navigation
- ✅ Delete, rename, move operations
- ✅ File metadata tracking
- ✅ Support for any file type

#### 🔗 Sharing System
- ✅ Public shareable links with random hashes
- ✅ Configurable expiry times (1 hour to 30 days)
- ✅ Optional password protection
- ✅ Download limits
- ✅ Preview/download permissions
- ✅ Access logging and audit trails

#### ☁️ AWS Integration
- ✅ Multi-credential support
- ✅ S3 presigned URL generation
- ✅ CloudFront signed URL support (optional)
- ✅ AWS STS validation
- ✅ Per-credential bucket configuration

#### 👥 Team Collaboration (Backend Ready)
- ✅ Team model with Owner/Admin/Viewer roles
- ✅ Credential sharing within teams
- ✅ Permission-based access control
- ✅ Team member management API
- ⏳ Team UI pages (placeholder created)

#### 🎨 User Interface
- ✅ Modern, Google Drive-like interface
- ✅ Responsive design (mobile-friendly)
- ✅ Collapsible, accessible sidebar with keyboard-focus styles
- ✅ Dark mode ready (Tailwind CSS)
- ✅ Radix UI components
- ✅ Toast notifications
- ✅ Progress indicators
- ✅ Clean navigation

#### 🗄️ Database
- ✅ Prisma ORM with PostgreSQL
- ✅ SQLite compatibility
- ✅ Comprehensive schema (users, teams, credentials, files, links, logs)
- ✅ Migration system
- ✅ Indexes for performance

#### 🚀 Deployment
- ✅ Docker support with multi-stage builds
- ✅ Docker Compose for one-command deployment
- ✅ Next.js standalone output
- ✅ Railway deployment ready
- ✅ Fly.io deployment ready
- ✅ Vercel deployment compatible

## 📁 Project Structure

```
s3-portal/
├── app/                          # Next.js App Router
│   ├── api/                     # API Routes
│   │   ├── auth/               # Authentication endpoints
│   │   ├── credentials/        # AWS credential management
│   │   ├── files/              # File operations
│   │   ├── links/              # Share link management
│   │   └── share/[hash]/       # Public share access
│   ├── dashboard/              # Dashboard pages
│   │   ├── credentials/        # Credential management UI
│   │   ├── files/              # File browser UI
│   │   ├── links/              # Shared links UI
│   │   ├── settings/           # User settings
│   │   ├── teams/              # Team management (placeholder)
│   │   ├── layout.tsx          # Dashboard layout with sidebar
│   │   └── page.tsx            # Dashboard home
│   ├── login/                  # Login page
│   ├── register/               # Registration page
│   ├── share/[hash]/           # Public share page
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Home page (redirects)
│   └── globals.css             # Global styles
├── components/                  # React Components
│   ├── ui/                     # UI primitives (Button, Input, etc.)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── progress.tsx
│   │   ├── select.tsx
│   │   ├── toast.tsx
│   │   └── toaster.tsx
│   └── file-upload.tsx         # File upload component
├── lib/                         # Core Utilities
│   ├── auth.ts                 # NextAuth configuration
│   ├── aws.ts                  # AWS SDK integration
│   ├── crypto.ts               # Encryption/hashing utilities
│   ├── db.ts                   # Prisma client
│   └── utils.ts                # Helper functions
├── hooks/                       # React Hooks
│   └── use-toast.ts            # Toast notification hook
├── prisma/                      # Database
│   ├── schema.prisma           # Database schema
│   └── migrations/             # Migration files
├── types/                       # TypeScript Types
│   └── next-auth.d.ts          # NextAuth type extensions
├── Dockerfile                   # Docker image definition
├── docker-compose.yml           # Docker Compose configuration
├── .dockerignore               # Docker ignore file
├── next.config.js              # Next.js configuration
├── tailwind.config.ts          # Tailwind CSS configuration
├── tsconfig.json               # TypeScript configuration
├── package.json                # Dependencies
├── .env.example                # Environment variables template
├── .gitignore                  # Git ignore file
├── setup.sh                    # Automated setup script
├── README.md                   # Full documentation
├── DEPLOYMENT.md               # Production deployment guide
└── QUICKSTART.md               # Quick start guide
```

## 🔧 Technology Stack

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** Radix UI
- **State Management:** React hooks
- **File Upload:** React Dropzone

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Next.js API Routes + Server Actions
- **Database ORM:** Prisma
- **Authentication:** NextAuth v4.24.6 (JWT sessions)
- **AWS SDK:** @aws-sdk v3

### Database
- **Primary:** PostgreSQL 15
- **Alternative:** SQLite (compatible)

### Security
- **Encryption:** AES-256-GCM
- **Key Derivation:** PBKDF2 (100,000 iterations, salted)
- **Hashing:** Scrypt
- **Share hashes:** Randomized nanoid hashes

### DevOps
- **Containerization:** Docker
- **Orchestration:** Docker Compose
- **Deployment:** Railway, Fly.io, Vercel

## 🎯 Key Architectural Decisions

### 1. Zero Server File Handling
Files **never** touch the server. All uploads go directly to S3 via presigned URLs. This:
- Eliminates server storage concerns
- Scales infinitely
- Works on serverless platforms (Vercel)
- Reduces latency

### 2. Encryption at Rest
All AWS credentials are encrypted before storage using AES-256-GCM with:
- Unique salt per credential
- PBKDF2 key derivation (100,000 iterations)
- Authenticated encryption (prevents tampering)

### 3. Stateless Architecture
- JWT-based sessions
- No server-side session storage required
- Horizontally scalable
- Works in serverless environments

### 4. Database-First Design
All metadata stored in relational database:
- Enables powerful querying
- Maintains referential integrity
- Supports transactions
- Easy to backup and restore

## 📊 Database Schema Overview

### Core Tables
1. **User** - User accounts with email/password
2. **Team** - Team organizations
3. **TeamMember** - Team memberships with roles
4. **AWSCredential** - Encrypted AWS credentials
5. **File** - File metadata and S3 keys
6. **Link** - Shareable links with expiry
7. **AccessLog** - Audit trail for share access

### Relationships
- Users own credentials, files, and links
- Teams own credentials and files
- Files belong to credentials
- Links belong to files
- Logs track link access

## 🔒 Security Model

### Credential Storage
```
ENCRYPTION_KEY + salt → PBKDF2 → AES-256-GCM → Database
        ↑
      Server Secret
```

### Upload Flow
```
1. Browser → Server: Request presigned URL
2. Server → S3: Generate presigned URL (expires in 1h)
3. Server → Browser: Return URL
4. Browser → S3: Upload file directly
5. Server → Database: Store metadata only
```

### Share Link Flow
```
1. User creates link
2. Server generates random hash and stores link policy (expiry, limits)
3. Hash stored with file reference
4. Anyone with hash can access (password optional)
5. Access logged for audit
```

## 🚀 Getting Started

### Quick Setup (Automated)
```bash
./setup.sh
npm run dev
```

### Docker Setup
```bash
docker-compose up -d
```

### Manual Setup
```bash
npm install
npm run db:push
npm run dev
```

See [QUICKSTART.md](QUICKSTART.md) for detailed instructions.

## 📦 What You Get

### Out of the Box
- ✅ User authentication
- ✅ AWS credential management
- ✅ File upload/download
- ✅ Share link generation
- ✅ Access control
- ✅ Audit logging
- ✅ Responsive UI
- ✅ Docker deployment

### Easy to Add
- Database migrations (Prisma)
- Custom themes (Tailwind)
- Additional cloud providers
- Rate limiting (Upstash)
- Email notifications
- File versioning
- Search functionality

## 🎨 Customization

### Theming
All colors defined in `tailwind.config.ts`:
```typescript
colors: {
  primary: 'hsl(var(--primary))',
  // ... customize as needed
}
```

### Branding
- Logo: Update in `app/dashboard/layout.tsx`
- Title: Update in `app/layout.tsx`
- Colors: Update CSS variables in `app/globals.css`

### Features
- Add new pages in `app/dashboard/`
- Add new API routes in `app/api/`
- Extend database in `prisma/schema.prisma`

## 🔮 Future Enhancements

### Planned Features
- [ ] Complete team management UI
- [ ] File versioning
- [ ] Bulk operations
- [ ] Advanced search
- [ ] Activity dashboard
- [ ] Email notifications
- [ ] Mobile app
- [ ] Multi-region support

### Easy Extensions
- Add more cloud providers (Azure, GCP)
- Implement webhooks
- Add file preview for images/PDFs
- Virus scanning integration
- Analytics dashboard
- API for programmatic access

## 📚 Documentation

- **[README.md](README.md)** - Full feature documentation
- **[QUICKSTART.md](QUICKSTART.md)** - 5-minute setup guide
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Production deployment
- **Code Comments** - Inline documentation

## 🤝 Contributing

This is a production-ready template. You can:
- Fork and customize for your needs
- Submit pull requests for improvements
- Report issues or bugs
- Share your deployment stories

## 📄 License

MIT License - Free to use, modify, and distribute.

## 🙏 Acknowledgments

Built with:
- Next.js team for the amazing framework
- Vercel for deployment platform
- Prisma for the excellent ORM
- AWS for S3 and CloudFront
- Radix UI for accessible components

---

**Built with ❤️ for teams who value security, privacy, and self-hosting.**

This is GitHub for S3 - a secure, self-hosted, zero-trust file portal.
