# Restore Website Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the standalone `website/` landing page so it matches the former app marketing landing content, while keeping it static and free of auth-specific CTAs.

**Architecture:** Keep the main app root route as a redirect-only entry point and move the intended marketing experience into `website/index.html`. Reuse the existing standalone static site structure, but replace the old hero/setup copy and layout details with the former app landing content adapted to static HTML/CSS and theme toggle support.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, Jest

---

### Task 1: Lock Expected Landing Content

**Files:**
- Create: `__tests__/website/landing-page.test.ts`
- Modify: `website/index.html`

- [ ] **Step 1: Write the failing test**

Create a test that reads `website/index.html` and asserts:
- it contains `Manage files in S3 with a flow your team can actually use.`
- it contains `Open source self-hosted S3 portal`
- it contains `Self-hosting steps`
- it does not contain `Sign in`
- it does not contain `Your S3 Storage, Finally Under Control`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand __tests__/website/landing-page.test.ts`
Expected: FAIL because the current standalone landing page still has the older hero copy.

### Task 2: Restore Landing Markup

**Files:**
- Modify: `website/index.html`

- [ ] **Step 1: Replace hero/setup/footer content with the former app landing content**

Use the old `app/page.tsx` marketing copy as the source of truth, adapted for static HTML.

- [ ] **Step 2: Keep standalone-safe CTAs**

Keep marketing CTAs such as `Get started`, documentation links, and GitHub links. Do not include auth-state buttons like `Sign in` or `Dashboard`.

- [ ] **Step 3: Preserve existing standalone helpers**

Keep theme toggle, copy buttons, and smooth-scroll behavior working.

### Task 3: Align Styling

**Files:**
- Modify: `website/assets/style.css`

- [ ] **Step 1: Update styles to match the restored marketing structure**

Adjust typography, spacing, hero, setup, and footer styles so the standalone page matches the intended landing page rather than the older static design.

- [ ] **Step 2: Preserve theme support**

Keep both light and dark theme variables and toggle styling functional.

### Task 4: Restore Product Explanation Content

**Files:**
- Modify: `website/index.html`
- Modify: `website/assets/style.css`
- Test: `__tests__/website/landing-page.test.ts`

- [ ] **Step 1: Extend the test first**

Assert that the landing page includes a dedicated product-description section with:
- `What S3 Portal does`
- `You bring your own AWS credentials`
- `Direct S3 Integration`
- `Zero-Trust Security`
- `Parallel Uploads`

- [ ] **Step 2: Add the missing marketing section**

Insert a new section below the hero using copy sourced from `README.md`, `app/login/page.tsx`, and `app/register/page.tsx`.

- [ ] **Step 3: Style the section to match the standalone landing page**

Add section layout and feature-card styling consistent with the current static marketing page.

### Task 5: Verify

**Files:**
- Test: `__tests__/website/landing-page.test.ts`

- [ ] **Step 1: Run targeted landing page test**

Run: `npm test -- --runInBand __tests__/website/landing-page.test.ts`
Expected: PASS

- [ ] **Step 2: Run full test suite**

Run: `npm test -- --watch=false`
Expected: PASS

- [ ] **Step 3: Manually verify static site locally**

Serve `website/` on a free port and confirm the browser matches the expected landing page and no auth CTA appears.