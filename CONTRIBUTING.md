# Contributing to BİŞIŞ V1

## Before opening a change

Read `README.md`, `SECURITY.md`, and the relevant document under `docs/`. BİŞIŞ V1 is intentionally scope-limited; do not add AI, agents, real payment flows, provider credentials, legacy migration support, or production configuration as part of a routine change.

## Local setup

Use Node.js 22.x and install from the repository root:

```bash
npm run install:all
```

The backend reads its local environment from the repository-root `.env`; the frontend reads only `frontend/.env` and public `VITE_*` values. Copy the appropriate `.env.example` file and keep the real files untracked.

## Validation

Run the focused checks while iterating, then the full release gate:

```bash
npm run migration:check
npm run env:check
npm run deployment:check
npm run secrets:check
npm run check
npm run release:check
```

Do not use service-role credentials to claim that a client can access a resource. RLS and IDOR claims require authenticated client sessions against a disposable/staging environment.

## Database changes

Do not edit or delete migrations `001` through `007`. Additive migrations must be numbered, idempotent where practical, added to `scripts/validate-migration-chain.mjs`, and documented in `docs/BİŞİŞ_V1_CANONICAL_MIGRATION_ORDER.md`. Never use `database/legacy/schema.sql` as the V1 source of truth.

## Pull requests

Explain the reason for the change, the files touched, the commands run, and any known limitation or external owner input still required. Do not attach secrets, raw logs, private customer data, or unredacted staging evidence.
