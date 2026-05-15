# Affected Flows & Edge Cases: Team Removal Modal

## Affected Flows
1. **User is removed from selected team in any tab**
   - Modal appears in all open dashboard tabs/windows.
2. **User is on any dashboard page**
   - Files, settings, members, links, etc. — modal blocks all content.
3. **User tries to interact with dashboard UI**
   - All actions are blocked by modal overlay.
4. **User clicks "Refresh" CTA**
   - Page reloads, invalid team selection is cleared, user is redirected to team picker or login.
5. **User is removed from multiple teams**
   - Modal only appears if the currently selected team is lost.
6. **User is removed and then re-invited**
   - Modal persists until refresh; after refresh, user can re-select team if re-invited.
7. **User is not logged in**
   - Normal auth flow applies; modal is not shown.
8. **User is removed in another tab**
   - Modal appears in all tabs via sync (localStorage/BroadcastChannel).

## Edge Cases
- **Race condition**: User is removed and re-invited before refresh — modal persists until refresh, then new team appears.
- **API error**: If team list fails to load, fallback to normal error handling (do not show modal).
- **Manual URL change**: User tries to access dashboard with invalid team in URL — modal appears if context detects removal.
- **Session expiry**: If session expires, normal auth flow applies, modal is not shown.
- **Multiple dashboards**: If user has multiple dashboard windows, all are blocked.
- **Mobile/responsive**: Modal must be responsive and accessible.
- **Accessibility**: Modal must trap focus and be screen-reader friendly.

---
