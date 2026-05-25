# Dashboard Action Center Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

Goal: Replace low-value informational sections on the dashboard with action-oriented guidance that helps users complete meaningful storage-management tasks.

Architecture: Keep existing team and permission scoping in the dashboard server page, but swap the current Storage Overview chart and Transmission Feed panel for a server-driven Action Center block. The Action Center computes a short prioritized list of actionable items from existing data already queried for the dashboard context (credentials, bucket selection, quota pressure, sharing risk, upload readiness).

Tech Stack: Next.js App Router, TypeScript, Prisma, existing RBAC helpers, existing UI components.

---

## Scope For First Implementation

- In scope:
  - Replace Storage Overview section and Transmission Feed section with a new Action Center card list.
  - Keep top hero and stat cards intact in this pass.
  - Use existing permission and team/bucket/identity scoping logic.
  - Add focused tests for action priority and visibility conditions.
- Out of scope:
  - Major redesign of hero/KPI cards.
  - New analytics page.
  - Reworking onboarding wizard behavior.

---

## File Map

- Modify: app/dashboard/page.tsx
  - Remove chart and feed rendering region.
  - Compute Action Center items from already scoped context.
  - Render prioritized actions with direct links.

- Create: components/dashboard/action-center.tsx
  - Presentational component for action cards.
  - Accepts typed action list and renders severity, title, description, and CTA link.

- Create: lib/dashboard-action-center.ts
  - Pure helper(s) to derive and rank actions from dashboard inputs.
  - Contains deterministic action-priority logic and thresholds.

- Create: __tests__/lib/dashboard-action-center.test.ts
  - Unit tests for action derivation and ranking.

- Modify: __tests__/app/dashboard-page.test.tsx (or closest existing dashboard page test file)
  - Assert Action Center content and absence of old sections where applicable.
  - If file does not exist, create __tests__/app/dashboard-page.test.tsx.

---

## Action Model

Type:
- id: string
- severity: critical | warning | info
- title: string
- description: string
- href: string
- ctaLabel: string

Initial action rules (first pass):
1. No credentials configured
  - Condition: credentialsCount === 0
  - Severity: critical
  - CTA: Go to settings
2. No accessible bucket selected
  - Condition: bucket selection missing while credentials exist
  - Severity: warning
  - CTA: Open files (or settings if no buckets)
3. Quota pressure
  - Condition: usage percent >= 80
  - Severity: warning (>= 80), critical (>= 95)
  - CTA: Review storage/quota page
4. Risky link posture
  - Condition: links exist and portion without expiry/password exceeds threshold in scoped context
  - Severity: warning
  - CTA: Review shared links
5. Healthy fallback
  - Condition: none of the above
  - Severity: info
  - CTA: Upload files

Priority order:
- critical before warning before info
- Within same severity: fixed deterministic order by id
- Max displayed actions: 4

---

## Task 1: Create Pure Action Derivation Helper

Files:
- Create: lib/dashboard-action-center.ts
- Test: __tests__/lib/dashboard-action-center.test.ts

- [ ] Step 1: Write failing tests for core action rules.
- [ ] Step 2: Run targeted test file to confirm failing state.
- [ ] Step 3: Implement minimal pure helper to pass tests.
- [ ] Step 4: Re-run targeted tests and verify pass.

Test cases:
- returns critical no-credentials action when credentialsCount is zero
- returns quota warning at 80 percent and critical at 95 percent
- returns healthy fallback action when no risk condition exists
- sorts by severity and trims to max actions

---

## Task 2: Build Action Center UI Component

Files:
- Create: components/dashboard/action-center.tsx
- Test: __tests__/components/dashboard-action-center.test.tsx (create if needed)

- [ ] Step 1: Add component test for rendering action rows and CTA links.
- [ ] Step 2: Run test to confirm fail.
- [ ] Step 3: Implement component using existing Card and Button patterns.
- [ ] Step 4: Re-run component test and verify pass.

UI requirements:
- clear section title: Action Center
- severity styling tokenized via existing theme classes
- each action includes concise description and one primary CTA
- empty list guarded by helper fallback so component always has content

---

## Task 3: Replace Dashboard Lower Panels

Files:
- Modify: app/dashboard/page.tsx

- [ ] Step 1: Add page-level integration test (or update existing) asserting Action Center appears.
- [ ] Step 2: Assert old Storage Overview and Transmission Feed blocks are removed from render path in the tested scenario.
- [ ] Step 3: Wire helper input from existing scoped counts and usage data.
- [ ] Step 4: Render Action Center in place of chart/feed grid.
- [ ] Step 5: Re-run targeted tests.

Implementation notes:
- retain existing context scoping: active team, identity, bucket, allowed bucket IDs
- reuse already computed counts where possible to avoid extra queries
- if additional query needed for risky links, keep minimal and scoped

---

## Task 4: Verification

Files:
- N/A (verification only)

- [ ] Step 1: Run focused new/updated tests.
  - npm test -- __tests__/lib/dashboard-action-center.test.ts
  - npm test -- __tests__/components/dashboard-action-center.test.tsx
  - npm test -- __tests__/app/dashboard-page.test.tsx
- [ ] Step 2: Run broader suite if environment allows.
  - npm test
- [ ] Step 3: If full suite fails due existing SWC environment issue, document exact blocker and keep focused tests as acceptance evidence.

---

## Acceptance Criteria

- Dashboard no longer shows Storage Overview chart and Transmission Feed in first-pass redesign.
- Dashboard shows Action Center with up to 4 prioritized actions.
- Actions are scoped to the active team and current selection context.
- At least one actionable CTA is always visible.
- New helper logic has deterministic unit tests.

---

## Risks And Mitigations

- Risk: over-querying dashboard page.
  - Mitigation: derive from existing counts first, add only one scoped query if required.
- Risk: action noise for users with healthy setup.
  - Mitigation: include concise healthy fallback action.
- Risk: UI churn impacts tests.
  - Mitigation: test by semantic text and role-based selectors, not brittle class names.

---

## Suggested Commit Slices

1. test: add failing action-center helper tests
2. feat: add dashboard action derivation helper
3. feat: add action-center component and tests
4. refactor: replace dashboard chart/feed with action center
5. test: update dashboard page integration assertions

---

## Execution Recommendation

Use subagent-driven-development for implementation because tasks are naturally separable (logic, component, page wiring, verification), with review checkpoints between each task.