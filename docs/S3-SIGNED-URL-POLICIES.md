# S3 Signed URL IAM Policies (Least Privilege)

Use these snippets for the IAM user/role that signs presigned URLs for **all S3 features in this app** (list, download, upload, multipart, move/rename, delete, and metadata). Always scope to bucket + prefix. Replace:
- `<BUCKET>` with your bucket name
- `<PREFIX>` with a folder prefix such as `uploads/team-123/`
- `<ACCOUNT>` with your AWS account ID (if using KMS)
- `<KEY-ID>` with your KMS key ID/ARN (if enforcing SSE-KMS)

## Full Feature Policy (Prefix-Scoped)
Allows everything this app needs for browsing, uploads (PUT + multipart), downloads, moves, deletes, and metadata, but only within the prefix you allow.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListWithinPrefix",
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::<BUCKET>",
      "Condition": {
        "StringLike": {"s3:prefix": ["<PREFIX>*"]}
      }
    },
    {
      "Sid": "ObjectReadWriteMoveDelete",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",          
        "s3:GetObjectAttributes", 
        "s3:HeadObject",         
        "s3:PutObject",          
        "s3:DeleteObject",       
        "s3:AbortMultipartUpload",
        "s3:CompleteMultipartUpload",
        "s3:CreateMultipartUpload",
        "s3:ListMultipartUploadParts",
        "s3:ListBucketMultipartUploads",
        "s3:CopyObject"
      ],
      "Resource": "arn:aws:s3:::<BUCKET>/<PREFIX>*"
    }
  ]
}
```

### Why each permission is needed
- `ListBucket` (with prefix condition): show folder/file listings.
- `GetObject`, `HeadObject`, `GetObjectAttributes`: downloads, metadata fetch, sharing links.
- `PutObject`: simple uploads, folder placeholder objects, and multipart parts (UploadPart is covered by PutObject permission).
- `Create/Complete/Abort/ListMultipart*`: multipart uploads for large files.
- `CopyObject`: move/rename (copy to new key, then delete old).
- `DeleteObject`: user-initiated deletes and cleanups.

### If you do **not** support large files
Remove the multipart actions: `AbortMultipartUpload`, `CompleteMultipartUpload`, `CreateMultipartUpload`, `ListMultipartUploadParts`, `ListBucketMultipartUploads`.

## Optional: Read-Only Variant
For view-only users (no uploads/deletes):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::<BUCKET>",
      "Condition": {"StringLike": {"s3:prefix": ["<PREFIX>*"]}}
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:GetObjectAttributes", "s3:HeadObject"],
      "Resource": "arn:aws:s3:::<BUCKET>/<PREFIX>*"
    }
  ]
}
```

## Optional: Server-Side Encryption (SSE-KMS)
If the bucket enforces SSE-KMS:
```json
{
  "Sid": "AllowKmsForUploads",
  "Effect": "Allow",
  "Action": ["kms:Encrypt", "kms:GenerateDataKey"],
  "Resource": "arn:aws:kms:<REGION>:<ACCOUNT>:key/<KEY-ID>"
}
```
Presign headers to include:
- `x-amz-server-side-encryption: aws:kms`
- `x-amz-server-side-encryption-aws-kms-key-id: <KEY-ARN>`

## CORS (Bucket Configuration)
Allow browser uploads and downloads from your origin:
```xml
<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>https://your-app.example.com</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>POST</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <MaxAgeSeconds>300</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>
```

## Hardening Tips
- Use short presign expirations (5–15 minutes).
- Scope every permission to the exact prefix per team/user (e.g., `uploads/team-123/`).
- Disable ACLs; use bucket-owner-enforced unless you require ACLs.
- Avoid wildcard bucket access; always include the prefix in `Resource`.
- Log/audit before issuing presigns; deny if the request exceeds size/type limits.
