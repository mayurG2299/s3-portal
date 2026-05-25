# Screen Tests: Public Routes

## `/` Landing

### SCR-PUB-001 Landing renders for anonymous user
- Priority: Important
- Preconditions: No session cookie
- Data Pack: `PACK-AUTH`
- Steps:
1. Open `/`.
2. Verify hero, value cards, and primary CTA.
3. Click `Sign In`.
- Expected:
1. Page renders with no server error.
2. CTA navigates to `/login`.
- Status: Not Run

### SCR-PUB-002 Landing renders for authenticated user
- Priority: Important
- Preconditions: Session for `U_OWNER_A`
- Data Pack: `PACK-AUTH`
- Steps:
1. Open `/`.
2. Verify CTA text for authenticated state.
3. Click CTA.
- Expected:
1. CTA shows `Continue to Dashboard`.
2. Navigation goes to `/dashboard`.
- Status: Not Run

## `/login`

### SCR-PUB-010 Login success path
- Priority: Critical
- Preconditions: Valid user `U_OWNER_A`
- Data Pack: `PACK-AUTH`
- Steps:
1. Submit valid email/password.
2. Observe redirect.
- Expected:
1. Auth succeeds.
2. Redirect to callback URL or `/dashboard`.
- Status: Not Run

### SCR-PUB-011 Login invalid credentials
- Priority: Critical
- Preconditions: Valid email, wrong password
- Data Pack: `PACK-AUTH`
- Steps:
1. Submit invalid password.
- Expected:
1. Error toast shown.
2. No session created.
- Status: Not Run

## `/register`

### SCR-PUB-020 Register valid strong password
- Priority: Critical
- Preconditions: Email not used
- Data Pack: `PACK-AUTH`, `PACK-TEAM`
- Steps:
1. Fill form with valid data and strong password.
2. Submit.
- Expected:
1. `POST /api/auth/register` returns success.
2. User and default team bootstrap completed.
3. Redirect to `/login`.
- Status: Not Run

### SCR-PUB-021 Register weak password rejected
- Priority: Critical
- Preconditions: New email
- Data Pack: `PACK-AUTH`
- Steps:
1. Fill password missing complexity requirements.
2. Submit.
- Expected:
1. Client-side validation blocks, or server returns `400`.
2. No user created.
- Status: Not Run

## `/share/[hash]`

### SCR-PUB-030 Public link preview without password
- Priority: Critical
- Preconditions: `LINK_PUBLIC_OK`
- Data Pack: `PACK-LINKS`, `PACK-FILES`
- Steps:
1. Open `/share/<hash>` for public valid link.
2. Trigger preview and download.
- Expected:
1. File metadata loads.
2. Preview URL is returned.
3. Download succeeds if `allowDownload=true`.
- Status: Not Run

### SCR-PUB-031 Password-protected link requires password
- Priority: Critical
- Preconditions: `LINK_PASSWORD_OK`
- Data Pack: `PACK-LINKS`
- Steps:
1. Open protected share link without password.
2. Submit wrong password.
3. Submit correct password.
- Expected:
1. Request without password rejected.
2. Wrong password rejected.
3. Correct password allows access.
- Status: Not Run

### SCR-PUB-032 Expired or maxed link denied
- Priority: Critical
- Preconditions: `LINK_EXPIRED`, `LINK_MAXED`
- Data Pack: `PACK-LINKS`
- Steps:
1. Open expired link.
2. Open maxed-download link.
- Expected:
1. Access denied with proper error messaging.
2. No valid preview/download URL returned.
- Status: Not Run
