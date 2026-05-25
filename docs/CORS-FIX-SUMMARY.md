# CORS Configuration - Solution to Upload Errors

## Problem You're Experiencing

You're seeing the error **"Failed to upload Screenshot 2026-02-11 at 11.00.15 AM.png: Failed to fetch"**

This is happening because your S3 bucket `s3portal2` doesn't have CORS (Cross-Origin Resource Sharing) configured.

## Why This Happens

The S3 Portal uploads files **directly from your browser to S3** using presigned URLs (not through the server). Browsers block these direct uploads unless the S3 bucket explicitly allows cross-origin requests via CORS configuration.

Looking at your screenshots, the CORS section shows **"No configurations to display"** - this is the root cause.

## Quick Fix (5 minutes)

### Step 1: Open Your Bucket in AWS Console
1. Go to https://s3.console.aws.amazon.com/
2. Click on your bucket: `s3portal2`

### Step 2: Configure CORS
1. Click the **Permissions** tab
2. Scroll down to **Cross-origin resource sharing (CORS)**
3. Click **Edit**
4. Paste this configuration:

```json
[
  {
    "AllowedHeaders": [
      "*"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "POST",
      "DELETE",
      "HEAD"
    ],
    "AllowedOrigins": [
      "http://localhost:3000"
    ],
    "ExposeHeaders": [
      "ETag",
      "x-amz-server-side-encryption",
      "x-amz-request-id"
    ],
    "MaxAgeSeconds": 3000
  }
]
```

5. Click **Save changes**

### Step 3: Test Upload Again
1. Wait about 30 seconds for changes to take effect
2. Go back to your S3 Portal at http://localhost:3000/dashboard/files
3. Try uploading a file again
4. It should work now! ✅

## What Changed in Your App

I've made the following improvements to help you avoid this issue:

### 1. Better Error Messages
When CORS is not configured, you'll now see:
```
CORS configuration error - check S3 bucket CORS settings
```

Instead of just "Failed to fetch"

### 2. Helpful Info Banner
When you have no files in your bucket, you'll see a blue info box explaining:
- CORS needs to be configured before uploading
- Link to detailed setup guide

### 3. Complete Documentation
Created **docs/S3-CORS-SETUP.md** with:
- Step-by-step instructions
- Production configuration
- CloudFront CORS setup
- Troubleshooting guide
- Security best practices

### 4. Updated README
Added CORS setup as Step 3 in the Quick Start guide

## For Production

When you deploy to production, update the AllowedOrigins:

```json
"AllowedOrigins": [
  "http://localhost:3000",
  "https://yourdomain.com",
  "https://www.yourdomain.com"
]
```

Replace `yourdomain.com` with your actual domain.

## Common Questions

### Q: Is it safe to use "*" for AllowedHeaders?
A: For trusted applications like this, yes. It allows all headers needed by presigned URLs.

### Q: Can I use "*" for AllowedOrigins?
A: **Not recommended for production.** Always specify exact domains.

### Q: What if I'm using CloudFront?
A: CloudFront needs separate CORS configuration. See docs/S3-CORS-SETUP.md section "CloudFront CORS Configuration".

### Q: Will this make my bucket public?
A: No! CORS only allows browsers to make requests. Your files remain private and secured by IAM permissions and presigned URLs.

## Files Updated

- ✅ `components/ui/dialog.tsx` - Made modals scrollable
- ✅ `app/dashboard/files/page.tsx` - Better CORS error detection and messages
- ✅ `docs/S3-CORS-SETUP.md` - Complete CORS setup guide (NEW)
- ✅ `README.md` - Added CORS setup instructions

## Need More Help?

1. **Check the detailed guide**: `docs/S3-CORS-SETUP.md`
2. **Verify your CORS config**: Use browser DevTools → Network tab to see the actual error
3. **Common issues**: Make sure the origin matches exactly (http vs https, with/without port)

## Test Commands

After configuring CORS, test with curl:

```bash
curl -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: PUT" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://s3portal2.s3.ap-south-1.amazonaws.com/
```

You should see:
```
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Methods: GET, PUT, POST, DELETE, HEAD
```

---

**TL;DR**: Add the CORS configuration above to your S3 bucket's Permissions → CORS section, and file uploads will work immediately. 🚀
