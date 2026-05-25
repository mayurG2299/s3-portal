# Production Readiness Review - S3 Portal

Use this checklist before every production release.

## Security
- [ ] NEXTAUTH_SECRET and ENCRYPTION_KEY are rotated or verified.
- [ ] HTTPS is enforced at the edge (reverse proxy or load balancer).
- [ ] Database user has least-privilege access.
- [ ] S3 IAM user has minimal bucket permissions.
- [ ] Public share link settings are reviewed (expiry, download limits).
- [ ] Dependencies audited and critical vulnerabilities addressed.

## Reliability
- [ ] Automated database backups are configured and tested.
- [ ] Recovery procedure is documented and tested.
- [ ] Health checks are monitored (/api/health).
- [ ] Alerts exist for uptime, error rate, and DB connectivity.
- [ ] Log retention meets requirements.

## Performance
- [ ] Production build passes and starts cleanly.
- [ ] Uploads tested for small and large files.
- [ ] Large file multipart upload works under load.
- [ ] Database indexes reviewed for hot paths.

## Compliance
- [ ] Data retention and deletion policies are defined.
- [ ] Audit logs are enabled and reviewed.
- [ ] Access controls validated for all roles.

## Operations
- [ ] Environment variables validated in production.
- [ ] Rate limiting enabled if required.
- [ ] CI build/test pipeline is green.
- [ ] Release notes prepared.

## Validation
- [ ] Smoke test list completed (see docs/TEST-CASES.md).
- [ ] Rollback plan documented.
