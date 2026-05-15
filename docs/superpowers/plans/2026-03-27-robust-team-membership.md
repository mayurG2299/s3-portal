# Implementation Plan: Robust Team Membership & Dashboard State (Hybrid Approach)

**Date:** 2026-03-27

## Files to Modify
- lib/contexts/dashboard-context.tsx
- components/dashboard (toast/notification logic)
- hooks/use-toast.ts (if needed)
- Dashboard UI for “No Teams” state

## Tasks

1. **Add Team Loss Detection Effect**
   - In DashboardProvider, add an effect to detect when selectedTeamId is no longer in teams.
   - On loss, clear all related state and cookies, and set a teamLost flag.

2. **Implement Auto-Fallback Team Selection**
   - After clearing, if teams.length > 0, auto-select the next available team and update state/cookies.
   - If no teams remain, leave selection null.

3. **Trigger Toast/Notification on Team Loss or Switch**
   - Use the use-toast hook to show a warning/destructive toast when a team is lost or auto-switched.
   - Ensure the toast is only shown once per event.

4. **Sync State Across Tabs**
   - Add a storage event listener in DashboardProvider to update local state when cookies/localStorage change in another tab.
   - Ensure team loss and fallback logic run in all tabs.

5. **Handle “No Teams” State in Dashboard UI**
   - If teams.length === 0, show a dedicated “No Teams” state with clear guidance and actions (create/join team).

6. **Testing**
   - Add/extend tests for:
     - Team removal (self and by admin)
     - Team deletion
     - Multi-tab sync
     - Fallback and notification logic
     - “No Teams” UI

7. **Documentation**
   - Update or create a doc in docs/superpowers/specs/ and docs/superpowers/plans/ summarizing the new flow and edge cases.
