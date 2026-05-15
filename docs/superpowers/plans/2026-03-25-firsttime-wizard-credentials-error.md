# First-Time Wizard Credentials Error Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the new-user credential popup submit a valid credential payload instead of failing with an internal server error.

**Architecture:** The onboarding wizard should either match the existing credentials API contract or intentionally target a separate wizard-specific API. The minimal fix is to align the wizard payload with the current `/api/credentials` schema and reuse the same server path as the settings form.

**Tech Stack:** React, Next.js App Router, TypeScript, Zod, Prisma

---

### Task 1: Compare Wizard Payload Against API Contract

**Files:**
- Modify: components/onboarding/FirstTimeWizard.tsx
- Reference: app/api/credentials/route.ts
- Reference: components/CredentialForm.tsx

- [ ] **Step 1: Confirm wizard payload mismatch**

Verify the wizard sends `accessKeyId` and `secretAccessKey` while the API expects `accessKey`, `secretKey`, `region`, and a non-empty `buckets` array.

- [ ] **Step 2: Reuse the working settings form as the reference**

Read `components/CredentialForm.tsx` and copy the minimum required payload shape rather than inventing a new one.

### Task 2: Fix Wizard Submission Payload

**Files:**
- Modify: components/onboarding/FirstTimeWizard.tsx

- [ ] **Step 1: Rename payload fields to match API schema**

Change the request body to send:

```ts
{
  name,
  accessKey,
  secretKey,
  region,
  buckets
}
```

- [ ] **Step 2: Add a region input or safe default**

Prefer an explicit region input. If the UX must stay minimal, use a default like `us-east-1` and make it visible to the user.

- [ ] **Step 3: Supply at least one bucket entry if the API requires it**

If the wizard should not create buckets yet, consider shifting to a wizard-specific backend contract. Otherwise collect one bucket name in the wizard and include it in `buckets`.

- [ ] **Step 4: Surface validation failures cleanly**

Show the API validation message instead of the current generic internal server error.

### Task 3: Decide Whether To Reuse Or Split The API Contract

**Files:**
- Modify: components/onboarding/FirstTimeWizard.tsx
- Optional: app/api/credentials/route.ts

- [ ] **Step 1: Prefer contract reuse**

If possible, keep a single credential creation contract shared by settings and onboarding.

- [ ] **Step 2: Only add wizard-specific API handling if UX requires fewer fields**

If the wizard should be simpler than the settings form, create an explicit server path for that simpler flow instead of weakening the main credentials route.

### Task 4: Verify New User Setup Flow

**Files:**
- Test: onboarding popup

- [ ] **Step 1: Reproduce and verify original failure**

Open the first-time wizard, submit valid-looking data, confirm current error path.

- [ ] **Step 2: Verify successful credential creation after fix**

Expected:
- credential is created
- wizard advances or closes correctly
- no generic internal server error toast

- [ ] **Step 3: Run build verification**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 4: Commit**

```bash
git add components/onboarding/FirstTimeWizard.tsx app/api/credentials/route.ts
git commit -m "fix: align first-time wizard credential payload"
```