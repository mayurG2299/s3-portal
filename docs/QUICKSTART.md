# 🚀 Quick Start Guide - S3 Portal

Get your S3 Portal running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- PostgreSQL running (or use Docker)
- AWS account with S3 bucket

## Method 1: Automated Setup (Recommended)

```bash
# Run the setup script
./setup.sh

# Start development server
npm run dev

# Visit http://localhost:3000
```

That's it! The script will:
- ✅ Generate secure random secrets
- ✅ Create `.env` file
- ✅ Install dependencies
- ✅ Initialize database

## Method 2: Manual Setup

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Generate secrets
export NEXTAUTH_SECRET=$(openssl rand -base64 32)
export ENCRYPTION_KEY=$(openssl rand -base64 32 | cut -c1-32)

# Edit .env and add your values
nano .env
```

Your `.env` should look like:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/s3portal"
NEXTAUTH_SECRET="your-generated-secret"
ENCRYPTION_KEY="your-32-character-key-here!!"
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Step 3: Setup Database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push
```

### Step 4: Start Development Server

```bash
npm run dev
```

Visit **http://localhost:3000**

## First-Time Usage

### 1. Create Your Account
- Go to http://localhost:3000
- Click "Create one" on login page
- Fill in your details
- Sign in

### 2. Add AWS Credentials
- Go to Dashboard → AWS Credentials
- Click "Add Credential"
- Enter your AWS information:

```
Name: My Production Bucket
Access Key ID: AKIA...
Secret Access Key: ...
Region: us-east-1
Bucket: my-bucket-name
```

**Your credentials are encrypted before storage!**

### UI Tip: Sidebar Toggle
- The dashboard uses a collapsible sidebar.
- Click the chevron beside the logo to collapse/expand.
- On mobile, the sidebar opens over content and closes when you select a menu item or tap the overlay.

### 3. Upload Your First File
- Go to Dashboard → Files
- Select your credential
- Click Upload or drag & drop
- File uploads **directly to S3**

### 4. Share a File
- Click share icon on any file
- Choose expiry time
- Copy the link
- Share with anyone!

## Docker Quick Start

```bash
# Start everything with Docker Compose
docker-compose up -d

# App available at http://localhost:3000
```

## AWS Setup (Quick)

### Create IAM User with S3 Access

1. AWS Console → IAM → Users → Add User
2. User name: `s3-portal-app`
3. Attach this policy:

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
        "arn:aws:s3:::YOUR-BUCKET-NAME",
        "arn:aws:s3:::YOUR-BUCKET-NAME/*"
      ]
    }
  ]
}
```

4. Save the Access Key ID and Secret

### Configure S3 CORS

In your S3 bucket settings, add CORS:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["http://localhost:3000"],
    "ExposeHeaders": ["ETag"]
  }
]
```

## Troubleshooting

### Database Connection Error

```bash
# Check if PostgreSQL is running
psql -h localhost -U postgres

# Or use SQLite for testing
# Change DATABASE_URL to: file:./dev.db
```

### Can't Upload Files

- Check S3 CORS configuration
- Verify IAM permissions
- Check browser console for errors

### Authentication Issues

- Verify NEXTAUTH_SECRET is set
- Clear browser cookies
- Check NEXTAUTH_URL matches your domain

## Next Steps

✅ Read [README.md](README.md) for full documentation
✅ See [DEPLOYMENT.md](DEPLOYMENT.md) for production setup
✅ Join our community for support

## Need Help?

- 📖 Check the [full documentation](README.md)
- 🐛 [Open an issue](https://github.com/yourusername/s3-portal/issues)
- 💬 Ask questions in discussions

---

**Enjoy your self-hosted S3 portal! 🎉**
