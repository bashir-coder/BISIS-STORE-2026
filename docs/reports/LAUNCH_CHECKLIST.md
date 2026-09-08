# BİŞIŞ V1 — Launch Checklist

## Evidence-backed

- [x] V1 source of truth is `database/migrations/001_launch_contract.sql`; legacy schema is not used at runtime.
- [x] Reconciliation migrations 002, 003, and 004 are applied to the confirmed Supabase test project and verified through metadata/REST.
- [x] Seed runner is idempotent and current V1 seed counts are 18 services, 3 packages, 3 personas, 3 FAQs, and 690 translation rows (230 keys × 3 languages).
- [x] Supabase Auth provisions `public.users` automatically for Customer A and Customer B.
- [x] `auth.users.id = public.users.id` and `role = client` were verified for both test customers.
- [x] Backend syntax, tests, lint, typecheck, and frontend production build pass.
- [x] Backend health endpoint returns HTTP 200 from the current runtime.
- [x] Public catalog and authenticated account API smoke pass for both test customers.
- [x] Cross-user IDOR attempts for profiles/workspaces/orders/conversations/messages/invoices/notifications/files were denied or isolated, and temporary fixtures were cleaned.
- [x] `order-files` bucket is private and backend download uses authorization plus signed URLs.
- [x] Payment fails closed when verifier configuration is absent; invalid transaction hashes do not create orders.
- [x] Google button is hidden unless `VITE_ENABLE_GOOGLE_OAUTH=true` and `VITE_GOOGLE_CLIENT_ID` are both configured.
- [x] Placeholder routes for blog, portfolio, digital-products, donations, and life-plan are removed from the public V1 router/navigation.
- [x] Homepage and chatbot claims were corrected to the verified V1 scope.
- [x] `.env.example` and `frontend/.env.example` exist without real secrets; `.gitignore` excludes local env files and sensitive artifacts.

## Required before production

- [ ] Confirm the actual Supabase production project and production domain.
- [ ] Configure production environment variables in a secret store.
- [ ] Verify no secrets are tracked in the release Git repository. The supplied project directory had no `.git` metadata, so this remains externally verifiable.
- [ ] Apply and verify migrations on the production project.
- [ ] Run the idempotent seed against the intended production catalog.
- [ ] Configure `ALLOWED_ORIGINS` and `VITE_API_URL` for the production domain.
- [ ] Configure Polygon RPC, USDC contract, recipient EOA, and required confirmations.
- [ ] Complete a testnet payment end-to-end and verify order state transitions and replay protection.
- [ ] Decide and implement the `is_verified` synchronization semantics before using it for business authorization.
- [ ] Set `VITE_ENABLE_GOOGLE_OAUTH=true`, configure Google OAuth in Google Cloud and Supabase, then complete browser E2E.
- [ ] Run Docker Compose config/build/up and healthchecks on a host or CI runner with Docker.
- [ ] Verify nginx API proxy, SPA deep links, and Socket.IO upgrade behavior in the deployment topology.
- [ ] Verify private Storage upload/download end-to-end with an owned order and a cross-user denial.
- [x] Browser-checked `/`, `/login`, `/register`, `/verify-email`, `/packages`, `/services` redirect, `/payment` blocked state, `/dashboard` unauthorized state, `/admin` unauthorized state, `/chat`, and `/about`.
- [ ] Complete authenticated browser checks for `/dashboard`, `/onboarding` persona selector, and the admin CRUD workflow.
- [ ] Establish rollback and backup procedure for the production Supabase project.

## Release decision

**Current decision: READY AFTER EXTERNAL CONFIGURATION.** The local code and test gates are materially complete, but the unchecked production and external-integration items are launch gates, not optional polish.
