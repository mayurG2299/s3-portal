# RBAC Abort Guard & Personal-Scope Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Prevent stale RBAC state when switching teams rapidly (frontend abort guard)
- Ensure credentials/links APIs fall back to personal-scope with a UX flag if team context is invalid

**Architecture:**
- RBAC: Use a request token or AbortController in the RBAC provider/context to ensure only the latest permission fetch updates state.
- Personal-scope fallback: Update API routes to return only personal resources with a `personalScopeFallback` flag if team context is invalid; frontend displays a clear notice.

**Tech Stack:**
- Next.js 14 (App Router), TypeScript, React, Prisma, PostgreSQL

---

## File Structure & Responsibilities

- `components/rbac-provider.tsx` — RBAC context/provider logic (frontend abort guard)
- `app/api/credentials/route.ts` — Credentials API (personal-scope fallback logic)
- `app/api/links/route.ts` — Links API (personal-scope fallback logic)
- `components/CredentialForm.tsx`, `app/dashboard/credentials/page.tsx` — Show fallback UX if flag is set
- `app/dashboard/links/page.tsx` — Show fallback UX if flag is set
- `__tests__/lib/` — Add/adjust tests for new logic
- `docs/superpowers/specs/2026-03-26-rbac-abort-guard-personal-fallback-design.md` — Reference design doc

---

## Step-by-Step Tasks

### RBAC Abort Guard (Frontend)
- [ ] Identify where permissions are fetched in `rbac-provider.tsx`
- [ ] Refactor fetch logic to use a request token or AbortController
- [ ] Ensure only the latest fetch result updates state
- [ ] On error/abort, clear permissions
- [ ] Add/adjust tests for rapid team switching
- [ ] Commit: "feat: add abort guard to RBAC permission fetch"

### Personal-Scope Fallback (Backend)
- [ ] In `app/api/credentials/route.ts`, update GET handler:
    - If teamId is invalid or user is not a member, return only personal-scope resources
    - Always include `personalScopeFallback` flag (true/false)
- [ ] In `app/api/links/route.ts`, update GET handler similarly
- [ ] Add/adjust tests for fallback logic
- [ ] Commit: "feat: add personal-scope fallback to credentials/links APIs"

### Personal-Scope Fallback (Frontend)
- [ ] In credentials and links pages/components, detect `personalScopeFallback` flag
- [ ] Show a clear notice: "You are viewing your personal resources. Select or join a team for more."
- [ ] Add/adjust tests for fallback UX
- [ ] Commit: "feat: show fallback notice for personal-scope resources"

### Verification
- [ ] Run all tests (unit/integration)
- [ ] Manually test rapid team switching and fallback scenarios
- [ ] Commit: "test: verify abort guard and fallback logic"

---

## Notes
- Reference the design doc for details and pseudocode
- Use TDD: write/adjust tests before implementing logic
- Keep commits focused and atomic
