# BİŞIŞ V1 — Free Deployment Guide

## Purpose and boundary

This guide prepares BİŞIŞ V1 for a zero-cost staging or canary deployment. It does not select a hosting provider, create an account, configure DNS/TLS, publish a repository, enable real payments, or claim production readiness. Those actions require owner-controlled infrastructure and credentials.

The current architecture has two runtime parts. The Vite frontend is a static bundle and can run on a static-hosting service. The Express backend is a long-running Node.js service and must run on a service that supports a persistent HTTP process, or inside the provided Docker Compose topology. Supabase remains the database/Auth system and is not replaced by the deployment provider.

## Recommended $0 topology

For a same-origin deployment, place the frontend, backend, and edge proxy behind one HTTPS origin. The included Compose topology uses Nginx to serve the static frontend, proxy `/api/` and `/socket.io/` to the backend, and preserve WebSocket upgrade headers. In this shape, set `VITE_API_URL` to an empty value so the frontend uses the current origin for API calls.

A split deployment is also possible: publish the frontend as static assets and run the backend separately. In that case, `VITE_API_URL` must be the complete HTTPS backend origin, and backend `ALLOWED_ORIGINS` must contain the exact HTTPS frontend origin. Do not use `*` for authenticated production traffic and do not use localhost values outside local development.

| Component | Required capability | Free-tier constraint to verify before choosing a provider |
|---|---|---|
| Frontend | Static file hosting with SPA fallback to `index.html` | HTTPS, client-side route fallback, environment injection at build time |
| Backend | Long-running Node.js process or Docker | HTTPS ingress, health checks, WebSocket support for Socket.IO, non-sleeping behavior acceptable for the intended use |
| Edge | Same-origin reverse proxy, or correct cross-origin CORS | TLS termination, `/api/` and `/socket.io/` forwarding, body-size limit |
| Supabase | Staging/production project selected by owner | Correct Auth redirect URLs, database backups, RLS verification, provider limits |

## Repository-root install and checks

Use Node.js 22.x for local and CI parity. Install from the repository root, not from `frontend/`:

```bash
npm run install:all
npm run migration:check
npm run env:check
npm run deployment:check
npm run secrets:check
npm run check
npm run release:check
```

The deployment validator is static. It verifies file contracts but does not run Docker, `nginx -t`, TLS, or a remote provider deploy. The current release gate intentionally allows the two known moderate React Router advisories because the available forced remediation is a breaking major upgrade; do not run `npm audit fix --force` without a separate compatibility review.

## Environment contract

Create secrets through the deployment provider's secret manager or an untracked local file. Never commit real values. The backend reads the repository-root `.env` in local development; it does not read `backend/.env`. The frontend reads only public `VITE_*` variables at build time.

### Backend runtime

| Variable | Required | Meaning |
|---|---:|---|
| `NODE_ENV` | Yes | Use `production` for a production-like deployment. |
| `PORT` | Usually | The service port; the bundled topology uses `5000`. |
| `SUPABASE_URL` | Yes | The selected Supabase project URL. Must be the intended Staging or Production project, never assumed from an old local file. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only Supabase key. Never expose it to the frontend, logs, Docker build args, or GitHub Actions output. |
| `ALLOWED_ORIGINS` | Yes in production | Comma-separated exact frontend origin(s). Required by the backend in production. |
| `TRUST_PROXY_HOPS` | Recommended | Bounded integer from 0 to 5; use `1` behind the bundled single proxy and verify the actual topology. |
| `LOG_LEVEL` | Optional | Operational log level. Do not log tokens, cookies, authorization headers, or full request bodies. |
| `FRONTEND_URL` | Optional reference | Operational reference only in the current core runtime; it is not a replacement for `ALLOWED_ORIGINS`. |

### Frontend build variables

| Variable | Required | Meaning |
|---|---:|---|
| `VITE_SUPABASE_URL` | Yes | Public Supabase project URL selected for this build. |
| `VITE_SUPABASE_ANON_KEY` | Yes | Public Supabase anon/publishable key. It is visible in the bundle; access control must come from RLS, not secrecy. |
| `VITE_API_URL` | Yes by contract | Empty for same-origin proxying; otherwise the complete HTTPS backend origin. |
| `VITE_ENABLE_GOOGLE_OAUTH` | Default false | Keep false until Google OAuth is configured and tested end to end. |
| `VITE_GOOGLE_CLIENT_ID` | Only with Google | Public OAuth client ID for the selected environment; never put the client secret here. |

`SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` are not the current application runtime names. Use `VITE_SUPABASE_ANON_KEY` in the frontend and `SUPABASE_SERVICE_ROLE_KEY` in the backend, matching the repository's code and example contract.

### Explicitly gated optional integrations

AI remains disabled with `AI_PROVIDER=disabled`. Payment checkout must remain disabled until the owner supplies and reviews a Polygon RPC URL, the correct USDC contract for the selected network, a reviewed recipient address, and a confirmation policy; no private wallet key is part of the current backend contract. Google OAuth requires Supabase provider configuration, an approved Google client ID/secret, exact redirect URLs, and a real browser test. SMTP, Telegram, Redis, Resend, reCAPTCHA, and Solana variables are not current core runtime requirements unless a separately reviewed integration is enabled and tested.

## Docker Compose path

From `infrastructure/`, provide the required variables to Compose and run only after reviewing the target project and environment:

```bash
cd infrastructure
# supply variables through the provider secret manager or an untracked .env
# docker compose config
# docker compose build
# docker compose up -d
# docker compose ps
```

The provided topology expects `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `ALLOWED_ORIGINS`. It also passes optional payment and AI variables through the backend container. `docker compose config` should be treated as a preflight because it can render environment values; do not paste its output into issues, logs, or chat.

The backend health endpoint is `/api/ready`; the edge health check is `/`. The backend readiness check depends on the configured Supabase connection. Liveness and readiness should be monitored separately by the selected host. The included static validator cannot prove that the Docker daemon, Nginx configuration, TLS, or remote health checks work.

## Static frontend plus separate backend path

Build the frontend with the public variables only:

```bash
cd frontend
npm ci
npm run build
```

Publish `frontend/dist` with SPA fallback enabled. The provider must serve `index.html` for application routes such as `/login`, `/dashboard`, and `/client-portal`. Set `VITE_API_URL` at build time to the public HTTPS backend origin when the backend is separate. The backend must receive the matching frontend origin in `ALLOWED_ORIGINS` and must be reachable over HTTPS.

Do not pass `SUPABASE_SERVICE_ROLE_KEY`, OAuth client secrets, SMTP passwords, payment private keys, or other server credentials as frontend build arguments. `VITE_*` values are public after compilation.

## Supabase and release sequence

The owner must first identify the intended Supabase project and classify it as disposable Staging or Production. Never run a reset, destructive cleanup, seed, or experimental migration against Production. Apply the canonical chain `001` through `011` only through an approved migration process, with historical migrations `001`–`007` unchanged. `database/legacy/schema.sql` is not a V1 source of truth.

After applying the chain to a fresh disposable project, verify table and foreign-key metadata, RLS and policies, triggers and functions, Auth provisioning, and authenticated Customer A/B isolation using publishable/anon-key sessions rather than service-role calls. Confirm the Storage contract before creating buckets; this repository does not invent a bucket or policy design when none is specified.

Configure Supabase Auth redirect URLs for the exact frontend origin. If Google is enabled, configure the provider callback URL shown by Supabase and the matching Google OAuth consent/client settings. Test signup, email delivery, login, refresh, logout, and Google only with real provider responses; never mark a mock response as success.

## Rollback sequence

For an application rollback, first stop the new release or route traffic back to the last known-good immutable image/static bundle. Keep the database migration state unchanged unless the migration has an owner-approved rollback procedure; do not reverse schema changes by guessing or by deleting data. Disable a newly enabled optional integration through its feature/config boundary, preserve redacted logs and timestamps, and investigate before retrying.

For a database incident, stop writes if necessary, preserve evidence without secrets, consult the provider's point-in-time backup/restore capabilities, and restore only into an explicitly identified target. Validate schema, RLS, Auth linkage, and application compatibility before returning traffic. Backup availability and restore timing are external provider responsibilities and are not proven by this repository.

## Owner inputs still required before real Production

A real Production GO requires an owner-selected Supabase Production project, managed secrets, a public HTTPS domain and TLS, a backend host supporting the required process and WebSockets, a static frontend host or edge, configured CORS and Auth redirect URLs, a tested backup/restore plan, monitoring/alerting, an explicit Storage design if files are part of launch, and separately approved Google/payment/SMTP decisions. None of these should be inferred from the Staging project or from local `.env` files.
