#!/bin/bash

# S3 Portal - Quick Setup Script

set -e

echo "🚀 S3 Portal Setup"
echo "=================="
echo ""

# Check if .env exists
if [ -f .env ]; then
    echo "⚠️  .env file already exists. Remove it to regenerate."
else
    echo "📝 Creating .env file..."
    cp .env.example .env
    
    # Generate random secrets
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    ENCRYPTION_KEY=$(openssl rand -base64 32 | cut -c1-32)
    
    # Update .env with generated secrets
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|NEXTAUTH_SECRET=\".*\"|NEXTAUTH_SECRET=\"$NEXTAUTH_SECRET\"|" .env
        sed -i '' "s|ENCRYPTION_KEY=\".*\"|ENCRYPTION_KEY=\"$ENCRYPTION_KEY\"|" .env
    else
        sed -i "s|NEXTAUTH_SECRET=\".*\"|NEXTAUTH_SECRET=\"$NEXTAUTH_SECRET\"|" .env
        sed -i "s|ENCRYPTION_KEY=\".*\"|ENCRYPTION_KEY=\"$ENCRYPTION_KEY\"|" .env
    fi
    
    echo "✅ .env file created with secure random secrets"
fi

echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "🗄️  Setting up database..."
npm run db:push

echo ""
echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Review .env and update DATABASE_URL if needed"
echo "2. Run 'npm run dev' to start development server"
echo "3. Visit http://localhost:3000"
echo ""
echo "For production deployment:"
echo "- Docker: docker-compose up -d"
echo "- Railway: railway up"
echo "- Vercel: vercel --prod"
echo ""
