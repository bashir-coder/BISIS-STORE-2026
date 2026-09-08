# BİŞIŞ V1 — Launch Map

## Runtime flow

```text
User
  ↓
React/Vite frontend
  ↓ Supabase session access token
Node/Express API
  ↓
Supabase Auth validation + public.users profile
  ↓
Supabase Postgres (RLS) ───────→ Optional Storage (only after an approved private V1 contract)
  ↓
Canonical packages/services/orders
  ↓
Payment verifier (Polygon USDC; fail-closed when unconfigured)
  ↓
Order events / notifications / Socket.IO conversation access
```

## Source-of-truth map

| Layer | Runtime source | Verified state |
|---|---|---|
| Frontend | `frontend/src/`, Vite config | React 18 + TypeScript؛ `/clients` Client 360 و`/workbench` Workbench و`/projects/:id` Project Workspace مبنية فوق endpoints الحالية |
| Backend | `backend/server.js`, `backend/src/` | Express API, Supabase sessions, rate limits, private file URLs |
| Database | `database/migrations/001–011` | Canonical chain موثقة ومتحقق من ترتيبها محليًا؛ clean fresh-chain rehearsal ما زالت gate خارجية |
| Seed | `backend/scripts/seed-data.js`, `database/seeds/` | Idempotent؛ 18 services, 3 packages, 3 personas, 3 FAQs، ومصدر ترجمة موحد؛ يلزم rerun verification على Production المقصود قبل الإطلاق |
| Auth | Supabase Auth + `public.users` trigger | Customer A/B login and profile contract verified; persona persistence is self-scoped through `/api/users/me/persona` |
| Storage | Backend file boundary؛ لا bucket contract عام مفترض | لا تُنشأ bucket أو policies من التخمين؛ يلزم اعتماد Storage contract واختبار upload/signed URLs/backup قبل Production |
| Payment | `backend/src/services/payment-verifier.js` | Server package price lookup وfail-closed config؛ real verification awaits owner-approved provider configuration |
| Realtime | Socket.IO in `backend/server.js` | Supabase token/profile auth and conversation access checks present |
| Deployment | `infrastructure/docker-compose.yml`, nginx | Static configuration present; Docker runtime not executed because CLI unavailable |

## Launch surface classification

| Surface | Classification | Reason/action |
|---|---|---|
| Home, About, Packages, FAQ, Contact | Required for launch | Public catalog and explanation surfaces |
| Login/register with email/password | Required for launch | Login flow and `/register` signup surface verified; Auth smoke uses Customer A/B |
| Google OAuth | Safe to disable until configured | Button is hidden unless `VITE_ENABLE_GOOGLE_OAUTH=true` and `VITE_GOOGLE_CLIENT_ID` are both present; external setup remains |
| Services route | Required for launch | `/services` redirects to canonical `/packages` catalog; no blank deep link remains |
| Dashboard and order history | Required for launch | Live API smoke and session gating verified |
| Onboarding | Required after authentication | `/onboarding` redirects unauthenticated visitors to login and uses the existing persona selector after session |
| Payment | Blocked until external configuration | UI/API remain fail-closed؛ verifier غير مهيأ يعني لا checkout ولا real funds؛ لا real payment success ضمن هذا المستودع |
| Chat/order conversation | Required for launch for authenticated order support | IDOR and session authorization verified; no public fake order chat is exposed |
| Admin panel | Required for operations after staff setup | Temporary super_admin browser session displayed Catalog Manager; API CRUD/archive/cache and client 403 tests passed; browser create/edit passed, archive dialog was not completed after browser timeout and API archive is the decisive evidence |
| Blog/resources | Safe to disable | Placeholder-only page removed from routes/navigation |
| Portfolio | Safe to disable | Placeholder/generated content removed from routes/navigation |
| Digital products | Safe to disable | Hardcoded products bypass canonical package/order contract; route removed |
| Donations and life plan | Post-launch / out of V1 | No core V1 backend journey; routes removed from public runtime |

## Dead or risky paths found

The former public surfaces contained inaccurate service counts, unverified 24/7/payment claims, placeholder contact links, and direct payment navigation without a canonical package ID. These were corrected or hidden. Backend still mounts secondary routes such as blog, donations, digital products, subscriptions, and projects for compatibility, but they are not exposed from the V1 frontend navigation and remain deferred until their contracts are independently verified.

## Environment classification

| Variable group | Classification | Handling |
|---|---|---|
| Supabase URL and service-role key | Required before backend deployment; service-role is dangerous if exposed | Backend only; never place service-role in Vite variables |
| VITE Supabase URL/anon key | Required for frontend | Public bundle values; use anon key only |
| ALLOWED_ORIGINS and VITE_API_URL | Required before production | Must be replaced with actual production domain |
| Polygon RPC, USDC contract, recipient, confirmations | Required before enabling payments | No fake values; blocked until valid |
| VITE_GOOGLE_CLIENT_ID | Optional until Google is enabled | Empty value hides button safely |
| OpenAI/email/Telegram/reCAPTCHA | Optional or secondary | Do not block Core V1 unless the related feature is enabled |
| JWT/Redis legacy values | Unused/legacy | Not part of the V1 environment contract |
