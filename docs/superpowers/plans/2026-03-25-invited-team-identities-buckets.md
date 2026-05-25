# Invited Team Identity And Bucket Dropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make identity and bucket dropdowns load correctly when the user switches to an invited team.

**Architecture:** The selected team already exists in dashboard state, but the credentials API currently defaults to the user's primary team. The fix is to thread the selected team through the credentials request, validate membership server-side, and then let downstream bucket loading continue from the returned credential set.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, React context, NextAuth

---

### Task 1: Verify Current Team Selection Flow

**Files:**
- Modify: app/api/credentials/route.ts
- Modify: lib/contexts/dashboard-context.tsx
- Test: manual dashboard team switching flow

- [ ] **Step 1: Confirm team selection source**

Read and confirm how `selectedTeamId` is stored and read in `lib/contexts/dashboard-context.tsx` and `app/dashboard/layout.tsx`.

- [ ] **Step 2: Confirm API defaulting bug**

Read `app/api/credentials/route.ts` and verify GET currently filters by `session.user.teamId` when no explicit team is provided.

- [ ] **Step 3: Write a failing regression test or reproduction note**

If an API test harness exists, add a focused test for invited-team credential fetch. Otherwise document a manual reproduction:

```text
1. Accept invite to Team B
2. Switch team dropdown from Team A to Team B
3. Observe identities dropdown empty despite Team B having credentials
```

### Task 2: Pass Selected Team To Credentials API

**Files:**
- Modify: lib/contexts/dashboard-context.tsx

- [ ] **Step 1: Update credentials fetch request**

Change the fetch call to include the selected team in the query string:

```ts
fetch(`/api/credentials?teamId=${selectedTeamId}`)
```

- [ ] **Step 2: Preserve current fallback behavior**

If no team is selected, keep the current no-param or primary-team fallback behavior intact.

### Task 3: Validate Team Membership In API

**Files:**
- Modify: app/api/credentials/route.ts

- [ ] **Step 1: Parse teamId from search params**

Read the request URL and derive:

```ts
const requestedTeamId = searchParams.get('teamId') || session.user.teamId
```

- [ ] **Step 2: Verify user membership before querying credentials**

Use Prisma to ensure the authenticated user is a member of the requested team before returning data.

- [ ] **Step 3: Query credentials for the requested team**

Replace the primary-team-only filter with the validated team id.

- [ ] **Step 4: Return 403 when membership check fails**

Use `ApiResponse.forbidden()` or equivalent route response helper already used in the file.

### Task 4: Validate End-To-End Behavior

**Files:**
- Test: dashboard team switch, identity dropdown, bucket dropdown

- [ ] **Step 1: Run build verification**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 2: Manually verify dropdown behavior**

Switch across owned and invited teams. Confirm:
- invited team identities load
- bucket dropdown populates after identity selection
- unauthorized team ids are not accepted

- [ ] **Step 3: Commit**

```bash
git add app/api/credentials/route.ts lib/contexts/dashboard-context.tsx
git commit -m "fix: load credentials for invited team selection"
```