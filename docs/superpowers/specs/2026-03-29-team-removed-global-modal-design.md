# Design Doc: Global Team Removal Modal & Consistent UX

**Date:** 2026-03-29
**Branch:** feature/major-dashboard-refactor

## Problem
- The current "You have been removed from this team" modal only appears in some flows.
- In other cases (e.g., after removal, clicking preview file), a toast error is shown instead of the modal.
- The modal UI is visually harsh (full blackout, not soft, not visually connected to the app).
- There is inconsistent UX for the same error across the app.

## Goals
- Show a visually soft, consistent modal for all "team removed" errors, regardless of how they are triggered (user action or background API call).
- Block all UI interaction until the modal is acknowledged.
- Suppress all toasts for this error in favor of the modal.
- Modal should be visually soft: transparent overlay, visible background, soft shadow, rounded corners, gentle animation.

## Solution Overview
- Add a global `teamRemoved` state to the main app context/store (e.g., in `DashboardProvider` or a new `AppProvider`).
- Any API call (foreground or background) that receives a "team removed"/403 error sets this state.
- The modal is rendered at the app root (e.g., in `app/layout.tsx` or a top-level provider).
- When `teamRemoved` is true, the modal is shown and all other UI is visually disabled/blurred.
- On "OK", the modal resets the app state (e.g., logs out, redirects, or reloads).

## UX Details
- Modal overlay: semi-transparent, blurred, with a soft vignette.
- Modal: glass-morphic, rounded corners, soft shadow, fade-in animation.
- Modal blocks all interaction until acknowledged.
- Modal text: clear, friendly, and consistent.

## Error Handling
- All API error handlers (including background polling) must check for "team removed" errors and set the global state.
- All toasts for this error are suppressed if the modal is active.

## Implementation Steps
1. Add `teamRemoved` state and setter to global context/store.
2. Update all API error handlers to set this state on "team removed"/403 error.
3. Render the modal at the app root, controlled by this state.
4. Refactor modal for visual softness and consistency.
5. Suppress toasts for this error if modal is active.
6. On modal "OK", reset app state (e.g., logout, redirect, or reload).

## Out of Scope
- Changing the actual removal logic or backend error codes.
- Handling other error types (only "team removed").

---

**Please review this design. Once approved, I will proceed to the implementation plan.**
