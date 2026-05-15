# Large File Uploads: Multipart & Parallel Processing

## Overview

The S3 Portal now supports efficient uploads of files up to **5TB** using AWS S3's multipart upload API. Large files are automatically split into parallel parts for faster, more reliable uploads with real-time progress tracking.

## Features

### Automatic Multipart for Large Files
- **Threshold**: Files ≥ 50MB automatically use multipart upload
- **Part Size**: 10MB per part (configurable)
- **Parallel Uploads**: Up to 3 parts uploaded concurrently (configurable)
- **Progress Tracking**: Real-time per-file progress (0-100%)

### Small File Optimization
- **Threshold**: Files < 50MB use simple presigned PUT
- **Fast**: Single-request upload with minimal overhead

### Error Handling & Retry
- **Automatic Abort**: Failed uploads clean up partial multipart records
- **User Retry**: Failed uploads show retry button; users can resume
- **Clear Feedback**: Error messages indicate what went wrong

### Upload Control
- **Cancel**: Users can cancel ongoing uploads mid-stream
- **Clear Completed**: Remove successful/failed uploads from the UI after completion

## How It Works

### Multipart Upload Flow

1. **Init Phase**
   - Call `/api/files?action=multipartInit` to get `uploadId` and `key`
   - Creates DB record for tracking

2. **Presign Phase**
   - Pre-generate presigned URLs for all parts (0-50% progress)
   - Allows resuming without re-presigning if needed

3. **Upload Phase** (Parallel)
   - Split file into parts (10MB each)
   - Upload up to 3 parts concurrently
   - Track ETags for each part (50-90% progress)

4. **Complete Phase**
   - Call `/api/files?action=multipartComplete` with all ETags
   - S3 combines parts into final object
   - DB updated with file size and metadata (90-100% progress)

### Simple Upload Flow

1. Get presigned URL via `/api/files?action=upload`
2. PUT file directly to S3
3. Done

## Configuration

### File Upload Thresholds
Edit `app/dashboard/files/page.tsx`:
```typescript
const MULTIPART_THRESHOLD = 50 * 1024 * 1024  // 50MB
const PART_SIZE = 10 * 1024 * 1024             // 10MB
const MAX_CONCURRENT_PARTS = 3                 // Parallel limit
```

### Component Props
`FileUpload` component in `components/file-upload.tsx`:
- `onUpload(files, onProgress?)` - Called to upload; can pass progress callback
- `onAbort(fileIndex)` - Called when user cancels upload
- `maxFiles` - Max number of files (default: 10)
- `maxSize` - Max file size in bytes (default: 100MB)

## Progress Reporting

Progress is reported as a percentage (0-100) per file:
- **0-50%**: Presigning parts
- **50-90%**: Uploading parts in parallel
- **90-100%**: Completing multipart and updating DB

Users see real-time progress bar and percentage for each file.

## Error Recovery

### User-Triggered Retry
If upload fails:
1. Error message displays in UI
2. "Retry" button appears
3. User clicks retry → re-uploads file
4. System uses fresh presigned URLs and `uploadId`

### Automatic Cleanup
On error:
- Partial multipart uploads are removed from S3 (via abort)
- DB records are cleaned up
- No orphaned uploads

## API Endpoints

### POST /api/files

#### action: "upload" (Small files)
**Request:**
```json
{
  "action": "upload",
  "credentialId": "cred-123",
  "fileName": "document.pdf",
  "contentType": "application/pdf",
  "path": "/"
}
```
**Response:**
```json
{
  "url": "https://s3.amazonaws.com/bucket/...",
  "key": "document.pdf",
  "fileId": "file-456"
}
```

#### action: "multipartInit"
**Request:**
```json
{
  "action": "multipartInit",
  "credentialId": "cred-123",
  "fileName": "large-file.zip",
  "contentType": "application/zip",
  "path": "/"
}
```
**Response:**
```json
{
  "uploadId": "ExampleUploadId",
  "key": "large-file.zip",
  "fileId": "file-789"
}
```

#### action: "multipartPresign"
**Request:**
```json
{
  "action": "multipartPresign",
  "credentialId": "cred-123",
  "key": "large-file.zip",
  "uploadId": "ExampleUploadId",
  "partNumber": 1
}
```
**Response:**
```json
{
  "url": "https://s3.amazonaws.com/bucket/...&PartNumber=1&..."
}
```

#### action: "multipartComplete"
**Request:**
```json
{
  "action": "multipartComplete",
  "credentialId": "cred-123",
  "key": "large-file.zip",
  "uploadId": "ExampleUploadId",
  "fileId": "file-789",
  "parts": [
    {"ETag": "abc123...", "PartNumber": 1},
    {"ETag": "def456...", "PartNumber": 2}
  ]
}
```
**Response:**
```json
{
  "success": true
}
```

## Limitations & Constraints

- **Max File Size**: 5TB (AWS S3 limit)
- **Max Parts**: 10,000 (AWS S3 limit)
- **Min Part Size**: 5MB (except last part; we use 10MB)
- **Upload Expiry**: Presigned URLs valid for 1 hour (configurable in `lib/aws.ts`)

## Browser Support

Works on all modern browsers supporting:
- Fetch API
- Blob.slice()
- AbortController

## Future Enhancements

- [ ] Resumable uploads with `uploadId` persistence
- [ ] Concurrent file uploads (currently sequential)
- [ ] Per-part progress granularity
- [ ] Bandwidth throttling
- [ ] Upload queue management
- [ ] Direct browser-to-S3 transfers without server touch (for large files)
