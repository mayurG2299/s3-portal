# Docker Hub Publishing Guide

How to build and publish the S3 Portal image to Docker Hub.

---

## Prerequisites

| Requirement | Check |
|---|---|
| Docker Desktop installed | `docker --version` |
| `buildx` available | `docker buildx version` |
| Docker Hub account | [hub.docker.com](https://hub.docker.com) |
| Public repo named `s3-portal` created on Docker Hub | Hub → Repositories → Create |

---

## First-Time Setup

**1. Create the Docker Hub repository**

Go to [hub.docker.com](https://hub.docker.com) → **Create Repository**
- Name: `s3-portal`
- Visibility: **Public** (free, allows anyone to pull)

**2. Log in from your terminal**

```bash
docker login
# Enter your Docker Hub username and password when prompted
```

---

## Publishing a New Release

Run the publish script from the project root:

```bash
./publish.sh
```

You will be prompted for:

```
  Docker Hub username: yourname
  Version tag (leave blank for :latest only): 1.0.0

  Image    : yourname/s3-portal
  Tags     : :latest, :1.0.0
  Platforms: linux/amd64,linux/arm64

  Proceed? [y/N]
```

The script will:
1. Log you into Docker Hub
2. Create a multi-arch builder (first time only)
3. Build for `linux/amd64` + `linux/arm64`
4. Push both tags to Docker Hub

> **Note:** The first publish takes 5–15 minutes due to multi-arch compilation. Subsequent builds are faster thanks to layer caching.

---

## Test Before Publishing

Always run the local smoke test before pushing a new release:

```bash
./docker-test.sh
```

This builds the production image locally and checks that the server starts. If it prints `✅ Server started` you're good to push.

---

## Tagging Strategy

| What you enter | Tags pushed |
|---|---|
| *(blank)* | `:latest` |
| `1.0.0` | `:1.0.0` + `:latest` |
| `1.1.0-beta` | `:1.1.0-beta` + `:latest` |

Use semantic versioning: `MAJOR.MINOR.PATCH`

---

## For End-Users (Self-Hosting)

Anyone can self-host using `docker-compose.production.yml`:

**1. Copy and fill in environment variables**

```bash
cp .env.example .env
```

Required variables:

| Variable | How to generate |
|---|---|
| `DB_PASSWORD` | Any strong password |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Your deployment URL (e.g. `https://s3.myco.com`) |
| `ENCRYPTION_KEY` | `openssl rand -base64 32 \| cut -c1-32` |
| `NEXT_PUBLIC_APP_URL` | Same as `NEXTAUTH_URL` |
| `DOCKER_USER` | Your Docker Hub username |

**2. Start the stack**

```bash
export DOCKER_USER=yourname
docker compose -f docker-compose.production.yml up -d
```

**3. First time only — seed system roles**

```bash
docker compose -f docker-compose.production.yml run --rm app npx prisma db seed
```

**4. Verify**

```bash
curl http://localhost:3000/api/health
# Expected: HTTP 200
```

Navigate to `http://localhost:3000` → register your account.

---

## Updating an Existing Deployment

```bash
# Pull the latest image
export DOCKER_USER=yourname
docker compose -f docker-compose.production.yml pull

# Restart with the new image
docker compose -f docker-compose.production.yml up -d
```

Migrations run automatically on startup — no manual steps needed.

---

## Troubleshooting

**Build fails with `no space left on device`**
```bash
docker system prune -f   # clears unused images/containers
```

**`buildx` builder not found**
```bash
docker buildx create --name s3portal-builder --use --bootstrap
```

**Container starts but pages show blank / 500**
```bash
# Check logs
docker compose -f docker-compose.production.yml logs app --tail=50

# Most common cause: missing or wrong env variable
```

**Port 3000 already in use**

Edit `docker-compose.production.yml` and change `"3000:3000"` to e.g. `"8080:3000"`.
