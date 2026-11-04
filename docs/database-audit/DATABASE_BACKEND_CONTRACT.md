# DATABASE BACKEND CONTRACT (Preliminary)

**Document:** DATABASE_BACKEND_CONTRACT.md  
**Audit Date:** 2026-11-01  
**Status:** AUDIT IN PROGRESS

---

## 1. Authentication Flow

### Supabase Auth → Backend
1. Frontend uses supabase.auth.signInWithOAuth({ provider: 'google' }) (Google-only now)
2. Backend middleware uthenticate() gets token from Authorization: Bearer <token>, calls supabase.auth.getUser(token), finds/provisions user in public.users
3. Role resolution in middleware checks pp_metadata?.role, aw_app_meta_data?.role, user_metadata?.role (but only accepts from VALID_ROLES) - defaults to 'client'
4. Backend also syncs verification status from auth
5. /auth/me returns eq.user from DB

**Critical:** The middleware trusts Supabase Auth metadata for role during provisioning via esolveRole(), but only allows valid roles and defaults to client. Also it reads from DB after finding user - so DB is source of truth for existing users. For new users created via indOrProvisionUser, it builds profile from auth metadata. The DB trigger handle_supabase_auth_user() also creates users on auth.users insert with role 'client' and provider normalized.

**Note:** Auth middleware does supabase.auth.getUser(token) using service role client - has admin privileges.

### Authorization
- uthorize(...roles) checks eq.user.role against allowed roles
- Backend uses service role for most DB operations (bypasses RLS)
- Some operations might rely on RLS if using anon key, but config shows service role key used

---

## 2. Workspace Isolation

- canAccessWorkspace() checks if user is super_admin OR member in workspace_members
- Auth routes filter workspaces for non-super_admin based on memberships
- Backend likely enforces workspace checks in routes using canAccessWorkspace() or direct queries

---

## 3. Execution Engine / Project Access

From migration 005, RLS uses execution_role(), execution_is_staff(), execution_can_access_project() (SECURITY DEFINER functions in public). These functions query public.users and check memberships. Backend might also use these patterns.

---

## 4. Potential Contract Issues

### Role Synchronization
- Middleware can read role from auth metadata during provisioning
- But DB is canonical after provisioning (reads from users table)
- Need to ensure no path allows privilege escalation via client-supplied data
- The /auth/me returns user from DB - good

### Google-only enforcement
Recent commit says \"feat(auth): enforce Google-only sign-in\" - need to verify implementation

---

## 5. Next Steps

Examine more backend routes, especially for orders/payments/projects/tickets to understand full contract.
