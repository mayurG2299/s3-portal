# Deployment Guide - S3 Portal

## Pre-Deployment Checklist

- [ ] All code changes tested locally
- [ ] Environment variables validated
- [ ] Database backups created
- [ ] Security review completed
- [ ] SSL/TLS certificate ready
- [ ] Domain configured

## Local Testing

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Run database migrations
npm run db:migrate

# Seed initial data (optional)
npm run db:seed

# Start development server
npm run dev

# Build for production
npm run build

# Test production build
npm start
```

## Docker Deployment

### Build Docker Image

```bash
# Using the multi-stage Dockerfile (production target)
docker build -f Dockerfile --target production -t s3-portal:latest .

# Tag for Docker Hub
docker tag s3-portal:latest your-username/s3-portal:latest
docker tag s3-portal:latest your-username/s3-portal:1.0.0
```

### Push to Docker Hub

```bash
# Log in to Docker Hub
docker login

# Push images
docker push your-username/s3-portal:latest
docker push your-username/s3-portal:1.0.0
```

### Deploy with Docker Compose

```bash
# Use production compose file
cp docker-compose.production.yml docker-compose.yml

# Create .env file with secrets (DO NOT COMMIT)
cat > .env << EOF
DB_PASSWORD=$(openssl rand -base64 32)
NEXTAUTH_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32 | cut -c1-32)
NEXTAUTH_URL=https://your-domain.com
NEXT_PUBLIC_APP_URL=https://your-domain.com
LOG_LEVEL=INFO
EOF

# Start services
docker compose up -d

# View logs
docker compose logs -f app

# Check health
curl http://localhost:3000/api/health
```

## Production Environment Variables

```dotenv
# REQUIRED - Production must-haves

# Database
DATABASE_URL=postgresql://s3portal:YOUR_SECURE_PASSWORD@postgres:5432/s3portal?schema=public

# Authentication
NEXTAUTH_SECRET=YOUR_32_CHAR_RANDOM_SECRET
NEXTAUTH_URL=https://your-domain.com

# Encryption
ENCRYPTION_KEY=YOUR_32_CHAR_RANDOM_KEY

# Application
NEXT_PUBLIC_APP_URL=https://your-domain.com

# OPTIONAL but recommended

NODE_ENV=production
LOG_LEVEL=INFO

# For rate limiting (optional)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

### Generate Secure Secrets

```bash
# NEXTAUTH_SECRET and encryption key (32+ characters)
openssl rand -base64 32

# ENCRYPTION_KEY (exactly 32 characters)
openssl rand -base64 32 | cut -c1-32

# DB_PASSWORD (strong password)
openssl rand -base64 24
```

## SSL/TLS Configuration

### With Nginx Reverse Proxy

```nginx
server {
  listen 443 ssl http2;
  server_name your-domain.com;

  ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

  # Security headers
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "DENY" always;

  location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

# Redirect HTTP to HTTPS
server {
  listen 80;
  server_name your-domain.com;
  return 301 https://$server_name$request_uri;
}
```

## Monitoring

### Health Check

```bash
# Verify app is healthy
curl https://your-domain.com/api/health

# Response:
# {
#   "status": "ok",
#   "timestamp": "2026-02-02T10:00:00.000Z",
#   "checks": { "database": "ok", "uptime": 3600000 }
# }
```

### Log Aggregation

Configure Docker to use a log driver:

```bash
# CloudWatch
docker run --log-driver awslogs \
  --log-opt awslogs-group=/ecs/s3-portal \
  --log-opt awslogs-region=us-east-1 \
  s3-portal:latest

# Syslog
docker run --log-driver syslog \
  --log-opt syslog-address=udp://logs.example.com:514 \
  s3-portal:latest
```

## Database Management

### Backup

```bash
# Create database backup
docker compose exec postgres pg_dump -U s3portal s3portal > backup.sql

# Compress backup
gzip backup.sql
```

### Restore

```bash
# Restore from backup
gunzip backup.sql.gz
docker compose exec -T postgres psql -U s3portal s3portal < backup.sql
```

### Migrations

```bash
# Run pending migrations
docker compose exec app npx prisma migrate deploy

# Create manual migration
docker compose exec app npx prisma migrate dev --name migration_name
```

## Troubleshooting

### App not starting

```bash
# Check logs
docker compose logs app

# Verify environment variables
docker compose config | grep -A 20 'app:'

# Check database connection
docker compose exec app npm run db:generate
```

### Database connection errors

```bash
# Verify database is healthy
docker compose logs postgres

# Test connection from app
docker compose exec app npx prisma studio

# Check DATABASE_URL format
echo $DATABASE_URL
```

### High memory usage

```bash
# Monitor resource usage
docker stats

# Restart services
docker compose restart

# Increase limits in docker-compose.yml
```

## Scaling

### Multiple App Instances with Load Balancer

```yaml
version: '3.8'

services:
  postgres:
    # ... config

  app1:
    image: s3-portal:latest
    depends_on:
      postgres:
        condition: service_healthy

  app2:
    image: s3-portal:latest
    depends_on:
      postgres:
        condition: service_healthy

  nginx:
    image: nginx:latest
    ports:
      - "3000:3000"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - app1
      - app2
```

## Security Best Practices

1. **Never commit `.env`** - Use secrets management
2. **Use strong passwords** - Minimum 32 characters for secrets
3. **Enable SSL/TLS** - Always use HTTPS in production
4. **Database backups** - Regular automated backups
5. **Monitor logs** - Set up log aggregation and alerting
6. **Keep dependencies updated** - Regular security patches
7. **Limit resource usage** - Prevent resource exhaustion attacks
8. **Review access logs** - Monitor for suspicious activity

## Performance Optimization

1. **Database connection pooling** - Use PgBouncer for PostgreSQL
2. **Redis caching** - Cache frequently accessed data
3. **CDN for static assets** - Use CloudFront for S3 content
4. **Image optimization** - Next.js Image component with optimization
5. **Database indexes** - Add indexes for frequently queried columns

---

Need help? Check the [PRODUCTION-READINESS-REVIEW.md](./PRODUCTION-READINESS-REVIEW.md)
