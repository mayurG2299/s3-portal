# API Tests: Files Flows

## `/api/files` POST action matrix

### API-FILE-001 action=upload success
- Priority: Critical
- Preconditions: Authenticated actor, writable bucket, quota available
- Data Pack: `PACK-CREDS`, `PACK-BUCKETS`, `PACK-QUOTA`
- Expected:
1. `200` with presigned URL and fileId.
2. File row created/upserted.
3. Quota checks executed.
- AccessLog Assertions: `FILE_UPLOAD_INIT` success.

### API-FILE-002 action=upload quota exceeded
- Priority: Critical
- Preconditions: quota boundary exceeded
- Expected: `403` storage quota exceeded.
- DB Assertions: no usage increment on rejection.
- AccessLog Assertions: failure logged.

### API-FILE-003 action=multipartInit and multipartPresign and multipartComplete
- Priority: Critical
- Preconditions: large file fixture and valid bucket
- Data Pack: `PACK-FILES`
- Expected:
1. `multipartInit` returns upload id and key.
2. `multipartPresign` returns URL per part.
3. `multipartComplete` finalizes upload and updates metadata.
- DB Assertions: file size/content type updated.
- AccessLog Assertions: init/presign/complete actions logged.

### API-FILE-004 action=list, favorites, recents
- Priority: Important
- Preconditions: file fixtures with tags/favorites/recent timestamps
- Expected:
1. list returns scoped files with filters.
2. favorites/recents return expected subsets.

### API-FILE-005 action=toggleFavorite and updateTags
- Priority: Important
- Preconditions: existing file row
- Expected:
1. favorite toggled.
2. tags normalized and stored.
- AccessLog Assertions: tag update logged where implemented.

### API-FILE-006 action=createFolder
- Priority: Important
- Preconditions: writable bucket
- Expected: folder representation created and returned.

### API-FILE-007 invalid action rejected
- Priority: Important
- Preconditions: auth session
- Expected: `400` invalid action.

## `/api/files` DELETE

### API-FILE-010 Delete success
- Priority: Critical
- Preconditions: owner/admin with accessible file
- Data Pack: `PACK-FILES`
- Expected:
1. object removed from S3.
2. file row removed.
3. quota decremented.
- AccessLog Assertions: `FILE_DELETE` success.

### API-FILE-011 Delete forbidden for non-authorized actor
- Priority: Critical
- Preconditions: viewer/custom view actor
- Expected: `403`.
- AccessLog Assertions: `FILE_DELETE` failure.

## `/api/files` PATCH

### API-FILE-020 Move success
- Priority: Important
- Preconditions: existing file, writable destination
- Expected: key/path updated, S3 copy+delete sequence succeeds.
- AccessLog Assertions: `FILE_MOVE` success.

### API-FILE-021 Move conflict or invalid path
- Priority: Important
- Preconditions: destination key already exists or path invalid
- Expected: error and no destructive partial state.

## `/api/files/verify` POST

### API-FILE-030 Verify reconciles size and quota
- Priority: Critical
- Preconditions: file exists in S3 with changed size
- Expected:
1. metadata fetched.
2. size delta applied.
3. quota increment/decrement follows delta.
- AccessLog Assertions: verify action success/failure.

### API-FILE-031 Verify with missing S3 object
- Priority: Critical
- Preconditions: DB row exists, S3 key missing
- Expected: `404` or mapped error.

## `/api/files/download` GET

### API-FILE-040 Download success and redirect
- Priority: Critical
- Preconditions: actor with view permission
- Expected: signed download URL redirect.
- AccessLog Assertions: download success row.

### API-FILE-041 Download rate limit enforced
- Priority: Important
- Preconditions: rapid repeated requests
- Expected: `429` after threshold.

## `/api/files/[fileId]/preview-url` GET

### API-FILE-050 Preview URL success
- Priority: Critical
- Preconditions: actor with `FILES_LIST` VIEW
- Expected: preview URL + metadata returned.
- AccessLog Assertions: preview success row.

### API-FILE-051 Preview forbidden or rate limited
- Priority: Critical
- Preconditions: non-member or burst load
- Expected: `403` or `429`.

## `/api/files/[fileId]/preview-content` GET

### API-FILE-060 Preview content for supported small files
- Priority: Important
- Preconditions: text/csv/md fixture <= size limit
- Expected: content returned with proper content-type.

### API-FILE-061 Preview content too large rejected
- Priority: Important
- Preconditions: large file fixture
- Expected: route rejects oversized preview request.
