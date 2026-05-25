# File Preview System — Copilot Execution Plan

## Context
This is a self-hosted S3 portal built with Next.js, TypeScript, Prisma, PostgreSQL. Files are stored in private S3 buckets. Users should never see raw S3 credentials. All file access must go through presigned URLs generated server-side.

---

## Step 1 — Presigned URL API Endpoint
Create a Next.js API route `GET /api/files/[fileId]/preview-url` that:
- Authenticates the user and checks they have `FILES_LIST` screen permission
- Fetches the file record from DB including its credential and bucket
- Decrypts the AWS credentials using the existing encryption utility
- Generates a presigned S3 GET URL with 15 minute expiry using AWS SDK
- Returns the presigned URL and the file's contentType
- Never returns raw AWS credentials to the frontend

---

## Step 2 — Preview Modal Component
Create a `FilePreviewModal` React component that:
- Accepts `fileId`, `fileName`, `contentType`, `fileSize` as props
- On open, calls the `/api/files/[fileId]/preview-url` endpoint to get the presigned URL
- Shows a loading spinner while fetching
- Renders the correct preview based on contentType:
  - `image/*` → `<img>` tag
  - `application/pdf` → `<iframe>`
  - `video/*` → `<video>` with controls
  - `audio/*` → `<audio>` with controls
  - `text/*`, `application/json`, `application/xml` → fetch text content and render in a syntax highlighted code block using `highlight.js` or `prism`
  - `text/csv` → fetch and render as a simple table
  - Everything else → show a message "Preview not available" with a download button
- Has a fullscreen toggle button
- Shows file name and size in the modal header

---

## Step 3 — File Type Utility
Create a utility function `getPreviewType(contentType: string, fileName: string): PreviewType` that returns one of:

```
IMAGE | PDF | VIDEO | AUDIO | TEXT | CSV | UNSUPPORTED
```

Use both contentType and file extension as fallback since S3 contentType is sometimes missing or wrong.

---

## Step 4 — Wire Preview into File List
In the existing file list/table component:
- Add a preview icon button next to each file row
- Only show the preview button if `getPreviewType()` does not return `UNSUPPORTED`
- On click, open the `FilePreviewModal`
- Respect the existing `allowPreview` flag — if false, hide the preview button

---

## Step 5 — Security Checks
- Presigned URL endpoint must verify the file belongs to the user's team
- Log the preview action in `AccessLog` with:
  - `action: "FILE_PREVIEW"`
  - `resourceType: "file"`
  - `resourceId: fileId`
- Presigned URLs must have maximum 15 minute expiry, never longer
- Add rate limiting on the presigned URL endpoint to prevent abuse

---

## Step 6 — Edge Cases to Handle
- File is deleted from S3 but still in DB → catch the AWS error and return a clear message
- File is too large for text preview (over 1MB) → skip text fetch and show "File too large to preview"
- ContentType is missing → fall back to file extension detection
- Presigned URL expires while user has modal open → add a refresh button

---

## Acceptance Criteria
- Images, PDFs, videos, audio files preview without downloading
- Text and CSV files render inline
- Unsupported files show a clear fallback with download option
- No AWS credentials ever reach the browser
- Every preview action is logged in AccessLog
- Works with any S3-compatible provider (R2, MinIO, Backblaze) not just AWS
