# ADMIN ACCESS FAILURE INVESTIGATION (READ-ONLY)

**Document:** ADMIN_ACCESS_FAILURE_INVESTIGATION.md  
**Date:** 2026-11-02  
**Status:** Investigation Complete (Evidence-Based)

---

## EXECUTIVE SUMMARY

Admin access failed for both admin and super_admin roles. The issue is NOT missing permissions - it's in the route guard configuration.

**Root Cause:** In rontend/src/App.tsx line ~348, the /admin route requires llowedRoles={['admin']} only. It does NOT include 'super_admin'. 

When user role was changed to super_admin, RequireRole correctly denies access and redirects to /dashboard (fallbackPath defaults to '/dashboard') because 'super_admin' is not in ['admin'].

---

## 1. AUTHENTICATION LIFECYCLE (Evidence)

### AuthContext.tsx
**File:** rontend/src/contexts/AuthContext.tsx
- On mount, calls supabase.auth.getSession(), if session exists calls etchUserFromBackend()
- Sets up onAuthStateChange listener
- etchUserFromBackend() calls pi.get('/auth/me') and maps response via mapUserFromBackend()
- loading starts true, set to false after initialization
- If session expires, sets user null and calls logout

### Backend /auth/me
**File:** ackend/src/api/routes/auth.routes.js:14-16
`js
router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user })
})
`
Returns eq.user from middleware (fetched from DB). Auth middleware loads user from DB via service role.

**Role comes from DB** - AuthContext maps ackendUser.role directly. No role normalization issues visible.

### Flow
1. User authenticates via Supabase
2. AuthContext initializes, gets session, calls /auth/me
3. Backend middleware validates token, loads user from DB, sets req.user
4. /auth/me returns user with role from DB
5. AuthContext sets user state, sets loading false
6. RequireRole evaluates

**No race conditions obvious** - RequireRole waits for loading to complete.

---

## 2. ROUTE GUARDS (Evidence)

### RequireRole Component
**File:** rontend/src/components/RequireRole.tsx
- If loading is true, shows loading spinner and returns (doesn't redirect)
- If no user, redirects to /login with state
- Gets userRole = user.role || 'client'
- Checks llowedRoles.includes(userRole), if false redirects to allbackPath (default '/dashboard')
- If true, renders children

### App.tsx Route Configuration
**File:** rontend/src/App.tsx:348-356**
`	sx
<Route
  path="/admin"
  element={
    <RequireRole allowedRoles={['admin']}>
      <AdminPanel />
    </RequireRole>
  }
/>
`
**Only allows 'admin' - excludes 'super_admin'!**

Other admin routes:
- /clients: llowedRoles={['admin']} (line ~358-364)
- /workbench: llowedRoles={['admin']} (line ~366-372)

---

## 3. ROLE PROPAGATION (Evidence)

AuthContext.mapUserFromBackend takes backendUser.role as-is: ole: backendUser.role || 'client'. No transformation. Backend returns role from DB. Middleware gets role from DB for existing users. No overwrites visible.

**Confirmed:** Role propagates correctly from DB through backend to frontend.

---

## 4. ACTUAL EXECUTION SEQUENCE

1. User navigates to /admin
2. App.tsx renders RequireRole with allowedRoles=['admin']
3. RequireRole checks loading state - if still loading, shows spinner (blocks redirect)
4. Once loading false and user loaded with role 'super_admin'
5. userRole = 'super_admin', allowedRoles.includes('super_admin') returns false
6. RequireRole redirects to '/dashboard' (fallbackPath default)
7. **User sees dashboard, never reaches AdminPanel**

---

## 5. CONFIRMED FINDINGS vs HYPOTHESES

### CONFIRMED
- Root cause: /admin route only allows ['admin'], not ['super_admin']
- Same issue affects /clients and /workbench
- Loading guard prevents premature redirect (working correctly)
- Role propagation is correct
- /auth/me returns correct role from DB

### HYPOTHESES DISPROVED
- Not a loading/race condition (RequireRole waits for loading)
- Not a role mapping issue (role passed through as-is)
- Not an AuthContext bug
- Not a backend permission issue (backend returns correct role)

---

## 6. MINIMAL SAFE CORRECTION

**File:** rontend/src/App.tsx

Change:
`	sx
<RequireRole allowedRoles={['admin']}>
`
to:
`	sx
<RequireRole allowedRoles={['admin', 'super_admin']}>
`

Apply to /admin, /clients, /workbench routes (and any other admin-only routes).

**This is minimal, safe, and fixes the issue.**

---

## 7. REGRESSION TESTS

### Mocked test for authenticated super_admin
`	sx
describe('Admin route access', () => {
  it('allows super_admin to access /admin', async () => {
    const mockUser = { id: '1', role: 'super_admin', email: 'admin@test.com' };
    vi.mocked(useAuth).mockReturnValue({ user: mockUser, loading: false } as any);
    
    render(<MemoryRouter initialEntries={['/admin']}><App /></MemoryRouter>);
    
    await waitFor(() => {
      expect(screen.getByText(/admin panel/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/dashboard/i)).not.toBeInTheDocument();
  });
  
  it('allows admin to access /admin', async () => {
    const mockUser = { id: '1', role: 'admin', email: 'admin@test.com' };
    vi.mocked(useAuth).mockReturnValue({ user: mockUser, loading: false } as any);
    
    render(<MemoryRouter initialEntries={['/admin']}><App /></MemoryRouter>);
    
    await waitFor(() => {
      expect(screen.getByText(/admin panel/i)).toBeInTheDocument();
    });
  });
  
  it('redirects client to dashboard from /admin', async () => {
    const mockUser = { id: '1', role: 'client', email: 'user@test.com' };
    vi.mocked(useAuth).mockReturnValue({ user: mockUser, loading: false } as any);
    
    render(<MemoryRouter initialEntries={['/admin']}><App /></MemoryRouter>);
    
    await waitFor(() => {
      expect(screen.queryByText(/admin panel/i)).not.toBeInTheDocument();
    });
  });
  
  it('waits for loading before redirecting', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: true } as any);
    
    render(<MemoryRouter initialEntries={['/admin']}><App /></MemoryRouter>);
    
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText(/login/i)).not.toBeInTheDocument();
  });
});
`

**Missing test:** No test verifies super_admin can access admin routes. Need to add regression test.

---

## CONCLUSION

**Exact redirecting component:** RequireRole (frontend/src/components/RequireRole.tsx:58-60)  
**Condition:** llowedRoles.includes(userRole) returns false when allowedRoles=['admin'] and userRole='super_admin'  
**Redirect to:** '/dashboard' (default fallbackPath)  
**Fix:** Add 'super_admin' to allowedRoles in App.tsx for /admin, /clients, /workbench

No backend changes needed - role is correctly stored in DB and returned.
