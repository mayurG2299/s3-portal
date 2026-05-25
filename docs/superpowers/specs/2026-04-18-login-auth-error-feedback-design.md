# Login Auth Error Feedback — Design Spec

## Goal

Replace the current destructive login toast with calmer, form-level feedback that matches the login page visual language and gives users a clear recovery path.

The new behavior must distinguish between:

- email not found
- incorrect password
- unauthorized redirect to login

Only the "email not found" case should offer account creation.

---

## Current Problem

The login page currently shows a red toast with the generic message `Invalid email or password` for all credential failures.

This creates two UX problems:

- it hides the difference between "no account exists" and "wrong password"
- the red toast feels abrupt and visually disconnected from the login card

The page already has a footer link to registration, but it is too weak as the primary recovery path when no user exists.

---

## Recommended Approach

Use a single inline auth notice inside the login card, placed below the introductory text and above the form fields.

This notice becomes the dedicated place for login-state feedback:

- `email not found`: show a clear title, short helper text, and a `Create account` button linking to `/register`
- `incorrect password`: show the same calmer inline notice style, but without the CTA
- `unauthorized`: restyle the existing message into the same inline notice pattern for consistency

Do not use a toast for login credential failures.

---

## UX Behavior

### 1. Email Not Found

Show:

- Title: `No account found for this email`
- Body: `Check the email you entered, or create a new account to get started.`
- Action: `Create account` button linking to `/register`

This state should feel helpful, not punitive.

### 2. Incorrect Password

Show:

- Title: `Incorrect password`
- Body: `Check your password and try again.`
- No CTA button

This preserves account guidance without exposing unnecessary detail beyond the already approved split.

### 3. Unauthorized Redirect

Keep the existing "you must be logged in" behavior, but render it using the same inline notice component style rather than the current ad hoc red block.

Suggested copy:

- Title: `Login required`
- Body: `Please sign in to continue to that page.`

### 4. Visibility and Reset Rules

The inline notice should:

- remain visible until the user edits the form or submits again
- replace any previous auth notice instead of stacking
- never auto-dismiss

---

## Presentation

The notice should sit inside the existing glass-morphic login card and visually match the rest of the page.

Styling direction:

- tinted but non-destructive background
- soft border
- strong heading
- muted supporting text
- optional action button for the missing-user state only

The component should communicate failure without using the current high-saturation red toast treatment.

This is intentionally a form-level notice, not a field validation message.

---

## Architecture

### `lib/auth.ts`

The credentials authorize flow must return distinct failure outcomes so the login page can render the correct UI.

Current issue:

- both missing-user and wrong-password paths return `null`

Required change:

- introduce distinguishable auth error codes for:
  - `user-not-found`
  - `invalid-password`

The exact transport can follow NextAuth constraints, but the page must receive a stable, explicit result code rather than inferring from a generic failure.

### `app/login/page.tsx`

Replace toast-based failure handling with local component state that stores the active auth notice.

Responsibilities:

- map auth result codes to notice content
- render the inline notice above the form fields
- clear or replace the notice appropriately on input change / resubmit
- preserve the existing redirect behavior on successful sign-in

### Presentational Notice

The notice can either:

- be rendered inline inside `app/login/page.tsx` if kept very small, or
- be extracted into a small reusable presentational component if the JSX becomes noisy

Recommendation:

- keep extraction optional; do not create a shared global alert system for this change

This is a focused login UX improvement, not a general notification redesign.

---

## Copy Map

| State | Title | Body | Action |
|-------|-------|------|--------|
| user-not-found | `No account found for this email` | `Check the email you entered, or create a new account to get started.` | `Create account` -> `/register` |
| invalid-password | `Incorrect password` | `Check your password and try again.` | none |
| unauthorized | `Login required` | `Please sign in to continue to that page.` | none |
| unexpected-error | `Could not sign you in` | `Something went wrong. Please try again.` | none |

---

## File Map

| File | Action |
|------|--------|
| `lib/auth.ts` | **Modify** — return distinct credential failure outcomes |
| `app/login/page.tsx` | **Modify** — replace toast flow with inline auth notice rendering |
| `__tests__/auth/flows.test.ts` | **Modify** — verify missing-user vs invalid-password outcomes |
| `__tests__/app/login-page.test.tsx` | **Modify** — verify inline notice content and CTA behavior |

---

## Testing

### Auth Tests

Add or update tests to prove:

- unknown email returns the missing-user outcome
- existing email with wrong password returns the invalid-password outcome
- valid credentials still sign in successfully

### Login Page Tests

Add or update tests to prove:

- missing-user renders the inline notice with the register CTA
- wrong-password renders the inline notice without the CTA
- unauthorized search param renders the matching inline notice
- successful sign-in still redirects
- toast is not used for these auth cases

---

## Non-Goals

This change does not include:

- a full app-wide toast redesign
- password reset implementation
- registration flow redesign
- field-level validation overhaul

---

## Risks and Constraints

- NextAuth credentials flows can collapse failures into generic errors, so the implementation must choose a transport that preserves the approved distinction cleanly.
- The login page is already visually dense; the notice should be concise and not push the form too far down on smaller screens.
- The CTA must appear only for the missing-user case, otherwise the page risks encouraging unnecessary account creation for typoed passwords.
