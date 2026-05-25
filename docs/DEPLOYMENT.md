# S3 Portal - Production Deployment Guide

## Environment Variables

### Required Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/s3portal"

# NextAuth (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET="your-secret-min-32-chars"
NEXTAUTH_URL="https://your-domain.com"

# Encryption (generate with: openssl rand -base64 32 | cut -c1-32)
ENCRYPTION_KEY="exactly-32-characters-key!!"

# App
NEXT_PUBLIC_APP_URL="https://your-domain.com"
NODE_ENV="production"
```

## Deploy to Railway

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Add environment variables
railway variables set NEXTAUTH_SECRET="$(openssl rand -base64 32)"
railway variables set ENCRYPTION_KEY="$(openssl rand -base64 32 | cut -c1-32)"

# Deploy
railway up

# Add PostgreSQL
railway add postgres

# Your app is live!
```

## Deploy to Fly.io

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Launch app
fly launch

# Set secrets
fly secrets set NEXTAUTH_SECRET="$(openssl rand -base64 32)"
fly secrets set ENCRYPTION_KEY="$(openssl rand -base64 32 | cut -c1-32)"

# Attach Postgres
fly postgres create
fly postgres attach <postgres-app-name>

# Deploy
fly deploy
```

## Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Set environment variables in Vercel Dashboard:
# - NEXTAUTH_SECRET
# - ENCRYPTION_KEY
# - DATABASE_URL (use Vercel Postgres or external)
# - NEXTAUTH_URL
# - NEXT_PUBLIC_APP_URL

# Production deployment
vercel --prod
```

**Important for Vercel:**
- Use Vercel Postgres or external database (Supabase, Neon, etc.)
- Ensure all environment variables are set in Vercel Dashboard
- Files upload directly to S3 (no serverless limitations)

## Docker Deployment (Self-Hosted)

### Using Docker Compose (Recommended)

```bash
# 1. Clone repository
git clone <your-repo>
cd s3-portal

# 2. Create .env file
cp .env.example .env

# 3. Generate secrets
export NEXTAUTH_SECRET=$(openssl rand -base64 32)
export ENCRYPTION_KEY=$(openssl rand -base64 32 | cut -c1-32)
export DB_PASSWORD=$(openssl rand -base64 16)

# 4. Update .env with your values
nano .env

# 5. Start services
docker-compose up -d

# 6. Check logs
docker-compose logs -f app

# App available at http://localhost:3000
```

### Using Standalone Docker

```bash
# Build image
docker build -t s3-portal .

# Run PostgreSQL
docker run -d \
  --name s3-postgres \
  -e POSTGRES_PASSWORD=yourpassword \
  -e POSTGRES_DB=s3portal \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:15-alpine

# Run app
docker run -d \
  --name s3-portal \
  --link s3-postgres \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://postgres:yourpassword@s3-postgres:5432/s3portal" \
  -e NEXTAUTH_SECRET="your-secret" \
  -e ENCRYPTION_KEY="your-32-char-key" \
  -e NEXTAUTH_URL="http://localhost:3000" \
  -e NEXT_PUBLIC_APP_URL="http://localhost:3000" \
  s3-portal
```

## AWS Setup

### Create IAM User

1. Go to AWS IAM Console
2. Create new user: `s3-portal-user`
3. Attach policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-bucket-name",
        "arn:aws:s3:::your-bucket-name/*"
      ]
    }
  ]
}
```

4. Save Access Key ID and Secret Access Key
5. Enter these in S3 Portal dashboard

### S3 Bucket CORS Configuration

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["https://your-domain.com"],
    "ExposeHeaders": ["ETag"]
  }
]
```

## CloudFront Setup (Optional)

1. Create CloudFront distribution with S3 origin
2. Generate key pair for signed URLs
3. Add CloudFront config in S3 Portal credentials

## Health Checks

```bash
# Check app health
curl http://localhost:3000

# Check database connection
docker exec s3-postgres pg_isready

# View logs
docker-compose logs -f
```

## Backup

```bash
# Backup database
docker exec s3-postgres pg_dump -U postgres s3portal > backup.sql

# Restore database
docker exec -i s3-postgres psql -U postgres s3portal < backup.sql
```

## Monitoring

### Recommended Tools
- Uptime: Uptime Robot, Better Uptime
- Logs: Papertrail, LogDNA
- APM: New Relic, Datadog
- Errors: Sentry

## Security Checklist

- [ ] Use strong NEXTAUTH_SECRET (32+ characters)
- [ ] Use unique ENCRYPTION_KEY (exactly 32 characters)
- [ ] Enable HTTPS (SSL certificate)
- [ ] Set secure DATABASE_URL password
- [ ] Configure S3 bucket CORS
- [ ] Use IAM user with minimal permissions
- [ ] Enable AWS CloudTrail for audit logs
- [ ] Set up database backups
- [ ] Configure firewall rules
- [ ] Enable rate limiting (optional)

## Troubleshooting

### Database Connection Issues
```bash
# Check DATABASE_URL format
echo $DATABASE_URL

# Test connection
docker exec s3-postgres psql $DATABASE_URL -c "SELECT 1"
```

### Upload Failures
- Check S3 CORS configuration
- Verify IAM permissions
- Check bucket policy
- Inspect browser console for errors

### Authentication Issues
- Verify NEXTAUTH_SECRET is set
- Check NEXTAUTH_URL matches your domain
- Clear browser cookies

## Performance Optimization

- Enable CloudFront for faster downloads
- Use PostgreSQL connection pooling
- Configure Redis for session storage (optional)
- Enable Next.js caching
- Use CDN for static assets

## Updating

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose down
docker-compose build
docker-compose up -d

# Run migrations
docker-compose exec app npx prisma migrate deploy
```
