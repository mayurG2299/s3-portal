# Implementation Plan: Team Removal Blocking Modal

## 1. Update DashboardProvider Context
- Detect when selected team is no longer present in the user's `teams` list after a refetch.
- Add `teamRemoved` state to context.
- On detection, set `teamRemoved` to true and trigger sync (see below).

## 2. Multi-Tab Sync
- Use `localStorage` or `BroadcastChannel` to broadcast `teamRemoved` state across all open tabs/windows.
- Listen for changes and update local state accordingly.

## 3. Modal UI
- Create a blocking modal component (Dialog) that appears when `teamRemoved` is true.
- Modal message: "You have been removed from this team. Please refresh to continue."
- CTA: "Refresh" button that reloads the page and clears invalid team selection.
- Modal must trap focus and prevent all background interaction.

## 4. Audit Logging
- When modal is shown, call `logUserAction` with action 'TEAM_REMOVED_BLOCK_MODAL'.
- When user clicks "Refresh", call `logUserAction` with action 'TEAM_REMOVED_MODAL_REFRESH'.

## 5. Clear Invalid Team Selection
- On refresh, clear the invalid team from localStorage/context before reloading.
- Redirect user to team picker or login after reload if no valid team is selected.

## 6. Testing
- Test all dashboard pages for modal appearance and blocking behavior.
- Test multi-tab sync (removal in one tab triggers modal in all tabs).
- Test edge cases: re-invite, session expiry, manual URL change, mobile/responsive, accessibility.

## 7. Documentation
- Update relevant docs to describe new modal behavior and audit logging.

---
