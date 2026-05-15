# Design Doc: Blocking Modal on Team Removal

## Overview
When a user is removed from their currently selected team (in any tab or page), the app must immediately show a blocking modal with a clear message and a CTA (e.g., "Refresh"). The modal must prevent all further interaction until the user refreshes or selects a valid team. This must work across all dashboard pages and tabs, and log the event for auditing.

## Goals
- Block all dashboard UI if user is removed from their selected team.
- Show a true modal (not a toast) with a clear message and CTA.
- Modal must appear regardless of which dashboard page is open.
- Modal must appear in all open tabs/windows for the user.
- Log the event to the audit log.
- Only trigger for team removal (not for other errors).

## Non-Goals
- Handling of other permission changes (handled elsewhere).
- Custom modals for other error types.

## Approach
- Use the `DashboardProvider` context to detect when the selected team is no longer accessible (e.g., removed from `teams` list after a refetch).
- When detected, set a `teamRemoved` state in context.
- Render a blocking modal (using shadcn/ui Dialog or similar) when `teamRemoved` is true.
- Modal message: "You have been removed from this team. Please refresh to continue."
- CTA: "Refresh" button (reloads page and clears invalid team selection).
- Use `localStorage` or `BroadcastChannel` to sync state across tabs.
- Log the event using `logUserAction` with action 'TEAM_REMOVED_BLOCK_MODAL'.

## Affected Flows & Edge Cases
- User is removed from team in another tab or by admin; modal appears in all open tabs.
- User is on any dashboard page (files, settings, members, etc.); modal blocks all content.
- User tries to interact with UI; modal prevents all actions.
- User refreshes; app clears invalid team selection and redirects to team picker or login.
- User is removed from multiple teams; only show modal if selected team is lost.
- User is not logged in; normal auth flow applies.
- User is removed and then re-invited; modal persists until refresh.

## Implementation Plan
1. **Context Update**: In `DashboardProvider`, detect when selected team is no longer in `teams` list after a refetch.
2. **State & Sync**: Add `teamRemoved` state. Use `localStorage` or `BroadcastChannel` to sync across tabs.
3. **Modal UI**: Add a blocking modal component (Dialog) that appears when `teamRemoved` is true.
4. **CTA**: Modal has a "Refresh" button that reloads the page and clears invalid team selection.
5. **Audit Log**: Call `logUserAction` with action 'TEAM_REMOVED_BLOCK_MODAL' when modal is shown.
6. **Testing**: Test all dashboard pages, multi-tab, and edge cases.

## Audit Logging
- Log on modal show: `{ action: 'TEAM_REMOVED_BLOCK_MODAL', userId, teamId, success: true }`
- Log on refresh/CTA: `{ action: 'TEAM_REMOVED_MODAL_REFRESH', userId, teamId, success: true }`

## Security & UX Notes
- Modal must be truly blocking (no escape, no background interaction).
- No sensitive info in modal or logs.
- Modal must not appear for other errors.

---
