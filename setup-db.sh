#!/bin/bash

# S3 Portal - Database Setup
# Automatically sets up PostgreSQL in Docker and configures .env

set -e

echo "🐘 S3 Portal Database Setup"
echo "==========================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "Visit: https://www.docker.com/products/docker-desktop"
    exit 1
fi

echo "✅ Docker found"
echo ""

# Check if container already exists
if docker ps -a --format '{{.Names}}' | grep -q "^s3-portal-postgres$"; then
    echo "⚠️  PostgreSQL container already exists"
    
    # Check if it's running
    if docker ps --format '{{.Names}}' | grep -q "^s3-portal-postgres$"; then
        echo "✅ Container is already running"
        DB_PASSWORD="s3portal"
    else
        echo "Starting existing container..."
        docker start s3-portal-postgres
        DB_PASSWORD="s3portal"
    fi
else
    echo "📦 Creating PostgreSQL container..."
    
    # Generate random password
    DB_PASSWORD=$(openssl rand -base64 12)
    
    # Start PostgreSQL container
    docker run -d \
        --name s3-portal-postgres \
        -e POSTGRES_USER=s3portal \
        -e POSTGRES_PASSWORD="$DB_PASSWORD" \
        -e POSTGRES_DB=s3portal \
        -p 5433:5432 \
        -v s3portal_postgres_data:/var/lib/postgresql/data \
        postgres:15-alpine
    
    echo "✅ PostgreSQL container created"
    echo ""
    echo "⏳ Waiting for database to be ready..."
    sleep 5
fi

echo ""
echo "📝 Database credentials:"
echo "  Host: localhost"
echo "  Port: 5433"
echo "  User: s3portal"
echo "  Password: $DB_PASSWORD"
echo "  Database: s3portal"
echo ""

# Update .env file
echo "🔧 Updating .env file..."

DATABASE_URL="postgresql://s3portal:$DB_PASSWORD@localhost:5433/s3portal?schema=public"

if [ -f .env ]; then
    # macOS compatibility
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|DATABASE_URL=.*|DATABASE_URL=\"$DATABASE_URL\"|" .env
    else
        sed -i "s|DATABASE_URL=.*|DATABASE_URL=\"$DATABASE_URL\"|" .env
    fi
    echo "✅ .env updated with database credentials"
else
    echo "❌ .env file not found"
    exit 1
fi

echo ""
echo "🗄️  Setting up database schema..."

# Wait for PostgreSQL to be fully ready
until docker exec s3-portal-postgres pg_isready -U s3portal > /dev/null 2>&1; do
    echo "⏳ Waiting for database..."
    sleep 1
done

echo "✅ Database is ready"
echo ""

# Run migrations
echo "📦 Running Prisma migrations..."
npx prisma db push --skip-generate

echo ""
echo "✅ Database setup complete!"
echo ""
echo "Next steps:"
echo "  1. npm run dev          (start development server)"
echo "  2. Visit http://localhost:3000"
echo "  3. Create an account"
echo ""
echo "To stop PostgreSQL:"
echo "  docker stop s3-portal-postgres"
echo ""
echo "To start it again:"
echo "  docker start s3-portal-postgres"
echo ""
echo "To remove everything:"
echo "  docker stop s3-portal-postgres"
echo "  docker rm s3-portal-postgres"
echo "  docker volume rm s3portal_postgres_data"
echo ""
