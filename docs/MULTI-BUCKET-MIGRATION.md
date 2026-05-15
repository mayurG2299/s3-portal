# Multi-Bucket Migration - Completed ✅

## Migration Summary

Successfully migrated the S3 Portal from a **single-bucket-per-credential** model to a **multi-bucket-per-credential** architecture with per-bucket CloudFront CDN settings.

**Migration Date:** February 11, 2026  
**Database Records Migrated:**
- ✅ 1 AWS Credential → 1 AwsBucket record
- ✅ 70 File records updated with bucketId references
- ✅ Zero data loss

## What Changed

### Database Schema

#### New Model: `AwsBucket`
```prisma
model AwsBucket {
  id                            String   @id @default(cuid())
  credentialId                  String
  bucket                        String
  cloudfrontDomain              String?
  cloudfrontKeyPairId           String?
  encryptedCloudfrontPrivateKey String?
  createdAt                     DateTime @default(now())
  updatedAt                     DateTime @updatedAt
  credential                    AWSCredential @relation(...)
  files                         File[]

  @@unique([credentialId, bucket])
}
```

#### Updated `File` Model
- **Added:** `bucketId` field (required, FK to AwsBucket)
- **Changed:** Unique constraint from `[credentialId, key]` to `[bucketId, key]`
- **Kept:** `credentialId` for backward compatibility and queries

#### Updated `AWSCredential` Model
- **Removed fields:**
  - `bucket` (moved to AwsBucket)
  - `cloudfrontDomain` (moved to AwsBucket)
  - `cloudfrontKeyPairId` (moved to AwsBucket)
  - `encryptedCloudfrontPrivateKey` (moved to AwsBucket)
- **Added:** `buckets` relation (1-to-many)

#### New Model: `TeamInvite`
Added as part of the same migration for team invitation functionality.

### Migration Process

The migration was carefully designed to handle existing data:

1. **Create AwsBucket table** with indexes and foreign keys
2. **Migrate bucket data** from AWSCredential records to AwsBucket
3. **Add bucketId column** to File table (nullable initially)
4. **Backfill bucketId** by matching files to buckets via credentialId
5. **Make bucketId required** after backfill completes
6. **Add unique constraint** on [bucketId, key]
7. **Drop old columns** from AWSCredential

Migration SQL: [prisma/migrations/20260211105707_add_aws_buckets/migration.sql](../prisma/migrations/20260211105707_add_aws_buckets/migration.sql)

## API Changes

### Credentials API (`/api/credentials`)

**Before:**
```typescript
POST /api/credentials
{
  "name": "My S3",
  "accessKey": "...",
  "secretKey": "...",
  "region": "us-east-1",
  "bucket": "my-bucket",
  "cloudfrontDomain": "d123.cloudfront.net"
}
```

**After:**
```typescript
POST /api/credentials
{
  "name": "My S3",
  "accessKey": "...",
  "secretKey": "...",
  "region": "us-east-1",
  "buckets": [
    {
      "bucket": "my-bucket-1",
      "cloudfrontDomain": "d123.cloudfront.net",
      "cloudfrontKeyPairId": "...",
      "cloudfrontPrivateKey": "..."
    },
    {
      "bucket": "my-bucket-2"
    }
  ]
}
```

**Response includes buckets array:**
```typescript
{
  "credentials": [
    {
      "id": "...",
      "name": "My S3",
      "region": "us-east-1",
      "buckets": [
        {
          "id": "bucket_123",
          "bucket": "my-bucket-1",
          "cloudfrontDomain": "d123.cloudfront.net",
          "cloudfrontKeyPairId": "..."
        },
        {
          "id": "bucket_456",
          "bucket": "my-bucket-2"
        }
      ]
    }
  ]
}
```

### Files API (`/api/files`)

**Changed:** All file operations now require `bucketId` instead of `credentialId`

**Before:**
```typescript
POST /api/files
{
  "action": "upload",
  "credentialId": "cred_123",
  "key": "file.jpg",
  ...
}
```

**After:**
```typescript
POST /api/files
{
  "action": "upload",
  "bucketId": "bucket_123",  // ← Changed
  "key": "file.jpg",
  ...
}
```

Affected actions:
- `upload` - Single file upload
- `multipartInit` - Start multipart upload
- `multipartPresign` - Get presigned URLs for parts
- `multipartComplete` - Complete multipart upload
- `list` - List files in bucket
- `createFolder` - Create folder
- All use `bucketId` instead of `credentialId`

**Updated operations:**
- `DELETE /api/files?fileId=...` - Includes bucket validation
- `PATCH /api/files` (move) - Includes bucket validation
- `PATCH /api/files` (tags/description) - Includes bucket validation

### Links API (`/api/links`)

- No schema changes (still uses `fileId`)
- **Auto-detects CloudFront:** Links automatically use CloudFront if the file's bucket has CDN configured
- CloudFront link generation uses bucket's CloudFront settings

### Helper Functions

#### New: `getAccessibleBucket(bucketId, userId, requireAdmin?)`
Replaces credential permission checks with bucket permission checks:
```typescript
const bucket = await getAccessibleBucket(
  validated.bucketId,
  session.user.id,
  true  // requireAdmin for uploads
)
if (!bucket) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

const config = decryptAWSConfig(bucket.credential, bucket)
```

Returns:
```typescript
{
  id: string
  bucket: string
  cloudfrontDomain?: string
  cloudfrontKeyPairId?: string
  encryptedCloudfrontPrivateKey?: string
  credentialId: string
  credential: {
    id: string
    name: string
    encryptedAccessKey: string
    encryptedSecretKey: string
    region: string
    userId: string
    teamId?: string
  }
}
```

#### Updated: `decryptAWSConfig(credential, bucket)`
Now accepts bucket as separate parameter for bucket-specific config:
```typescript
export function decryptAWSConfig(
  credential: {
    encryptedAccessKey: string
    encryptedSecretKey: string
    region: string
  },
  bucket: {
    bucket: string
    cloudfrontDomain?: string | null
    cloudfrontKeyPairId?: string | null
    encryptedCloudfrontPrivateKey?: string | null
  }
): AWSConfig
```

#### New: `validateBucketAccess(config)`
Validates S3 bucket access using HeadBucketCommand.

## UI Changes

### Settings Page (`/dashboard/settings`)

**Multi-Bucket Management:**
- Dynamic bucket list with add/remove buttons
- Per-bucket CloudFront configuration
- Validation of each bucket during save
- Shows all buckets for a credential with ability to edit/remove

**Before:** Single bucket field + CloudFront fields
**After:** Array of buckets, each with its own CloudFront settings

### Files Page (`/dashboard/files`)

**Bucket Selector:**
- New dropdown to select which bucket to browse
- Automatically syncs with selected credential
- Only shows buckets from the selected credential
- All file operations (upload, create folder, etc.) use selected bucket

**State Management:**
```typescript
const [selectedBucket, setSelectedBucket] = useState<string | null>(null)

// Auto-sync to credential's first bucket
useEffect(() => {
  if (credentials.length > 0 && selectedCredential) {
    const cred = credentials.find(c => c.id === selectedCredential)
    if (cred?.buckets?.[0]) {
      setSelectedBucket(cred.buckets[0].id)
    }
  }
}, [selectedCredential, credentials])
```

### Credentials List (`/dashboard/credentials`)

**Enhanced Display:**
- Shows bucket count: "bucket-name (+2)" if multiple buckets
- Shows CDN count: "CDN: 3" for buckets with CloudFront
- Lists all buckets on expand

### Dashboard (`/dashboard`)

**Updated Stats:**
- Changed "AWS Credentials" to "AWS Buckets"
- Count shows total buckets across all credentials
- Recent files show both credential name and bucket name

## Backward Compatibility

### Database Level
- `File.credentialId` still exists and is populated
- Old queries using `credentialId` still work
- Allows gradual migration of related features

### API Level
- Breaking change: File operations require `bucketId` instead of `credentialId`
- Frontend updated to use new API contract
- All tests passing (75/75)

## Verification

### Database State
```bash
npx tsx scripts/verify-migration.ts
```

Output:
```
✅ AwsBucket records: 1
✅ Total files: 70

📦 Sample bucket:
   Bucket: race-registration-production-media
   Credential: Race Bucket
   Files: 70
   CloudFront: Not configured

🔑 Credentials: 1
   Race Bucket: 1 bucket(s)
      - race-registration-production-media

✅ Migration verification complete!
```

### Build Status
```bash
npm run build
```
✅ Compiled successfully

### Test Status
```bash
npm test
```
✅ Test Suites: 4 passed, 4 total
✅ Tests: 75 passed, 75 total

## Next Steps

### For Development
1. ✅ Migration complete
2. ✅ All APIs updated
3. ✅ UI updated
4. ✅ Tests passing
5. ✅ Build successful

### For Production Deployment
1. **Review migration SQL** to ensure it matches your production schema
2. **Backup database** before running migration
3. **Test in staging** environment first
4. **Run migration:** `npx prisma migrate deploy`
5. **Verify data** using the verification script
6. **Deploy application** with new code
7. **Monitor logs** for any bucket-related errors

### Future Enhancements
- [ ] Bulk file move between buckets
- [ ] Bucket-level permissions/access control
- [ ] Per-bucket storage analytics
- [ ] Bucket sync/replication features
- [ ] Advanced CDN invalidation controls

## Files Modified

### Schema & Database
- `prisma/schema.prisma` - Added AwsBucket model, updated File model
- `prisma/migrations/20260211105707_add_aws_buckets/migration.sql` - Migration with data backfill
- `scripts/verify-migration.ts` - Verification script (new)

### Backend
- `lib/aws.ts` - Updated decryptAWSConfig, added validateBucketAccess
- `app/api/credentials/route.ts` - Multi-bucket CRUD operations
- `app/api/files/route.ts` - All actions use bucketId, added getAccessibleBucket
- `app/api/links/route.ts` - Uses bucket config for CloudFront detection
- `app/api/share/[hash]/route.ts` - Uses bucket config for downloads

### Frontend
- `app/dashboard/settings/page.tsx` - Multi-bucket credential form
- `app/dashboard/files/page.tsx` - Bucket selector and state management
- `app/dashboard/credentials/page.tsx` - Bucket count display
- `app/dashboard/page.tsx` - Updated stats and recent files query

### Configuration
- `tsconfig.json` - Added Jest types

## Migration Command Reference

```bash
# Create migration (already done)
npx prisma migrate dev --create-only --name add_aws_buckets

# Apply migration (already done)
npx prisma migrate dev

# Verify migration
npx tsx scripts/verify-migration.ts

# Generate Prisma Client (auto-done after migrate)
npx prisma generate

# View data in Prisma Studio
npx prisma studio
```

## Rollback Plan (If Needed)

If issues are discovered:

1. **Database rollback:**
   - Restore from backup
   - Or manually drop `AwsBucket` table and revert `File` changes

2. **Code rollback:**
   - Revert to commit before this migration
   - Run `npx prisma generate` to regenerate old client

3. **Identify issue:**
   - Check migration logs
   - Verify bucket validation works
   - Test file operations

⚠️ **Important:** Don't rollback after users have created new multi-bucket credentials, as that data cannot be represented in the old schema.

---

**Status:** ✅ **COMPLETE AND VERIFIED**

All 70 existing files successfully migrated to bucket-based structure.  
All tests passing. Build successful. Ready for production deployment.
