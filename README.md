# S3 Portal - Self-Hosted File Portal for Teams

Production-grade Next.js application that acts as a self-hosted S3 file portal with zero-trust security. Users bring their own AWS credentials, and all access is mediated through encrypted, scoped, expiring tokens.

## Features

### Core Functionality
- ✅ Direct S3 uploads via presigned URLs (no server file handling)
- ✅ AWS credential encryption (AES-256) at rest
- ✅ Shareable links with expiry, passwords, and download limits
- ✅ CloudFront signed URL support for CDN delivery
- ✅ Team collaboration with role-based permissions
- ✅ File browser with drag-drop uploads
- ✅ Access logging and audit trails

### Security
- ✅ Zero-trust architecture
- ✅ Encrypted credentials (never stored in plaintext)
- ✅ Randomized share link hashes
- ✅ Session-based authentication with NextAuth
- ✅ CSRF protection built-in
- ✅ No vendor lock-in

### Architecture
- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL (SQLite compatible)
- AWS SDK v3
- Docker ready

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL or SQLite
- AWS account with S3 bucket

### Installation

1. **Clone and install dependencies:**
```bash
cd s3-portal
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env
```

Edit `.env` and set:
- `DATABASE_URL` - Your PostgreSQL connection string
- `NEXTAUTH_SECRET` - Random 32+ character string
- `ENCRYPTION_KEY` - Random 32 character string
- `NEXTAUTH_URL` - Your app URL (http://localhost:3000 for dev)

3. **Initialize database:**
```bash
npm run db:push
```

4. **Run development server:**
```bash
npm run dev
```

Visit http://localhost:3000

## Docker Deployment

### Development Mode

```bash
# Set required environment variables
export NEXTAUTH_SECRET="your-secret-min-32-chars"
export ENCRYPTION_KEY="your-32-character-key-here!"
export DB_PASSWORD="your-db-password"
export NODE_ENV="development"
export BUILD_TARGET="development"

# Start with Docker Compose
docker-compose up -d
```

### Production Mode

```bash
# Set required environment variables
export NEXTAUTH_SECRET="your-secret-min-32-chars"
export ENCRYPTION_KEY="your-32-character-key-here!"
export DB_PASSWORD="your-db-password"
export NODE_ENV="production"
export BUILD_TARGET="production"

# Start with Docker Compose
docker-compose up -d
```

The app will be available at http://localhost:3000

### Environment Variables for Docker

Create a `.env` file:

```env
# Required
NEXTAUTH_SECRET=generate-a-random-secret-key-here-min-32-chars
ENCRYPTION_KEY=generate-a-32-char-encryption-key
DB_PASSWORD=secure-database-password
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000

# Optional
NODE_ENV=production
BUILD_TARGET=production
LOG_LEVEL=INFO
```

#### Railway
```bash
railway up
```

#### Fly.io
```bash
fly launch
fly deploy
```

#### Vercel
```bash
vercel --prod
```
*Note: On Vercel, you must use a hosted PostgreSQL instance (not local)*

## Usage Guide

### 1. Create Account
- Register at `/register`
- Sign in at `/login`

### 2. Add AWS Credentials
- Go to Dashboard → AWS Credentials
- Click "Add Credential"
- Enter your AWS details:
  - Access Key ID
  - Secret Access Key
  - Region
  - Bucket name
- Optional: Add CloudFront configuration

**Your credentials are encrypted** before storage using AES-256.

### 3. Configure S3 Bucket CORS (Required)

⚠️ **Important**: Before uploading files, you must configure CORS on your S3 bucket.

#### Quick Setup:
1. Open your S3 bucket in AWS Console
2. Go to **Permissions** → **CORS**
3. Click **Edit** and paste this configuration:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://yourdomain.com"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

4. Replace `https://yourdomain.com` with your actual domain
5. Save changes

**Why is this needed?** The S3 Portal uploads files directly from your browser to S3. Without CORS, browsers block these cross-origin requests.

📖 **Detailed guide**: See [docs/S3-CORS-SETUP.md](docs/S3-CORS-SETUP.md) for complete instructions, CloudFront setup, and troubleshooting.

### 4. Upload Files
- Navigate to Files
- Select your credential
- Click Upload or drag & drop files
- Files upload **directly to S3** (not through server)

### 5. Share Files
- Click share icon on any file
- Choose expiry time (1 hour to 30 days)
- Copy the generated link
- Optional: Add password protection

### 6. Team Collaboration
- Create a team
- Invite members
- Set roles (Owner, Admin, Viewer)
- Team members can access shared files without seeing AWS keys

## Security Model

### Credential Encryption
```typescript
// Credentials are encrypted before storage
const encrypted = encrypt(accessKey) // AES-256-GCM
// Server never logs or exposes raw keys
```

### Upload Flow
```
Browser → Server (presigned URL request)
Browser → S3 (direct upload)
Server → Database (metadata only)
```

### Zero Data Leakage
- Files never touch the server
- Only metadata stored in database
- AWS keys encrypted at rest
- Presigned URLs expire automatically

## API Routes

- `POST /api/auth/register` - User registration
- `POST /api/auth/[...nextauth]` - NextAuth handlers
- `GET/POST/DELETE /api/credentials` - Manage AWS credentials
- `POST/DELETE/PATCH /api/files` - File operations
- `GET/POST/DELETE /api/links` - Share link management
- `GET /api/share/[hash]` - Public share access

## Database Schema

### Users
- Email/password authentication
- Owns credentials, files, links

### Teams
- Multi-user collaboration
- Role-based access (Owner/Admin/Viewer)

### AWSCredentials
- Encrypted AWS keys
- Region, bucket config
- Optional CloudFront settings

### Files
- S3 object metadata
- Path hierarchy
- Associated credential

### Links
- Public/presigned/CloudFront URLs
- Expiry timestamps
- Password protection
- Download limits

### AccessLogs
- Audit trail for shares
- IP address, user agent
- Success/failure tracking

## Tech Stack

### Frontend
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Radix UI components
- React Dropzone

### Backend
- Next.js API Routes
- Server Actions
- Prisma ORM
- AWS SDK v3
- NextAuth v4.24.6 (JWT sessions)

### Database
- PostgreSQL (recommended)
- SQLite (supported)

### Security
- AES-256-GCM encryption
- Randomized share link hashes
- Scrypt password hashing
- PBKDF2 key derivation

## Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Database commands
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema changes
npm run db:migrate   # Create migration
npm run db:studio    # Open Prisma Studio

# Build for production
npm run build
npm start
```

## Project Structure

```
s3-portal/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard pages
│   ├── login/             # Auth pages
│   └── share/             # Public share pages
├── components/            # React components
│   └── ui/               # UI primitives
├── lib/                   # Core utilities
│   ├── auth.ts           # NextAuth config
│   ├── aws.ts            # AWS SDK integration
│   ├── crypto.ts         # Encryption utilities
│   ├── db.ts             # Prisma client
│   └── utils.ts          # Helper functions
├── prisma/
│   └── schema.prisma     # Database schema
├── Dockerfile            # Container image
├── docker-compose.yml    # Local deployment
└── package.json
```

## Contributing

This is a production-ready template. Feel free to:
- Add new features
- Improve security
- Optimize performance
- Add tests
- Improve documentation

## License

MIT License - Free to use, modify, and distribute.

## Support

For issues, questions, or contributions:
- Open an issue on GitHub
- Submit a pull request
- Check existing documentation

## Roadmap

- [ ] File versioning
- [ ] Bulk operations
- [ ] Advanced search
- [ ] Activity dashboard
- [ ] Email notifications
- [ ] Multi-region support
- [ ] Backup/restore
- [ ] Mobile app

---

**Built with ❤️ for teams who value security and self-hosting.**
