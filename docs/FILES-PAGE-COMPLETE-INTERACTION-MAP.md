# Files Page - Complete Interaction Map

**Page:** `/dashboard/files`  
**Total Interactions:** 128+ button/click handlers  
**Complexity:** HIGH (most complex page in app)

---

## 📍 Page Sections & All Interactions

### SECTION 1: Top Header Bar

#### 1.1 Bucket/Identity Selectors
| # | Element | Action | Handler | Enabled When | Notes |
|---|---------|--------|---------|--------------|-------|
| 1 | Bucket Dropdown | Opens bucket selector | - | Always | Shows all available buckets |
| 2 | Identity Dropdown | Opens credential selector | - | Always | Shows all AWS credentials |
| 3 | "All Buckets" option | Select all buckets | onChange | credentialsCount > 0 | Special option |
| 4 | Individual bucket options | Select specific bucket | onChange | Per bucket | One per credential |

#### 1.2 Primary Actions
| # | Element | Action | Handler | Enabled When | Notes |
|---|---------|--------|---------|--------------|-------|
| 5 | **Upload Button** (primary) | Opens upload dialog | `setIsUploadOpen(true)` | selectedBucketId exists | Blue/purple, prominent |
| 6 | Actions Dropdown Button | Toggles action menu | `setIsHeaderActionsOpen(prev => !prev)` | Always | Hamburger/3-dot menu |

#### 1.3 Header Actions Dropdown Menu
| # | Element | Action | Handler | Enabled When | Notes |
|---|---------|--------|---------|--------------|-------|
| 7 | Share Selected | Opens share dialog | `handleShareSelected` | selectedFileIds.length > 0 | Bulk action |
| 8 | Download Selected | Downloads selected files | `handleDownloadSelected` | selectedFileIds.length > 0 | Bulk action |
| 9 | New Folder | Opens folder dialog | `setIsFolderDialogOpen(true)` | selectedBucketId exists | Create new folder |
| 10 | Refresh | Reloads file list | `handleRefresh` | Always | Force refresh |
| 11 | Download Folder | Downloads current folder as ZIP | `handleDownloadFolder` | currentPath !== '/' | Downloads all in folder |

---

### SECTION 2: Breadcrumb Navigation

#### 2.1 Breadcrumbs
| # | Element | Action | Handler | Enabled When | Notes |
|---|---------|--------|---------|--------------|-------|
| 12-N | Each breadcrumb link | Navigate to that folder | `setCurrentPath(crumb.path)` | Always | One per path segment |

*Dynamic count: 1 for root + 1 per folder depth level*

---

### SECTION 3: Main Action Bar (Below Header)

#### 3.1 Desktop Actions (visible on md+)
| # | Element | Action | Handler | Enabled When | Notes |
|---|---------|--------|---------|--------------|-------|
| 13 | Share Selected | Opens share dialog | `handleShareSelected` | selectedFileIds.length > 0 | Desktop duplicate |
| 14 | Download Selected | Downloads selected | `handleDownloadSelected` | selectedFileIds.length > 0 | Desktop duplicate |
| 15 | New Folder | Opens folder dialog | - | selectedBucketId exists | Desktop duplicate |
| 16 | Refresh | Reloads files | `handleRefresh` | Always | Desktop duplicate |
| 17 | Download Folder | Downloads folder | `handleDownloadFolder` | currentPath !== '/' | Desktop duplicate |

---

### SECTION 4: Sidebar Filters

#### 4.1 View Mode Filters
| # | Element | Action | Handler | Enabled When | Notes |
|---|---------|--------|---------|--------------|-------|
| 18 | All Files | Show all files | `setViewMode('all')` | Always | Default view |
| 19 | Favorites | Show favorited files | `setViewMode('favorites')` | Always | Starred files only |
| 20 | Recents | Show recent files | `setViewMode('recents')` | Always | Last 50 accessed |

#### 4.2 Context Toggle
| # | Element | Action | Handler | Enabled When | Notes |
|---|---------|--------|---------|--------------|-------|
| 21 | Expand/Collapse Sidebar | Toggles sidebar | `setIsContextExpanded(prev => !prev)` | Always | Sidebar toggle |

#### 4.3 Tag Filter
| # | Element | Action | Handler | Enabled When | Notes |
|---|---------|--------|---------|--------------|-------|
| 22 | Clear Tag Filter | Clears tag filter | `setTagFilter('')` | tagFilter !== '' | "X" button |

---

### SECTION 5: Selected Files Action Bar

*Only visible when files are selected*

| # | Element | Action | Handler | Enabled When | Notes |
|---|---------|--------|---------|--------------|-------|
| 23 | Share (selection bar) | Opens share dialog | `handleShareSelected` | selectedFileIds.length > 0 | Third instance! |
| 24 | Download (selection bar) | Downloads selected | `handleDownloadSelected` | selectedFileIds.length > 0 | Third instance! |
| 25 | Clear Selection | Deselects all | `setSelectedFileIds([])` | selectedFileIds.length > 0 | Cancel selection |

---

### SECTION 6: Empty States

#### 6.1 No Credentials Empty State
| # | Element | Action | Handler | Enabled When | Notes |
|---|---------|--------|---------|--------------|-------|
| 26 | Try Again | Refetches files | `fetchFiles()` | Error state | Retry button |
| 27 | Upload Files | Opens upload | `setIsUploadOpen(true)` | No files | CTA |

#### 6.2 File Truncation Warning
| # | Element | Action | Handler | Enabled When | Notes |
|---|---------|--------|---------|--------------|-------|
| 28 | Dismiss Warning | Hides warning | `setTruncationDismissed(true)` | totalFiles > displayed | "Got it" button |

---

### SECTION 7: File List (Per File Row)

*Each file has 8+ interactive elements*

#### 7.1 Per-File Controls (Left to Right)
| # | Element | Action | Handler | Enabled When | Notes |
|---|---------|--------|---------|--------------|-------|
| 29 | Select Checkbox | Toggle file selection | `toggleSelection(file.id)` | Always | Bulk operations |
| 30 | File Icon/Name | Opens preview | Opens preview modal | isViewable | Click to view |
| 31 | Favorite Star | Toggle favorite | `handleToggleFavorite(file)` | Always | Star icon |

#### 7.2 File Actions Dropdown (per file)
| # | Element | Action | Handler | Enabled When | Notes |
|---|---------|--------|---------|--------------|-------|
| 32 | Actions Menu Button | Opens dropdown | - | Always | 3-dot menu per file |

#### 7.3 File Actions Menu Items (per file)
| # | Element | Action | Handler | Enabled When | Notes |
|---|---------|--------|---------|--------------|-------|
| 33 | Preview | Opens preview modal | `setPreviewFile(file)` | isViewable | View file |
| 34 | Download | Downloads file | Direct download | Always | Direct download |
| 35 | Share | Opens share dialog | `handleShare()` for single file | Always | Create link |
| 36 | Rename | Opens rename dialog | `setRenameFile(file)` | Always | Edit name |
| 37 | Move | Opens move dialog | `setMoveFile(file)` (if exists) | Always | Change folder |
| 38 | Copy CDN URL | Copies URL | `navigator.clipboard` | Has CDN URL | If CDN enabled |
| 39 | Edit Tags | Opens tag editor | `setEditingTagsFile(file)` | Always | Manage tags |
| 40 | Edit Description | Opens description editor | `setEditingDescFile(file)` | Always | Add description |
| 41 | Delete | Opens delete confirm | `handleDelete(file)` | Always | Remove file |
| 42 | Add to Favorites | Toggle favorite | `handleToggleFavorite(file)` | Not favorited | Star it |
| 43 | Remove from Favorites | Toggle favorite | `handleToggleFavorite(file)` | Is favorited | Unstar it |

**Subtotal per file:** 15 interactions × N files = **Dynamic (15N interactions)**

---

### SECTION 8: Folder Rows

*Folders have different interactions than files*

#### 8.1 Per-Folder Controls
| # | Element | Action | Handler | Enabled When | Notes |
|---|---------|--------|---------|--------------|-------|
| 44 | Folder Icon/Name | Navigate into folder | `setCurrentPath(folder.path)` | Always | Click to open |
| 45 | Folder Actions Menu | Opens dropdown | - | Always | 3-dot menu |

#### 8.2 Folder Actions Menu Items
| # | Element | Action | Handler | Enabled When | Notes |
|---|---------|--------|---------|--------------|-------|
| 46 | Rename Folder | Opens rename dialog | Similar to file rename | Always | Edit name |
| 47 | Delete Folder | Opens delete confirm | Similar to file delete | Folder empty | Remove folder |
| 48 | Download Folder | Downloads as ZIP | `handleDownloadFolder` | Always | ZIP download |

**Subtotal per folder:** 6 interactions × M folders = **Dynamic (6M interactions)**

---

## 🎭 MODALS & OVERLAYS (Nested Interactions)

### MODAL 1: Upload Dialog

| # | Element | Action | Handler | Notes |
|---|---------|--------|---------|-------|
| 49 | Choose Files Button | Opens file picker | `handleUpload` | Browse files |
| 50 | Drag & Drop Zone | Accepts files | `handleUpload` | Drop to upload |
| 51 | Upload Button | Starts upload | `handleUpload` | Confirm upload |
| 52 | Cancel Button | Closes dialog | `setIsUploadOpen(false)` | Cancel |
| 53 | Close (X) | Closes dialog | `setIsUploadOpen(false)` | Top-right X |
| 54 | Progress Bar | Visual feedback | - | Per file uploading |

**Upload Modal Total:** 6 interactions

---

### MODAL 2: Share Link Creation Dialog (COMPLEX)

#### Tab 1: Link Settings
| # | Element | Action | Handler | Notes |
|---|---------|--------|---------|-------|
| 55 | Link Mode: Direct | Sets link mode | `setShareSettings({linkMode: 'direct'})` | Direct link option |
| 56 | Link Mode: Preview | Sets link mode | `setShareSettings({linkMode: 'preview'})` | Preview page option |
| 57 | Expiry: Never | Sets expiry | `setShareSettings({expiry: 'never'})` | No expiration |
| 58 | Expiry: 1 hour | Sets expiry | `setShareSettings({expiry: '1hour'})` | 1h expiry |
| 59 | Expiry: 24 hours | Sets expiry | `setShareSettings({expiry: '24hours'})` | 24h expiry |
| 60 | Expiry: 7 days | Sets expiry | `setShareSettings({expiry: '7days'})` | 7d expiry |
| 61 | Expiry: 30 days | Sets expiry | `setShareSettings({expiry: '30days'})` | 30d expiry |
| 62 | Expiry: Custom | Opens custom picker | `setShareSettings({expiry: 'custom'})` | Custom date |
| 63 | Custom Date Picker | Sets custom date | `setShareSettings({customExpiry: date})` | datetime-local |
| 64 | Password Toggle | Enables password | `setShareSettings({requirePassword: !prev})` | Checkbox |
| 65 | Password Input | Sets password | `setShareSettings({password: value})` | Text input |
| 66 | Allow Download Toggle | Sets download permission | `setShareSettings({allowDownload: !prev})` | Checkbox |

#### Tab 2: CDN Settings (if CDN enabled)
| # | Element | Action | Handler | Notes |
|---|---------|--------|---------|-------|
| 67 | Enable CDN | Toggles CDN | `setShareSettings({useCdn: !prev})` | CDN checkbox |
| 68 | CDN URL Input | Sets custom URL | `handleSaveCdn` | Custom domain |
| 69 | Save CDN Button | Saves CDN settings | `handleSaveCdn` | Submit |

#### Modal Actions
| # | Element | Action | Handler | Notes |
|---|---------|--------|---------|-------|
| 70 | Create Link Button | Creates share link | `handleShare` | Primary action |
| 71 | Cancel Button | Closes dialog | `setIsShareDialogOpen(false)` | Cancel |
| 72 | Close (X) | Closes dialog | `setIsShareDialogOpen(false)` | Top-right X |

**Share Modal Total:** 18 interactions

---

### MODAL 3: File Preview Dialog

| # | Element | Action | Handler | Notes |
|---|---------|--------|---------|-------|
| 73 | Close (X) | Closes preview | `setPreviewFile(null)` | Close button |
| 74 | Download | Downloads file | Direct download | From preview |
| 75 | Share | Opens share dialog | `handleShare` | From preview |
| 76 | Previous File | Navigate preview | Arrow navigation | If multiple |
| 77 | Next File | Navigate preview | Arrow navigation | If multiple |
| 78 | Zoom In | Zoom image | Image zoom control | Images only |
| 79 | Zoom Out | Zoom image | Image zoom control | Images only |
| 80 | Full Screen | Toggle fullscreen | Browser API | If supported |

**Preview Modal Total:** 8 interactions

---

### MODAL 4: Rename Dialog

| # | Element | Action | Handler | Notes |
|---|---------|--------|---------|-------|
| 81 | Name Input | Edit name | State update | Text input |
| 82 | Save Button | Saves new name | API call + refresh | Confirm |
| 83 | Cancel Button | Closes dialog | `setRenameFile(null)` | Cancel |
| 84 | Close (X) | Closes dialog | `setRenameFile(null)` | Top-right X |

**Rename Modal Total:** 4 interactions

---

### MODAL 5: Delete Confirmation Dialog

| # | Element | Action | Handler | Notes |
|---|---------|--------|---------|-------|
| 85 | Confirm Delete | Deletes file | `handleConfirmDelete` | Destructive |
| 86 | Cancel Button | Closes dialog | `setDeleteFile(null)` | Cancel |
| 87 | Close (X) | Closes dialog | `setDeleteFile(null)` | Top-right X |

**Delete Modal Total:** 3 interactions

---

### MODAL 6: New Folder Dialog

| # | Element | Action | Handler | Notes |
|---|---------|--------|---------|-------|
| 88 | Folder Name Input | Enter name | State update | Text input |
| 89 | Create Button | Creates folder | `handleCreateFolder` | Confirm |
| 90 | Cancel Button | Closes dialog | `setIsFolderDialogOpen(false)` | Cancel |
| 91 | Close (X) | Closes dialog | `setIsFolderDialogOpen(false)` | Top-right X |

**Folder Modal Total:** 4 interactions

---

### MODAL 7: Edit Tags Dialog

| # | Element | Action | Handler | Notes |
|---|---------|--------|---------|-------|
| 92 | Tag Input | Add tag | State update | Comma-separated |
| 93 | Add Tag Button | Adds tag to list | Array push | If exists |
| 94 | Remove Tag (per tag) | Removes tag | Array filter | X per tag |
| 95 | Save Button | Saves tags | `handleSaveTags` | API call |
| 96 | Cancel Button | Closes dialog | `setEditingTagsFile(null)` | Cancel |
| 97 | Close (X) | Closes dialog | `setEditingTagsFile(null)` | Top-right X |

**Tags Modal Total:** 6 interactions

---

### MODAL 8: Edit Description Dialog

| # | Element | Action | Handler | Notes |
|---|---------|--------|---------|-------|
| 98 | Description Textarea | Edit description | State update | Multiline input |
| 99 | Save Button | Saves description | API call | Confirm |
| 100 | Cancel Button | Closes dialog | `setEditingDescFile(null)` | Cancel |
| 101 | Close (X) | Closes dialog | `setEditingDescFile(null)` | Top-right X |

**Description Modal Total:** 4 interactions

---

## 📊 INTERACTION SUMMARY

### Base Page Interactions
- Header: 11 elements
- Breadcrumbs: Variable (1 + depth)
- Main Actions: 5 elements (desktop)
- Sidebar: 4 elements
- Selection Bar: 3 elements
- Empty States: 3 elements

**Subtotal: ~27 base interactions**

### Per-Item Interactions
- Per File: 15 interactions × N files
- Per Folder: 6 interactions × M folders

**Subtotal: Variable (15N + 6M)**

### Modal Interactions
- Upload: 6
- Share: 18
- Preview: 8
- Rename: 4
- Delete: 3
- New Folder: 4
- Edit Tags: 6
- Edit Description: 4

**Modal Subtotal: 53 interactions**

---

## 🔍 PATTERN ANALYSIS

### Redundant Actions (Same Action, Multiple Locations)

1. **Share Selected** - 3 instances!
   - Header Actions Dropdown
   - Desktop Action Bar
   - Selection Action Bar
   
2. **Download Selected** - 3 instances!
   - Header Actions Dropdown
   - Desktop Action Bar
   - Selection Action Bar

3. **Refresh** - 2 instances
   - Header Actions Dropdown
   - Desktop Action Bar

4. **New Folder** - 2 instances
   - Header Actions Dropdown
   - Desktop Action Bar

5. **Download Folder** - 2 instances
   - Header Actions Dropdown
   - Desktop Action Bar

### Consolidation Opportunities

❌ **Current Issue:** Action buttons duplicated across mobile/desktop  
✅ **Recommendation:** Single action bar with responsive layout

❌ **Current Issue:** File actions menu has 11+ items  
✅ **Recommendation:** Group by category (View, Edit, Share, Organize, Delete)

❌ **Current Issue:** Share modal has 18 interactions  
✅ **Recommendation:** Use tabs or progressive disclosure

---

## 🎯 UX PROBLEMS IDENTIFIED

### High Priority
1. **Duplicate Actions** - Same buttons in 3 places (confusing, inconsistent)
2. **Complex Share Modal** - 18 interactions is overwhelming
3. **Long File Actions Menu** - 11+ items is too many
4. **Mobile/Desktop Duplication** - Different UIs for same actions

### Medium Priority
5. **Multiple Dropdown Patterns** - Inconsistent dropdown styles
6. **Modal Overload** - 8 different modals to manage
7. **State Management** - Too many useState hooks (complexity)

### Low Priority
8. **Icon Consistency** - Mix of icon libraries
9. **Button Variants** - Too many button styles
10. **Loading States** - Inconsistent loading patterns

---

**Files Page Status:** ✅ FULLY MAPPED  
**Total Interactions Documented:** 101+ base + 15N + 6M (where N=files, M=folders)

**Next:** Map remaining 18 pages with same depth...
