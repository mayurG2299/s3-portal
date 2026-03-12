<div align="center">

# S3 Portal

**A self-hosted file portal for teams — built on AWS S3, designed for security.**

[![Docker Hub](https://img.shields.io/docker/v/may99/s3-portal?label=Docker%20Hub&logo=docker&color=0db7ed)](https://hub.docker.com/r/may99/s3-portal)
[![Docker Pulls](https://img.shields.io/docker/pulls/may99/s3-portal?logo=docker&color=0db7ed)](https://hub.docker.com/r/may99/s3-portal)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://typescriptlang.org)

[Docker Hub](https://hub.docker.com/r/may99/s3-portal) · [Quick Start](#-quick-start) · [Configuration](#-configuration) · [Self-Hosting](#-self-hosting-with-docker) · [Docs](docs/)

</div>

---

S3 Portal is a production-grade, self-hosted file management portal for teams. You bring your own AWS credentials — the portal handles uploads, sharing, access control, and audit trails. Files go directly from the browser to S3; nothing ever touches your server.

## ✨ Features

| Category | Feature |
|---|---|
| **File Management** | Browser, drag-and-drop upload, search, folders |
| **Direct Uploads** | Presigned URLs — files never touch the server |
| **Sharing** | Expiring links, password protection, download limits |
| **CDN** | CloudFront signed URL support |
| **Teams** | Invite members, role-based permissions (Owner / Admin / Viewer / custom) |
| **Security** | AES-256-GCM encrypted credentials, zero plaintext storage |
| **Audit** | Full access log with IP, user agent, success/failure |
| **Themes** | Nebula, Catppuccin, Tokyo Night, Dracula, Nord, Rosé Pine |

## 🐳 Self-Hosting with Docker

The fastest way to get running. Requires Docker and a PostgreSQL database.

**1. Generate secrets**

```bash
export NEXTAUTH_SECRET=$(openssl rand -base64 32)
export ENCRYPTION_KEY=$(openssl rand -base64 32 | cut -c1-32)
echo "NEXTAUTH_SECRET=$NEXTAUTH_SECRET"
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY"
```

**2. Create your `.env` file**

```env
# Database (bundled Postgres via Docker Compose)
DB_PASSWORD=change-me-to-a-strong-password

# Auth
NEXTAUTH_SECRET=<generated above>
NEXTAUTH_URL=http://localhost:3000

# Encryption
ENCRYPTION_KEY=<generated above>

# App URL (used in share links)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Docker Hub username
DOCKER_USER=may99
```

**3. Pull and start**

```bash
curl -O https://raw.githubusercontent.com/mayurG2299/s3-portal/main/docker-compose.production.yml
docker compose -f docker-compose.production.yml up -d
```

**4. First-time seed (system roles)**

```bash
docker compose -f docker-compose.production.yml run --rm app npx prisma db seed
```

**5. Open the app**

Visit [http://localhost:3000](http://localhost:3000) → Register your account → Add AWS credentials → Start uploading.

> Updating to a new release:
> ```bash
> docker compose -f docker-compose.production.yml pull
> docker compose -f docker-compose.production.yml up -d
> ```

---

## 🚀 Quick Start (Local Development)

**Prerequisites**

| Requirement | Version |
|---|---|
| Node.js | 18+ |
| PostgreSQL | 14+ (or SQLite for dev) |
| npm | 9+ |

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env — set DATABASE_URL, NEXTAUTH_SECRET, ENCRYPTION_KEY

# 3. Set up the database
npm run db:push
npm run db:seed

# 4. Start
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## ⚙️ Configuration

### Required Environment Variables

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/s3portal` |
| `NEXTAUTH_SECRET` | Min 32-char random secret | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Your app's public URL | `https://s3.mycompany.com` |
| `ENCRYPTION_KEY` | Exactly 32-char key for AWS credential encryption | `openssl rand -base64 32 \| cut -c1-32` |
| `NEXT_PUBLIC_APP_URL` | Same as `NEXTAUTH_URL` — used in share links | `https://s3.mycompany.com` |

### Optional

| Variable | Default | Description |
|---|---|---|
| `DB_PASSWORD` | — | Postgres password (Docker only) |
| `LOG_LEVEL` | `INFO` | `DEBUG / INFO / WARN / ERROR` |

### S3 Bucket CORS (Required for uploads)

Before uploading, configure CORS on your S3 bucket:

1. Open your bucket in the AWS Console → **Permissions** → **CORS**
2. Paste and save:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": ["https://your-s3-portal-domain.com"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

> See [docs/S3-CORS-SETUP.md](docs/S3-CORS-SETUP.md) for full CORS guide including CloudFront.

---

## 🔐 Security Model

```
Browser ──► Server:  "Give me a presigned URL for this file"
Browser ──► S3:      Direct upload (server never sees file bytes)
Server  ──► DB:      Stores metadata only (filename, size, S3 key)
```

- **AWS credentials** are encrypted with AES-256-GCM before being written to the database
- **Share links** use cryptographically random hashes
- **Passwords** are hashed with scrypt
- **Sessions** are JWT-based (HttpOnly cookies)
- **Files never touch the server** — only presigned URL metadata does

---

## 🏗 Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS + Radix UI |
| ORM | Prisma 5 |
| Database | PostgreSQL (recommended) / SQLite |
| Auth | NextAuth v4 (JWT sessions) |
| Storage | AWS S3 + optional CloudFront CDN |
| Encryption | AES-256-GCM (Node.js `crypto`) |
| Container | Docker (multi-arch: `amd64` + `arm64`) |

---

## 🗂 Project Structure

```
s3-portal/
├── app/
│   ├── api/                  # API routes
│   ├── dashboard/            # Dashboard pages
│   │   ├── admin/            # Admin — permissions, audit log
│   │   ├── files/            # File browser
│   │   ├── settings/         # Bucket & team settings
│   │   └── ...
│   ├── login/ register/      # Auth pages
│   └── share/[hash]/         # Public share page
├── components/
│   └── ui/                   # Radix-based UI primitives
├── lib/
│   ├── auth.ts               # NextAuth config + JWT callbacks
│   ├── aws.ts                # S3 / CloudFront SDK
│   ├── crypto.ts             # AES-256-GCM encryption
│   ├── db.ts                 # Prisma client
│   └── permissions.ts        # RBAC helpers
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts               # System role seeding
│   └── migrations/
├── docs/                     # Extended documentation
├── Dockerfile                # Multi-stage, multi-arch
├── docker-compose.yml        # Local dev
├── docker-compose.production.yml
└── publish.sh                # Docker Hub publish script
```

---

## 🛠 Development

```bash
npm run dev              # Start dev server
npm run build            # Production build
npm run lint             # ESLint
npm test                 # Jest tests

npm run db:generate      # Regenerate Prisma client
npm run db:push          # Sync schema → DB (dev)
npm run db:migrate       # Create a migration
npm run db:seed          # Seed system roles
npm run db:studio        # Open Prisma Studio UI
```

---

<div align="center">
Built for teams who value security and data ownership.
</div>
