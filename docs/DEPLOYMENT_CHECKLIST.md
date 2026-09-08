# BİŞIŞ V1 — Deployment Checklist

**قاعدة:** هذه checklist لا تنفذ deployment. كل خطوة تتطلب Production/host/provider يجب أن يثبتها owner على staging أولًا.

## Release artifact

| Check | Required evidence | Status in current sandbox |
|---|---|---|
| Approved Git commit and branch | commit SHA, review, protected release branch | NOT VERIFIED: checkout has no `.git` metadata |
| Lockfile clean install | `npm ci` or approved package-manager install from lockfiles | NOT VERIFIED as a fresh clean host |
| Backend/frontend checks | `npm run check`, build, audits | backend/build PASS; frontend has 2 moderate advisories |
| Immutable image digest | registry digest linked to commit | NOT VERIFIED; Docker CLI/registry unavailable |

## Database deployment

| Step | Required evidence |
|---|---|
| Create separate Production Supabase project | ref/region/plan record; never reuse test project |
| Run canonical migrations | 001–011 in [`BISIS_V1_CANONICAL_MIGRATION_ORDER.md`](BISIS_V1_CANONICAL_MIGRATION_ORDER.md), with ledger and fresh-database evidence |
| Exclude auxiliary/legacy SQL | do not run `005_execution_engine_policies.sql` as second migration; never use `database/legacy/schema.sql` |
| Verify schema | tables, columns, PK/FK, constraints, indexes, functions, triggers |
| Verify security | RLS on every exposed table, policies, grants, SECURITY DEFINER ACLs, search_path, advisors |
| Seed and smoke | seed only approved canonical data; auth/RLS/IDOR and Service Delivery live smoke |
| Backup gate | DB backup/PITR or logical dump plus independent Storage backup and restore drill |

## Docker and edge

1. Run `docker compose -f infrastructure/docker-compose.yml config` with a secret-managed env file and verify no secret is rendered into logs or image layers.
2. Build frontend and backend images from the approved commit; inspect image contents for `.env`, keys, credentials, test fixtures, and source artifacts not required at runtime.
3. Run `nginx -t` against the production edge configuration. Terminate TLS at a reviewed edge, redirect HTTP to HTTPS, configure HSTS, and preserve `/api/`, SPA fallback, and Socket.IO upgrade behavior.
4. Start the stack in staging and verify frontend, backend, nginx, restart policy, network isolation, client body limits, and healthchecks. `/api/live` must represent process liveness; `/api/ready` must prove database reachability; payment readiness must be an explicit decision rather than an accidental 200.
5. Verify CORS using the final HTTPS origin and an unlisted origin. The unlisted origin must not receive credentials or data. Verify `X-Request-Id`, generic 5xx responses, structured redaction, and no passwords/tokens/emails in logs.
6. Verify signed URL expiry, private bucket access, MIME/size limits, failed upload cleanup, and independent Storage backup/restore.

## Staging acceptance

The staging browser matrix must cover login/signup, role boundaries, client A/B isolation, staff workspace, project lifecycle, requirements, delivery/revision/approval, notification context, file upload/download, Socket.IO, mobile/tablet/desktop, Arabic RTL, English LTR, and Turkish LTR. Real Google OAuth and real payment are tested only if the owner configures their providers; they must not be replaced by fake success.

## Monitoring and launch

Before canary, configure uptime checks for the public HTTPS endpoint and `/api/live`, readiness/error-rate/latency/429/5xx alerts, Auth failure alerts, Storage error/size alerts, payment verifier/RPC alerts, log retention and redaction, and an incident contact. Open traffic gradually and keep a release owner watching the first window.

## Rollback

Rollback application containers to the previous immutable digest. Do not delete migrations or run guessed reverse SQL. For schema/data incidents, use PITR or restore to a separate Supabase project, then restore Storage objects from their independent backup. Rotate secrets immediately after compromise, rerun smoke and readiness checks, and document RTO/RPO and the decision owner.

## Current limitation

Docker, nginx, and Supabase CLI binaries are unavailable in the current sandbox, and no Production project, domain, TLS certificate, provider credentials, registry, CI workflow, monitoring account, or backup/restore target was provided. Those items remain owner/infrastructure gates, not hidden assumptions.
