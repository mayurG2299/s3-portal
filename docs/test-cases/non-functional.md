# Non-Functional Manual Checks

## NFR-PERF

### NFR-PERF-001 Large file upload UX under constrained network
- Priority: Important
- Steps:
1. Throttle network to slow 3G profile.
2. Upload `FILE_A_LARGE`.
- Expected:
1. Progress updates are visible.
2. Failure/retry messaging is actionable.

### NFR-PERF-002 Preview responsiveness for common file types
- Priority: Important
- Steps:
1. Preview image/pdf/text/csv markdown files.
- Expected:
1. Preview opens within acceptable latency envelope.
2. UI remains responsive.

## NFR-RES

### NFR-RES-001 S3 transient failure handling
- Priority: Critical
- Steps:
1. Simulate temporary S3 error during preview/download.
- Expected:
1. User receives clear failure message.
2. App does not crash or hang.

### NFR-RES-002 API timeout/retry behavior for mutations
- Priority: Important
- Steps:
1. Trigger upload or role mutation with induced timeout.
- Expected:
1. UI reflects uncertain state safely.
2. Duplicate mutation is not silently applied twice.

## NFR-SEC

### NFR-SEC-001 Sensitive data non-exposure
- Priority: Critical
- Steps:
1. Inspect responses from credentials and share APIs.
2. Inspect UI state payloads and logs.
- Expected:
1. No plaintext access keys, secret keys, or private keys exposed.

### NFR-SEC-002 Cross-team ID tampering
- Priority: Critical
- Steps:
1. Use `TEAM_B` resource IDs while authenticated in `TEAM_A`.
- Expected:
1. Access denied.
2. No data leak in response body.

## NFR-AUDIT

### NFR-AUDIT-001 Sensitive success path audit completeness
- Priority: Critical
- Steps:
1. Perform upload, delete, credential create, link create, role update.
- Expected:
1. Access logs contain actor, action, success, resource type/id, timestamp.

### NFR-AUDIT-002 Sensitive failure path audit completeness
- Priority: Critical
- Steps:
1. Trigger forbidden delete and failed password change.
- Expected:
1. Failure entries recorded with useful error context.

## NFR-COMPAT

### NFR-COMPAT-001 Browser compatibility smoke
- Priority: Important
- Steps:
1. Execute smoke flow in Chrome and Safari.
- Expected:
1. Login, files list, preview, and share page work in both browsers.

### NFR-COMPAT-002 Mobile viewport behavior
- Priority: Important
- Steps:
1. Execute dashboard navigation and share access on mobile viewport.
- Expected:
1. No blocking layout or action loss in critical flows.
