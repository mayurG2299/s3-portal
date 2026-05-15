# Design: RBAC Abort Guard & Personal-Scope Fallback (2026-03-26)

## 1. RBAC Permission Fetch Abort Guard

**Goal:**
Prevent stale or out-of-order RBAC permission state when users switch teams rapidly in the dashboard.

**Design:**
- Use a request token (or AbortController) for each permission fetch.
- When a team is selected, generate a new token and start the fetch.
- Only update the RBAC state if the fetch's token matches the latest issued token.
- If a new team is selected before the previous fetch completes, the previous fetch result is ignored.
- On fetch error or abort, clear permissions to avoid stale state.

**Pseudocode:**
```ts
let currentToken = 0;
async function fetchPermissions(teamId) {
  const token = ++currentToken;
  try {
    const perms = await api.getPermissions(teamId);
    if (token === currentToken) setPermissions(perms);
  } catch (e) {
    if (token === currentToken) setPermissions([]);
  }
}
```

**Frontend Impact:**
- Update RBAC provider/context to use this pattern.
- No backend/API changes required.

---

## 2. Personal-Scope Fallback for Credentials/Links APIs

**Goal:**
If the selected team is invalid or the user is not a member, return only personal-scope resources, with a UX-friendly flag for the frontend.

**Design:**
- In credentials/links API routes:
  - If `teamId` is provided and user is a member, return team resources.
  - If `teamId` is invalid or user is not a member, return only resources where `teamId` is null (personal scope).
  - Add `{ personalScopeFallback: true }` to the response if fallback is used.
- Frontend checks this flag and displays a message: "You are viewing your personal resources. Select or join a team for more."

**API Response Example:**
```json
{
  "credentials": [ ... ],
  "personalScopeFallback": true
}
```

**Frontend Impact:**
- Show a clear notice when fallback is active.

**Security:**
- Never leak team resources if user is not a member.
- Personal resources are always safe to show to the user.

---

## Review & Next Steps
- Review this design with a code reviewer subagent.
- Get user approval.
- Write implementation plan and proceed to code changes.
