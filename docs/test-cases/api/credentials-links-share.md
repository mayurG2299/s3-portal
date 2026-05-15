# API Tests: Credentials, Links, and Public Share

## `/api/credentials` GET

### API-CRED-001 List credentials scoped to actor/team
- Priority: Critical
- Preconditions: team and personal credentials exist
- Expected:
1. authorized user sees only scoped credentials.
2. secret values are never returned.

### API-CRED-002 Unauthorized denied
- Priority: Critical
- Preconditions: no session
- Expected: `401`.

## `/api/credentials` POST

### API-CRED-010 Create credential success
- Priority: Critical
- Preconditions: actor can create credentials
- Expected:
1. credentials validated against provider.
2. keys encrypted at rest.
3. bucket rows created.
- AccessLog Assertions: create success.

### API-CRED-011 Invalid key/bucket rejected
- Priority: Critical
- Preconditions: invalid fixture keys
- Expected: validation error and no persisted credential.

## `/api/credentials` PUT

### API-CRED-020 Update credential and buckets
- Priority: Important
- Preconditions: credential exists and actor can modify
- Expected: fields updated and retained encryption rules.

### API-CRED-021 Forbidden update for unauthorized actor
- Priority: Critical
- Preconditions: viewer/non-member
- Expected: `403`.

## `/api/credentials` DELETE

### API-CRED-030 Delete credential success
- Priority: Critical
- Preconditions: authorized actor and target credential
- Expected: credential deleted with expected cascade behavior.

### API-CRED-031 Delete forbidden or not found
- Priority: Critical
- Preconditions: wrong team actor or invalid id
- Expected: `403` or `404`.

## `/api/credentials/cdn` PUT

### API-CRED-040 Set CDN config success
- Priority: Important
- Preconditions: bucket exists and actor can edit
- Expected:
1. CDN domain and key pair id stored.
2. private key encrypted.

### API-CRED-041 Invalid PEM rejected
- Priority: Important
- Preconditions: malformed private key payload
- Expected: validation failure with no key update.

## `/api/links` POST

### API-LINK-001 Create preview link success
- Priority: Critical
- Preconditions: actor with share permission, file exists
- Expected: hash link created with expected policy.
- AccessLog Assertions: `LINK_CREATE` success.

### API-LINK-002 Create password/max-download constrained link
- Priority: Critical
- Preconditions: valid password and limits payload
- Expected: password stored hashed, limits enforced.

### API-LINK-003 Create link forbidden
- Priority: Critical
- Preconditions: actor without share rights
- Expected: `403`.

## `/api/links` GET

### API-LINK-010 List own/team links
- Priority: Important
- Preconditions: links exist
- Expected: returns scoped links only.

## `/api/links` DELETE

### API-LINK-020 Revoke link success
- Priority: Important
- Preconditions: actor owns link or has proper authority
- Expected: link deleted.
- AccessLog Assertions: delete success.

### API-LINK-021 Revoke forbidden
- Priority: Critical
- Preconditions: unauthorized actor
- Expected: `403`.

## `/api/share/[hash]` GET (public)

### API-SHARE-001 Public valid link access
- Priority: Critical
- Preconditions: `LINK_PUBLIC_OK`
- Expected: access granted and URL returned/redirected.
- DB Assertions: `downloadCount` increments where applicable.

### API-SHARE-002 Password-protected flow
- Priority: Critical
- Preconditions: `LINK_PASSWORD_OK`
- Expected:
1. no password -> denied.
2. wrong password -> denied.
3. correct password -> allowed.

### API-SHARE-003 Expired/maxed/invalid hash denied
- Priority: Critical
- Preconditions: expired, maxed, unknown hash fixtures
- Expected: appropriate denial and no usable signed URL.
