# S3 Portal - Test Cases

## Authentication & User Management

### Registration
- [ ] **TC-AUTH-001**: Register new user with valid email and password
- [ ] **TC-AUTH-002**: Register with password < 8 characters → Error shown
- [ ] **TC-AUTH-003**: Register with existing email → Error shown
- [ ] **TC-AUTH-004**: Register with invalid email format → Error shown
- [ ] **TC-AUTH-005**: Register, then verify user appears in database

### Login
- [ ] **TC-AUTH-006**: Login with valid credentials → Redirects to dashboard
- [ ] **TC-AUTH-007**: Login with invalid password → Error shown
- [ ] **TC-AUTH-008**: Login with non-existent email → Error shown
- [ ] **TC-AUTH-009**: Login, refresh page → User stays logged in
- [ ] **TC-AUTH-010**: Access protected route without login → Redirects to login

### Logout
- [ ] **TC-AUTH-011**: Click sign out → Redirects to login
- [ ] **TC-AUTH-012**: After logout, access dashboard → Redirects to login
- [ ] **TC-AUTH-013**: After logout, browser back button → Cannot access protected pages

---

## AWS Credentials Management

### Add Credentials
- [ ] **TC-CRED-001**: Add valid AWS credentials (access key, secret, bucket, region) → Success
- [ ] **TC-CRED-002**: Add credentials with invalid access key → Validation error
- [ ] **TC-CRED-003**: Add credentials with wrong region → Error on validation/usage
- [ ] **TC-CRED-004**: Add credentials with non-existent bucket → Error shown
- [ ] **TC-CRED-005**: Add credentials, verify encrypted in database (no plaintext)
- [ ] **TC-CRED-006**: Add multiple credentials for same user → All stored separately
- [ ] **TC-CRED-007**: Add credential with CloudFront distribution ID → Saved successfully
- [ ] **TC-CRED-008**: Add credential with custom name → Name displayed in UI

### Edit Credentials
- [ ] **TC-CRED-009**: Edit credential name → Updated successfully
- [ ] **TC-CRED-010**: Edit bucket name → Updated and validated
- [ ] **TC-CRED-011**: Edit region → Updated successfully
- [ ] **TC-CRED-012**: Update secret access key → Re-encrypted in database

### Delete Credentials
- [ ] **TC-CRED-013**: Delete credential → Removed from list
- [ ] **TC-CRED-014**: Delete credential with existing files → Confirm deletion behavior
- [ ] **TC-CRED-015**: Delete credential with active share links → Links become invalid

### Validation
- [ ] **TC-CRED-016**: Test AWS connection button → Shows success/failure
- [ ] **TC-CRED-017**: Invalid credentials → Clear error message shown
- [ ] **TC-CRED-018**: Insufficient permissions → Error indicates missing permissions

---

## File Upload (Small Files <50MB)

### Simple Upload
- [ ] **TC-UP-001**: Upload 1MB file via drag & drop → Success, file appears in list
- [ ] **TC-UP-002**: Upload 10MB file via file picker → Success
- [ ] **TC-UP-003**: Upload 25MB file → Uses simple PUT, completes quickly
- [ ] **TC-UP-004**: Upload file with special characters in name → Success
- [ ] **TC-UP-005**: Upload file with spaces in name → Success
- [ ] **TC-UP-006**: Upload duplicate filename → Both files exist (or overwrite behavior)
- [ ] **TC-UP-007**: Upload multiple small files (5 files) → All upload sequentially
- [ ] **TC-UP-008**: Upload 0-byte file → Success or error with clear message
- [ ] **TC-UP-009**: Upload without selecting credential → Error shown
- [ ] **TC-UP-010**: Upload various file types (PDF, DOCX, JPG, ZIP) → All succeed

### Progress & UI
- [ ] **TC-UP-011**: Upload file, watch progress bar → Shows 0-100%
- [ ] **TC-UP-012**: Upload completes → Success indicator (✓) shown
- [ ] **TC-UP-013**: Upload fails → Error indicator (⚠) shown with message
- [ ] **TC-UP-014**: Click "Clear completed" → Removes successful uploads from UI

---

## File Upload (Large Files ≥50MB - Multipart)

### Multipart Upload
- [ ] **TC-MP-001**: Upload 60MB file → Switches to multipart (6 parts)
- [ ] **TC-MP-002**: Upload 100MB file → Multipart with 10 parts
- [ ] **TC-MP-003**: Upload 500MB file → Multipart with 50 parts
- [ ] **TC-MP-004**: Upload 1GB+ file → Completes successfully
- [ ] **TC-MP-005**: Monitor progress bar → Smooth 0→50% (presign) → 90% (upload) → 100%
- [ ] **TC-MP-006**: Check S3 bucket → File size matches uploaded file
- [ ] **TC-MP-007**: Check database → File record has correct size and metadata

### Parallel Processing
- [ ] **TC-MP-008**: Upload 200MB file, monitor network → Up to 3 concurrent part uploads
- [ ] **TC-MP-009**: Verify parts upload in parallel (not sequential)
- [ ] **TC-MP-010**: Memory usage during upload → Stays stable (not loading full file)

### Cancel Upload
- [ ] **TC-MP-011**: Upload 200MB+ file, click X after 5 seconds → Upload stops
- [ ] **TC-MP-012**: After cancel, verify error message → Shows "Cancelled"
- [ ] **TC-MP-013**: After cancel, check S3 → No orphaned multipart upload
- [ ] **TC-MP-014**: After cancel, check database → No duplicate/incomplete records

### Retry Upload
- [ ] **TC-MP-015**: Simulate upload failure (slow network, disconnect)
- [ ] **TC-MP-016**: Click retry button → Progress bar restarts
- [ ] **TC-MP-017**: Retry completes successfully → File uploaded
- [ ] **TC-MP-018**: Retry multiple times → Each retry works independently

### Error Handling
- [ ] **TC-MP-019**: Upload fails during init → Clear error message shown
- [ ] **TC-MP-020**: Upload fails during presign → Error shown, cleanup occurs
- [ ] **TC-MP-021**: Upload fails during part upload → Error shown
- [ ] **TC-MP-022**: Upload fails during complete → Error shown
- [ ] **TC-MP-023**: Network disconnects mid-upload → Error shown, can retry

---

## File Management

### File Listing
- [ ] **TC-FILE-001**: Navigate to Files page → Lists uploaded files
- [ ] **TC-FILE-002**: Files show name, size, upload date → All metadata correct
- [ ] **TC-FILE-003**: Empty folder → Shows "No files yet" placeholder
- [ ] **TC-FILE-004**: Switch credentials → File list updates for selected credential
- [ ] **TC-FILE-005**: Large file list (100+ files) → Pagination/scrolling works

### File Download
- [ ] **TC-FILE-006**: Click download on file → File downloads correctly
- [ ] **TC-FILE-007**: Download large file (500MB+) → Completes successfully
- [ ] **TC-FILE-008**: Downloaded file integrity → Matches uploaded file (checksum)
- [ ] **TC-FILE-009**: Download without permission → Error shown

### File Delete
- [ ] **TC-FILE-010**: Delete file → Confirmation prompt shown
- [ ] **TC-FILE-011**: Confirm delete → File removed from list and S3
- [ ] **TC-FILE-012**: Cancel delete → File remains
- [ ] **TC-FILE-013**: Delete file with active share links → Links become invalid
- [ ] **TC-FILE-014**: Delete multiple files → All removed successfully

### Folder Management
- [ ] **TC-FILE-015**: Create new folder → Folder appears in list
- [ ] **TC-FILE-016**: Navigate into folder → Shows folder contents
- [ ] **TC-FILE-017**: Upload file into folder → File appears in correct path
- [ ] **TC-FILE-018**: Breadcrumb navigation → Click to navigate up folders
- [ ] **TC-FILE-019**: Navigate to root → Returns to top level
- [ ] **TC-FILE-020**: Create nested folders (folder/subfolder) → Works correctly

### Move/Rename
- [ ] **TC-FILE-021**: Move file to different folder → File moves successfully
- [ ] **TC-FILE-022**: Rename file → Name updates in UI and S3
- [ ] **TC-FILE-023**: Move file with active share link → Link still works (or becomes invalid)

---

## File Sharing

### Create Share Link
- [ ] **TC-SHARE-001**: Click share on file → Dialog opens
- [ ] **TC-SHARE-002**: Generate link with 1 hour expiry → Link created
- [ ] **TC-SHARE-003**: Generate link with 1 day expiry → Link valid for 24 hours
- [ ] **TC-SHARE-004**: Generate link with 1 week expiry → Link valid for 7 days
- [ ] **TC-SHARE-005**: Generate link with custom date/time → Link expires at exact time
- [ ] **TC-SHARE-006**: Link copied to clipboard → Can paste and access
- [ ] **TC-SHARE-007**: Share multiple files at once → Creates multiple links

### Password Protection
- [ ] **TC-SHARE-008**: Create link with password → Password required to access
- [ ] **TC-SHARE-009**: Access link with wrong password → Error shown
- [ ] **TC-SHARE-010**: Access link with correct password → File accessible
- [ ] **TC-SHARE-011**: Share without password → Direct access to file

### Download Limits
- [ ] **TC-SHARE-012**: Set max downloads to 5 → After 5 downloads, link expires
- [ ] **TC-SHARE-013**: Download limit reaches 0 → Link shows "Max downloads reached"
- [ ] **TC-SHARE-014**: Create link without download limit → Unlimited downloads

### Preview & Download Permissions
- [ ] **TC-SHARE-015**: Enable "Preview only" → Download button disabled
- [ ] **TC-SHARE-016**: Disable preview → Only download button shown
- [ ] **TC-SHARE-017**: Enable both → Both preview and download available
- [ ] **TC-SHARE-018**: Preview image file → Shows image in browser
- [ ] **TC-SHARE-019**: Preview PDF → Shows PDF viewer
- [ ] **TC-SHARE-020**: Preview video → Video player loads

### Link Expiry
- [ ] **TC-SHARE-021**: Access link before expiry → Works
- [ ] **TC-SHARE-022**: Access link after expiry → Shows "Link expired"
- [ ] **TC-SHARE-023**: Set custom expiry in past → Error shown
- [ ] **TC-SHARE-024**: Link expires mid-download → Download continues or fails gracefully

### Link Management
- [ ] **TC-SHARE-025**: View all active share links → Lists all shared files
- [ ] **TC-SHARE-026**: Revoke share link → Link becomes invalid immediately
- [ ] **TC-SHARE-027**: Share same file twice → Creates two independent links

---

## Settings

### Account Settings
- [ ] **TC-SET-001**: View account settings → Shows user email
- [ ] **TC-SET-002**: Update profile information → Saves successfully
- [ ] **TC-SET-003**: Change password → Old sessions invalidated

### AWS Credentials Tab
- [ ] **TC-SET-004**: Navigate to Settings → Credentials tab
- [ ] **TC-SET-005**: Click "Add AWS Credentials" from dashboard → Opens Settings on Credentials tab
- [ ] **TC-SET-006**: Switch between Account and Credentials tabs → Tab state preserved in URL
- [ ] **TC-SET-007**: Refresh page on Credentials tab → Stays on correct tab

---

## Team Features (If Implemented)

### Team Creation
- [ ] **TC-TEAM-001**: Create new team → Team created successfully
- [ ] **TC-TEAM-002**: Invite user to team → User receives invitation
- [ ] **TC-TEAM-003**: Accept team invitation → User added to team

### Team Permissions
- [ ] **TC-TEAM-004**: Owner can add/remove members → Works
- [ ] **TC-TEAM-005**: Admin can manage credentials → Works
- [ ] **TC-TEAM-006**: Viewer can only view files → Cannot upload/delete
- [ ] **TC-TEAM-007**: Non-member cannot access team resources → Forbidden

### Shared Credentials
- [ ] **TC-TEAM-008**: Share credential with team → All members see it
- [ ] **TC-TEAM-009**: Team member uploads file → All members can see/download
- [ ] **TC-TEAM-010**: Remove team member → Loses access to shared resources

---

## RBAC & Permissions

### Screen Permissions
- [ ] **TC-RBAC-001**: Admin accesses Admin Permissions page → Success
- [ ] **TC-RBAC-002**: Non-admin accesses Admin Permissions → Forbidden
- [ ] **TC-RBAC-003**: Create custom role with specific screen permissions → Role created
- [ ] **TC-RBAC-004**: Assign role to user → User permissions updated
- [ ] **TC-RBAC-005**: User with READ permission → Can view but not edit
- [ ] **TC-RBAC-006**: User with WRITE permission → Can view and edit
- [ ] **TC-RBAC-007**: User with ADMIN permission → Full access

### Custom Roles
- [ ] **TC-RBAC-008**: Create role "File Manager" → Saved successfully
- [ ] **TC-RBAC-009**: Assign Files screen READ permission → User can browse files
- [ ] **TC-RBAC-010**: Assign Files screen WRITE permission → User can upload/delete
- [ ] **TC-RBAC-011**: Revoke permission → User loses access
- [ ] **TC-RBAC-012**: Delete role → Users with that role fallback to default

---

## Edge Cases & Error Handling

### Network Issues
- [ ] **TC-EDGE-001**: Upload file with slow network → Progress updates correctly
- [ ] **TC-EDGE-002**: Network disconnects mid-upload → Error shown, can retry
- [ ] **TC-EDGE-003**: Network reconnects → Retry succeeds
- [ ] **TC-EDGE-004**: API request times out → Clear timeout error shown

### Browser Compatibility
- [ ] **TC-EDGE-005**: Test on Chrome (latest) → All features work
- [ ] **TC-EDGE-006**: Test on Firefox (latest) → All features work
- [ ] **TC-EDGE-007**: Test on Safari (latest) → All features work
- [ ] **TC-EDGE-008**: Test on Edge (latest) → All features work
- [ ] **TC-EDGE-009**: Test on mobile Safari (iOS) → Upload/download works
- [ ] **TC-EDGE-010**: Test on mobile Chrome (Android) → Upload/download works

### File Size & Type Limits
- [ ] **TC-EDGE-011**: Upload file >100MB (default limit) → Error or multipart used
- [ ] **TC-EDGE-012**: Upload 5TB file (S3 limit) → Succeeds with many parts
- [ ] **TC-EDGE-013**: Upload unsupported file type → Succeeds (all types allowed)
- [ ] **TC-EDGE-014**: Upload file with no extension → Success

### Concurrent Operations
- [ ] **TC-EDGE-015**: Upload 5 files simultaneously → All queue and complete
- [ ] **TC-EDGE-016**: Upload while deleting file → Both operations succeed
- [ ] **TC-EDGE-017**: Create share link while uploading → Both succeed
- [ ] **TC-EDGE-018**: Two users upload to same folder → Both files appear

### Session & Security
- [ ] **TC-EDGE-019**: Session expires during upload → Redirect to login with message
- [ ] **TC-EDGE-020**: Multiple tabs open → Session synced across tabs
- [ ] **TC-EDGE-021**: Access share link in incognito → Works without login
- [ ] **TC-EDGE-022**: Attempt SQL injection in file name → Sanitized/rejected
- [ ] **TC-EDGE-023**: Attempt XSS in file name → Sanitized/rejected
- [ ] **TC-EDGE-024**: Access another user's files via direct URL → Forbidden

### Data Integrity
- [ ] **TC-EDGE-025**: Upload file, verify checksum → Matches original
- [ ] **TC-EDGE-026**: Download file, verify checksum → Matches uploaded
- [ ] **TC-EDGE-027**: Move file, verify content → Unchanged after move
- [ ] **TC-EDGE-028**: Large file multipart upload → All parts combined correctly

### UI/UX
- [ ] **TC-EDGE-029**: Refresh page during upload → Upload state lost (expected)
- [ ] **TC-EDGE-030**: Close dialog during upload → Upload continues or cancels gracefully
- [ ] **TC-EDGE-031**: Resize window → UI responsive, no layout breaks
- [ ] **TC-EDGE-032**: Long filename (200+ chars) → Truncated with ellipsis
- [ ] **TC-EDGE-033**: Toast notifications don't stack infinitely → Auto-dismiss after 5 seconds

---

## Performance Testing

### Upload Performance
- [ ] **TC-PERF-001**: Upload 100MB file → Completes in <2 minutes (good network)
- [ ] **TC-PERF-002**: Upload 1GB file → Uses multipart, completes efficiently
- [ ] **TC-PERF-003**: Upload 100 small files → All complete within reasonable time
- [ ] **TC-PERF-004**: Monitor memory during 1GB upload → Stays <100MB

### Page Load
- [ ] **TC-PERF-005**: Dashboard loads in <2 seconds
- [ ] **TC-PERF-006**: Files page with 1000 files → Loads/scrolls smoothly
- [ ] **TC-PERF-007**: Share link access → Opens in <1 second

### Database
- [ ] **TC-PERF-008**: Query 10,000 files → Responds in <500ms
- [ ] **TC-PERF-009**: Create 100 share links → No N+1 queries
- [ ] **TC-PERF-010**: Delete 50 files in batch → Completes quickly

---

## Security Testing

### Authentication
- [ ] **TC-SEC-001**: Brute force login → Rate limited after 5 attempts
- [ ] **TC-SEC-002**: Password stored in DB → Hashed (scrypt), never plaintext
- [ ] **TC-SEC-003**: JWT token → Contains no sensitive data
- [ ] **TC-SEC-004**: Session expires after 24 hours → User logged out

### Credentials Encryption
- [ ] **TC-SEC-005**: AWS credentials in DB → Encrypted with AES-256-GCM
- [ ] **TC-SEC-006**: Encryption key → Never in source code, env var only
- [ ] **TC-SEC-007**: Salt → Unique per credential, stored separately
- [ ] **TC-SEC-008**: IV → Unique per credential, stored with encrypted data

### API Security
- [ ] **TC-SEC-009**: Access /api/files without auth → 401 Unauthorized
- [ ] **TC-SEC-010**: Access another user's files → 403 Forbidden
- [ ] **TC-SEC-011**: Modify JWT token → Rejected as invalid
- [ ] **TC-SEC-012**: CSRF attack → Protected by NextAuth CSRF tokens

### Share Links
- [ ] **TC-SEC-013**: Share link hash → Random, unpredictable (UUID or crypto.randomBytes)
- [ ] **TC-SEC-014**: Share link with password → Password hashed before storage
- [ ] **TC-SEC-015**: Expired link → Cannot be accessed even if guessed
- [ ] **TC-SEC-016**: Download count → Accurately enforced, cannot bypass

---

## Accessibility

### Keyboard Navigation
- [ ] **TC-A11Y-001**: Tab through sidebar → All links focusable
- [ ] **TC-A11Y-002**: Tab through file list → All actions accessible
- [ ] **TC-A11Y-003**: Press Enter on focused button → Activates
- [ ] **TC-A11Y-004**: Press Escape on dialog → Closes dialog

### Screen Reader
- [ ] **TC-A11Y-005**: Sidebar toggle → Has aria-label
- [ ] **TC-A11Y-006**: File checkboxes → Have aria-label with file name
- [ ] **TC-A11Y-007**: Upload progress → Announces progress percentage
- [ ] **TC-A11Y-008**: Error messages → Announced to screen reader

### Visual
- [ ] **TC-A11Y-009**: Focus indicators → Visible on all interactive elements
- [ ] **TC-A11Y-010**: Color contrast → Meets WCAG AA standards
- [ ] **TC-A11Y-011**: Zoom to 200% → Layout doesn't break

---

## Deployment & Production

### Environment
- [ ] **TC-DEPLOY-001**: Build production bundle → No TypeScript errors
- [ ] **TC-DEPLOY-002**: Run production build → All pages load correctly
- [ ] **TC-DEPLOY-003**: Environment variables → All required vars set
- [ ] **TC-DEPLOY-004**: Database migrations → Run successfully

### Docker
- [ ] **TC-DEPLOY-005**: Build Docker image → Succeeds without errors
- [ ] **TC-DEPLOY-006**: Run Docker container → App accessible on port 3000
- [ ] **TC-DEPLOY-007**: Database connection in Docker → Works correctly
- [ ] **TC-DEPLOY-008**: Docker compose up → All services start

### Monitoring
- [ ] **TC-DEPLOY-009**: Error logs → Captured and readable
- [ ] **TC-DEPLOY-010**: Upload failures → Logged with context
- [ ] **TC-DEPLOY-011**: API latency → Within acceptable range
- [ ] **TC-DEPLOY-012**: Database connection pool → Properly configured

---

## Test Summary Template

After testing, use this template to track results:

```
Test Date: ___________
Tester: ___________
Environment: [ ] Local [ ] Staging [ ] Production

Total Test Cases: ___
Passed: ___
Failed: ___
Blocked: ___
Not Tested: ___

Critical Issues Found:
1. 
2. 

Medium Issues Found:
1.
2.

Notes:
```

---

## Priority Test Cases (Smoke Test)

Run these first for quick validation:

1. **TC-AUTH-006**: Login with valid credentials
2. **TC-CRED-001**: Add valid AWS credentials
3. **TC-UP-001**: Upload small file
4. **TC-MP-002**: Upload 100MB file (multipart)
5. **TC-FILE-006**: Download file
6. **TC-FILE-010**: Delete file
7. **TC-SHARE-002**: Create share link
8. **TC-SHARE-010**: Access share link with password
9. **TC-MP-011**: Cancel large file upload
10. **TC-MP-016**: Retry failed upload

If these 10 pass, core functionality is working.
