# DATABASE BASELINE

**Document:** DATABASE_BASELINE.md  
**Audit Date:** 2026-11-01  
**Status:** AUDIT IN PROGRESS

---

## 1. ENVIRONMENT REFERENCES (No Secrets)

### Production
- Project name: bisis-platform
- Reference: jsfhjwezbbcqvmhopjix
- Public URL pattern: https://jsfhjwezbbcqvmhopjix.supabase.co

### Staging  
- Project name: bisis-platform-staging
- Reference: ebzsffbsdezumfqlhfyq
- Public URL pattern: https://ebzsffbsdezumfqlhfyq.supabase.co

---

## 2. MIGRATION BASELINE

### Canonical chain (database/migrations/)
001-019 (20 files). Note 005 has two files with same prefix.

### Local additions
020 in database/migrations_local/

### Migration tracking
Migrations appear to use tracker tables managed by runner (per scripts/inventory-database-migrations.mjs and run-migrations.js references to _BISI_migrations, _bisis_migration_attempts)

---

## 3. KEY ARCHITECTURAL DECISIONS

### Authentication
- Supabase Auth with Google OAuth only (enforced)
- Custom trigger creates user in public.users
- Backend middleware provisions users and syncs verification
- Role stored in public.users.role (canonical source per requirements)
- Auth metadata can influence role only during provisioning with validation

### Authorization Model
- Hybrid: Backend uses service role (bypasses RLS) with application-level checks
- RLS policies exist for defense in depth
- Workspace-based isolation via workspace_members
- Execution engine uses SECURITY DEFINER functions for complex permission checks
- Staff roles: super_admin, admin, manager, editor (can access execution features)
- Client role: limited access

### Schema Organization
- Core tables in public
- Execution engine tables in public
- Digital products in public
- Storage handled via Supabase Storage buckets

### Payment Integration
- NOWPayments (crypto) - migration 013
- Payment flow with payment_status tracking

---

## 4. CRITICAL FILES

- Backend config: ackend/src/config/supabase.config.js (service role)
- Auth middleware: ackend/src/api/middleware/auth.middleware.js
- Auth routes: ackend/src/api/routes/auth.routes.js
- Migration runner: ackend/scripts/run-migrations.js
- Migration inventory: scripts/inventory-database-migrations.mjs

---

## 5. NOTES

- Existing local changes (64 files modified) must be preserved
- Many worktrees exist in .kilo/worktrees/
- This is audit only - no changes to be made
