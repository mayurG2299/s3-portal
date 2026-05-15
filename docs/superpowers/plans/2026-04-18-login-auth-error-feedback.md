# Login Auth Error Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the login page's destructive generic toast with inline auth notices that distinguish missing-user from wrong-password and show a signup CTA only for missing users.

**Architecture:** Add a small shared credential-check helper in `lib/auth.ts` that returns explicit result codes. Use that helper both in NextAuth credentials authorization and in a lightweight login preflight API so the login page can show the right inline notice before attempting sign-in. Keep the UI change local to the login page rather than redesigning the app-wide toast system.

**Tech Stack:** Next.js App Router, NextAuth credentials auth, Prisma, Jest, Testing Library, TypeScript

---

### Task 1: Add failing auth helper tests

**Files:**
- Modify: `__tests__/auth/flows.test.ts`
- Modify: `lib/auth.ts`

- [ ] **Step 1: Write failing tests for explicit credential outcomes**

Add tests that expect a shared auth helper to return:

```ts
{ status: 'user-not-found' }
{ status: 'invalid-password' }
{ status: 'success', user: { id: '...', email: '...' } }
```

- [ ] **Step 2: Run the auth test file to verify failure**

Run: `npm test -- --runInBand __tests__/auth/flows.test.ts`
Expected: FAIL because the helper does not exist yet.

- [ ] **Step 3: Implement the minimal auth helper**

In `lib/auth.ts`, add a small exported helper that:
- looks up the user by email
- returns `user-not-found` if absent
- verifies password
- returns `invalid-password` if mismatch
- returns `success` with the user payload if valid

Update the NextAuth credentials provider to reuse this helper.

- [ ] **Step 4: Run the auth test file to verify it passes**

Run: `npm test -- --runInBand __tests__/auth/flows.test.ts`
Expected: PASS

---

### Task 2: Add failing login-page tests for inline notices

**Files:**
- Modify: `__tests__/app/login-page.test.tsx`
- Modify: `app/login/page.tsx`

- [ ] **Step 1: Write failing login-page tests**

Add tests for:
- missing-user response renders inline notice with `Create account`
- wrong-password response renders inline notice without `Create account`
- unauthorized query param uses the same inline notice treatment
- login auth failures no longer call `toast`

- [ ] **Step 2: Run the login-page test file to verify failure**

Run: `npm test -- --runInBand __tests__/app/login-page.test.tsx`
Expected: FAIL because the page still uses toast-based handling.

- [ ] **Step 3: Implement minimal inline notice rendering**

In `app/login/page.tsx`:
- replace toast-based auth errors with local component state
- render the inline notice above the form
- show CTA button only for missing-user
- clear notice on field edits and replace it on each submit

- [ ] **Step 4: Run the login-page test file to verify it passes**

Run: `npm test -- --runInBand __tests__/app/login-page.test.tsx`
Expected: PASS

---

### Task 3: Add a small preflight API for login messaging

**Files:**
- Create: `app/api/auth/login-state/route.ts`
- Modify: `lib/auth.ts`
- Test: `__tests__/auth/flows.test.ts`

- [ ] **Step 1: Write a failing test for the route behavior or helper reuse**

Add coverage that ensures the public login preflight uses the same shared helper outcomes rather than duplicating password logic.

- [ ] **Step 2: Run targeted tests to verify failure**

Run: `npm test -- --runInBand __tests__/auth/flows.test.ts`
Expected: FAIL because the route/helper integration does not exist yet.

- [ ] **Step 3: Implement the route**

Create a minimal `POST` route that accepts `email` and `password`, calls the shared helper, and returns:

```ts
{ status: 'user-not-found' | 'invalid-password' | 'success' }
```

The login page should call this route before `signIn` so it can decide whether to show the missing-user CTA or continue to the normal credential sign-in flow.

- [ ] **Step 4: Run targeted tests to verify pass**

Run: `npm test -- --runInBand __tests__/auth/flows.test.ts __tests__/app/login-page.test.tsx`
Expected: PASS

---

### Task 4: Verify the full login flow

**Files:**
- Modify: `app/login/page.tsx`
- Modify: `lib/auth.ts`
- Create or Modify: `app/api/auth/login-state/route.ts`
- Modify: `__tests__/app/login-page.test.tsx`
- Modify: `__tests__/auth/flows.test.ts`

- [ ] **Step 1: Run focused verification**

Run: `npm test -- --runInBand __tests__/auth/flows.test.ts __tests__/app/login-page.test.tsx`
Expected: PASS

- [ ] **Step 2: Run any additional targeted lint/type checks if needed**

Run: `npm run lint`
Expected: PASS or surface only unrelated pre-existing issues.

- [ ] **Step 3: Manual verification**

Check in the browser:
- unknown email shows inline notice with CTA
- wrong password shows inline notice without CTA
- success still redirects
- no red destructive toast appears for login failure
