# Files List Query Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/api/files` list results paginate consistently when both folders and files match the current query.

**Architecture:** The list response currently paginates files but not folders, which breaks totals and can duplicate folders across pages. The fix is to compute a single ordered result set from folders plus files, paginate that combined list, and derive counts from the combined result.

**Tech Stack:** Next.js App Router, TypeScript, S3 list helpers, React file explorer UI

---

### Task 1: Confirm Combined List Pagination Bug

**Files:**
- Modify: app/api/files/route.ts
- Test: POST /api/files with action=list

- [ ] **Step 1: Read current list handler**

Locate the `action === 'list'` code path and confirm folders are prepended without pagination while files are sliced by page.

- [ ] **Step 2: Record failing behavior**

Use a query that matches folders and files. Confirm:
- response item count exceeds page size
- folders repeat on later pages
- `totalFiles` ignores folders

### Task 2: Unify Response Pagination

**Files:**
- Modify: app/api/files/route.ts

- [ ] **Step 1: Build a combined item array**

Normalize folders and files into one response list with a stable sort order.

- [ ] **Step 2: Apply pagination after combination**

Slice the combined list once using `page` and `pageSize`.

- [ ] **Step 3: Fix totals and hasMore metadata**

Base `totalFiles`, `totalPages`, and `hasMore` on the combined result count.

- [ ] **Step 4: Preserve current folder/file shapes expected by the client**

Do not break the dashboard file explorer contract.

### Task 3: Verify Search And Non-Search Cases

**Files:**
- Test: dashboard files explorer and API route

- [ ] **Step 1: Verify query search**

Run the reported payload with `query: "lotu"`.
Expected: consistent page size and metadata.

- [ ] **Step 2: Verify empty-query listing**

Confirm normal folder browsing still works without duplicate items.

- [ ] **Step 3: Run build verification**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 4: Commit**

```bash
git add app/api/files/route.ts
git commit -m "fix: paginate folder and file list results consistently"
```