# S3 Bucket CORS Configuration Guide

## Problem

When uploading files, you may see errors like:
- "Failed to fetch"
- "CORS policy: No 'Access-Control-Allow-Origin' header"
- Network errors in browser console

This happens because your S3 bucket doesn't have CORS (Cross-Origin Resource Sharing) configured.

## Why CORS is Required

The S3 Portal uploads files **directly from your browser to S3** using presigned URLs. This is more efficient than routing files through the server. However, browsers block cross-origin requests unless the destination (S3 bucket) explicitly allows them via CORS configuration.

## How to Configure CORS

### Option 1: AWS Console (Recommended)

1. **Open AWS S3 Console**
   - Navigate to https://s3.console.aws.amazon.com/

2. **Select Your Bucket**
   - Click on the bucket you configured in S3 Portal

3. **Go to Permissions Tab**
   - Click on the "Permissions" tab

4. **Scroll to CORS Configuration**
   - Scroll down to "Cross-origin resource sharing (CORS)"
   - Click "Edit"

5. **Paste This Configuration**

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
      "http://localhost:3000",
      "http://localhost:3001",
      "https://yourdomain.com"
    ],
    "ExposeHeaders": [
      "ETag",
      "x-amz-server-side-encryption",
      "x-amz-request-id",
      "x-amz-id-2"
    ],
    "MaxAgeSeconds": 3000
  }
]
```

6. **Important: Update AllowedOrigins**
   - Replace `https://yourdomain.com` with your actual domain
   - For local development, keep `http://localhost:3000`
   - **NEVER use `"*"` in production** - specify exact domains

7. **Save Changes**
   - Click "Save changes"

### Option 2: AWS CLI

```bash
# Create a file named cors.json with the configuration above
# Then run:
aws s3api put-bucket-cors \
  --bucket YOUR_BUCKET_NAME \
  --cors-configuration file://cors.json
```

### Option 3: Terraform/IaC

```hcl
resource "aws_s3_bucket_cors_configuration" "example" {
  bucket = aws_s3_bucket.example.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = ["http://localhost:3000", "https://yourdomain.com"]
    expose_headers  = ["ETag", "x-amz-server-side-encryption"]
    max_age_seconds = 3000
  }
}
```

## CORS Configuration Explained

- **AllowedHeaders**: `["*"]` allows all headers (including custom ones used by presigned URLs)
- **AllowedMethods**: 
  - `GET` - Download files and list objects
  - `PUT` - Upload files (single upload)
  - `POST` - Complete multipart uploads
  - `DELETE` - Delete files
  - `HEAD` - Check if file exists
- **AllowedOrigins**: Your app's URLs that can access the bucket
- **ExposeHeaders**: Headers the browser can read from S3 responses
- **MaxAgeSeconds**: How long browsers can cache the CORS preflight response

## Production Configuration

For production, use a more restrictive CORS configuration:

```json
[
  {
    "AllowedHeaders": [
      "Authorization",
      "Content-Type",
      "Content-MD5",
      "x-amz-*"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "POST",
      "HEAD"
    ],
    "AllowedOrigins": [
      "https://yourdomain.com",
      "https://www.yourdomain.com"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

## Verifying CORS Configuration

After configuring CORS:

1. **Wait 1-2 minutes** for changes to propagate
2. **Clear browser cache** or use an incognito window
3. **Try uploading a file** in S3 Portal
4. **Check browser console** - CORS errors should be gone

### Testing with curl

```bash
curl -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: PUT" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://YOUR_BUCKET.s3.REGION.amazonaws.com/
```

You should see response headers like:
```
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Methods: GET, PUT, POST, DELETE, HEAD
```

## Common Issues

### Issue: Still getting CORS errors after configuration

**Solutions:**
1. Verify the AllowedOrigins exactly match your app URL (including http/https and port)
2. Clear browser cache completely
3. Check if you have a CloudFront distribution - it needs separate CORS config
4. Wait a few minutes for S3 changes to propagate

### Issue: Works locally but not in production

**Solution:**
Add your production domain to AllowedOrigins:
```json
"AllowedOrigins": [
  "http://localhost:3000",
  "https://yourdomain.com",
  "https://www.yourdomain.com"
]
```

### Issue: Multipart uploads fail

**Solution:**
Ensure `POST` method is in AllowedMethods:
```json
"AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"]
```

### Issue: "No 'Access-Control-Allow-Origin' header present"

**Solution:**
1. CORS configuration is missing or incorrect
2. The origin doesn't match exactly (check http vs https, www vs non-www)
3. S3 bucket region might be incorrect in your credentials

## CloudFront CORS Configuration

If you're using CloudFront CDN with your bucket:

1. **Go to CloudFront Distribution Settings**
2. **Edit Behavior**
3. **Under "Cache key and origin requests"**:
   - Choose "Legacy cache settings"
   - Under "Headers": Select "Include the following headers"
   - Add these headers:
     - `Origin`
     - `Access-Control-Request-Headers`
     - `Access-Control-Request-Method`
4. **Save changes**

## Security Best Practices

✅ **DO:**
- Specify exact domains in AllowedOrigins
- Use HTTPS in production
- Limit allowed methods to what you actually need
- Set reasonable MaxAgeSeconds (3000-3600)

❌ **DON'T:**
- Use `"*"` for AllowedOrigins in production
- Allow unnecessary HTTP methods
- Expose sensitive headers
- Set MaxAgeSeconds too high (> 86400)

## Quick Reference

**Minimum CORS for S3 Portal to work:**
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedOrigins": ["http://localhost:3000"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

## Need Help?

1. Check browser console for specific CORS error messages
2. Verify bucket name and region in your credentials
3. Test with AWS CLI to confirm credentials work
4. Check S3 bucket permissions (should not block all public access if using presigned URLs)

## Next Steps

After configuring CORS:
1. ✅ Configure CORS on your S3 bucket
2. ✅ Add your production domain to AllowedOrigins
3. ✅ Test file uploads
4. ✅ Configure CloudFront CORS (if using CDN)
5. ✅ Review S3 bucket permissions
