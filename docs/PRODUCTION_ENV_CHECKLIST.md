# BİŞIŞ V1 — Production Environment Checklist

هذه القائمة لا تحتوي أسرارًا. تُنفذ على secret manager/hosting الخاص بالمالك، ولا تُحفظ القيم الحقيقية في Git أو Docker image أو frontend bundle إلا القيم `VITE_*` العامة.

## Target identity

| Check | Owner evidence | Status |
|---|---|---|
| Production Supabase project منفصل عن disposable test | project ref وregion وplan موثقون في سجل الإصدار | BLOCKED until owner provides |
| Production domain وHTTPS origin | hostname نهائي وTLS certificate/termination | BLOCKED until infra configured |
| `ALLOWED_ORIGINS` exact HTTPS allow-list | لا localhost ولا default domain | BLOCKED until domain exists |

## Backend secrets and runtime

| Variable | Classification | Required condition | Status |
|---|---|---|---|
| `NODE_ENV` | non-secret | must be `production` | pending deployment |
| `PORT` | non-secret | internal listener, normally `5000` | pending deployment |
| `SUPABASE_URL` | non-secret endpoint | Production project only | blocked by project identity |
| `SUPABASE_SERVICE_ROLE_KEY` | critical secret | server-side secret manager only; rotate/test access | blocked by secret manager |
| `ALLOWED_ORIGINS` | non-secret policy | exact HTTPS origins | blocked by domain |
| `TRUST_PROXY_HOPS` | non-secret policy | bounded 0–5; use `1` for the bundled nginx edge | pending edge validation |
| `WEB3_NETWORK` | non-secret config | `polygon` before real checkout | blocked by payment owner |
| `WEB3_RPC_URL` | provider credential/endpoint | Polygon mainnet RPC with quota and monitoring | blocked by payment owner |
| `USDC_CONTRACT_ADDRESS` | public contract config | reviewed Polygon USDC address | blocked by payment owner |
| `WEB3_RECIPIENT_ADDRESS` | public destination config | reviewed EOA; dual approval | blocked by payment owner |
| `WEB3_REQUIRED_CONFIRMATIONS` | non-secret config | owner-approved value; current example `12` | blocked by payment owner |
| `AI_PROVIDER` | feature boundary | keep `disabled` for V1 | READY as policy |
| `OPENAI_MODEL`, `OPENAI_API_KEY` | optional provider config/secret | provision only if AI scope is explicitly reopened | intentionally disabled |
| `LOG_LEVEL` | non-secret config | select level with redaction/retention | pending operations |
| `FRONTEND_URL` | non-secret reference | final HTTPS domain | blocked by domain |

## Frontend public build variables

| Variable | Rule | Status |
|---|---|---|
| `VITE_SUPABASE_URL` | Production URL only | blocked by project identity |
| `VITE_SUPABASE_ANON_KEY` | publishable/anon key only; never service-role | blocked by project identity |
| `VITE_API_URL` | empty for same-origin nginx proxy, or HTTPS API origin | blocked by domain/edge decision |
| `VITE_ENABLE_GOOGLE_OAUTH` | `false` until Google setup is complete | READY as default |
| `VITE_GOOGLE_CLIENT_ID` | public client ID only, no client secret | blocked if OAuth required |

## Secret handling gate

The release owner must confirm that real secrets are injected at runtime/build time through a managed secret store, are unavailable to frontend source except approved public variables, are excluded from Git and image layers, and are rotated after any test exposure. The owner must also confirm the reverse-proxy hop count so rate limiting uses the real client IP without trusting an unbounded forwarded chain. The local `.env` file is not a Production secret-management mechanism.

## Auth/provider gates

Supabase Auth must have the final Site URL, redirect allow-list, email/SMTP policy, password policy, leaked-password protection, rate limits, and captcha decision. Google Cloud OAuth requires the client ID, authorized origins, Supabase callback/redirect configuration, and a real staging login test. No fake callback or simulated provider success closes this checklist.

## Payment gate

Checkout remains blocked until the owner supplies and reviews the Polygon RPC, USDC contract, recipient EOA, confirmation policy, RPC outage handling, and a controlled real transaction verification. No mock transaction or fake confirmation is acceptable.

## Evidence required to mark complete

The release record must link to the exact commit, environment config version, Supabase project metadata, migration ledger, security advisor results, RLS/IDOR suite, Docker/edge validation, TLS test, backup/restore drill, staging browser acceptance, and monitoring alert test. A redacted checklist is the only safe artifact to attach to a ticket.
