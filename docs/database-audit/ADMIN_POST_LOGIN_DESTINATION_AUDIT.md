# ADMIN POST-LOGIN DESTINATION AUDIT (READ-ONLY)

**Document:** ADMIN_POST_LOGIN_DESTINATION_AUDIT.md  
**Date:** 2026-11-02  
**Status:** Investigation Complete

---

## EXECUTIVE SUMMARY

Admin users are landing on /dashboard instead of /admin because **LoginPage unconditionally navigates to /introduction after successful login** for both password and Google authentication. There is no role-based navigation logic.

**Root Cause:** LoginPage.tsx lines 147, 182 navigate to location.state?.from || '/introduction' regardless of user role.

---

## 1. LOGIN SUCCESS NAVIGATION (Evidence)

### Password login
**File:** rontend/src/pages/LoginPage.tsx:140-160
`	sx
const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault()
  // ... validation ...
  setSubmitting(true)
  try {
    await login(email.trim(), password)
    navigate(location.state?.from || '/introduction')  // Line ~147
  } catch (caught: unknown) {
    setError(mapAuthError(caught, t))
  } finally {
    setSubmitting(false)
  }
}
`
After calling login() (from AuthContext), navigates to intended destination or /introduction.

### Google OAuth
**File:** rontend/src/pages/LoginPage.tsx:162-177
`	sx
const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
  // ...
  try {
    const { error: authError } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: credentialResponse.credential,
    })
    if (authError) throw authError
    navigate(location.state?.from || '/introduction')  // Line ~182
  } catch (caught: unknown) {
    setError(mapAuthError(caught, t))
  }
}
`
Same - navigates to /introduction.

### Auto-redirect if already logged in
**File:** rontend/src/pages/LoginPage.tsx:136-138
`	sx
useEffect(() => {
  if (!loading && user) navigate('/introduction', { replace: true })
}, [loading, navigate, user])
`
If user already logged in and on login page, redirects to /introduction.

---

## 2. ROLE-BASED DESTINATION LOGIC

**Search results:** No role-based navigation logic found in LoginPage or AuthContext.  
No code checks user.role to determine destination.  
All users go to /introduction regardless of role.

**Intended destinations (from previous investigation):**
- Admin/super_admin need access to /admin 
- But login doesn't send them there
- They go to /introduction -> click button -> goes to / (home page)

---

## 3. DASHBOARD ROUTE ARCHITECTURE

### Routes
**File:** rontend/src/App.tsx
- /dashboard - renders <Dashboard /> (line ~472-475), not protected by RequireRole
- /admin - protected by RequireRole, only allows ['admin'] (line ~348-356) - **BUG FOUND IN PREVIOUS INVESTIGATION**
- /clients - protected, only allows ['admin']
- /workbench - protected, only allows ['admin']

### Dashboard component
**File:** rontend/src/pages/Dashboard.tsx
This is the client dashboard - shows orders, notifications, tickets, messages. Uses client-oriented UI components like ClientDeliveryHome.

**No admin dashboard component is used for /dashboard** - /admin route uses AdminPanel component.

### IntroductionPage
**File:** rontend/src/pages/IntroductionPage.tsx:43-71
After clicking \"Start\", navigates to / (home page). Not to dashboard or admin.

**Flow for admin:**
1. Login success -> navigate to /introduction
2. User clicks Start -> navigate to /
3. User ends up on home page or needs to navigate manually
4. Or if they go to /dashboard directly, they see client dashboard
5. If they try /admin, RequireRole blocks super_admin (only allows 'admin') and redirects to /dashboard

**So admin lands on client dashboard because:**
1. Login sends everyone to /introduction
2. No role-based routing
3. Even if they get to /dashboard, it's the client dashboard (not admin dashboard)
4. /admin is not accessible to super_admin due to the guard bug

---

## 4. AUTH TIMING

**LoginPage:** Calls login() from AuthContext, then immediately navigates to /introduction without waiting for user to be loaded/updated.  
AuthContext.login() does supabase.auth.signInWithPassword() and returns data, but doesn't wait for /auth/me to complete - the onAuthStateChange listener handles fetching user.

**Race condition:** Navigation happens before backend user data is fetched. User role not known at navigation time. But role isn't used for navigation anyway.

The auto-redirect useEffect (line 136-138) waits for !loading && user before redirecting to /introduction if already logged in. But in handleSubmit/handleGoogleSuccess, it navigates immediately without waiting.

**Not the root cause** of landing on client dashboard, but related to timing.

---

## 5. EXACT SEQUENCE FOR ADMIN

1. User goes to /login
2. Submits credentials -> login() called, Supabase authenticates
3. handleSubmit navigates to /introduction (line 147)
4. User lands on IntroductionPage
5. User clicks Start -> navigates to / (home page)
6. Or user could navigate to /dashboard directly and see client dashboard
7. If user tries /admin, RequireRole blocks (only allows 'admin', not 'super_admin') and redirects to /dashboard

**The \"landed on regular CLIENT dashboard\" symptom** could mean they navigated to /dashboard directly or were redirected there.

---

## 6. MINIMAL RECOMMENDED FIX

### Fix 1: Role-based navigation after login
In LoginPage, after login check user role and navigate accordingly:
`	sx
// After login
const { user } = useAuth() // but user may not be loaded yet
// Or better, navigate based on role after user loads
`

Or in AuthContext, add role-based redirect logic.

Or better: In LoginPage, after successful login, wait for user to load or fetch role, then navigate:
`	sx
try {
  await login(email.trim(), password)
  // Wait for user to be loaded
  // Or navigate based on location.state.from or role
  navigate(location.state?.from || getDefaultRoute(userRole))
} catch...
`

But LoginPage doesn't have access to updated user role until AuthContext updates. Need to wait or use a different approach.

**Better approach:** In AuthContext, after fetching user, store it and LoginPage can watch for user changes. But LoginPage already has useEffect to redirect if user exists (line 136-138) - it redirects to /introduction. Change that to role-based routing.

### Fix 2: Update LoginPage auto-redirect
`	sx
useEffect(() => {
  if (!loading && user) {
    const defaultRoute = (user.role === 'admin' || user.role === 'super_admin') ? '/admin' : '/introduction'
    navigate(location.state?.from || defaultRoute, { replace: true })
  }
}, [loading, navigate, user, location.state])
`

And in handleSubmit/handleGoogleSuccess, also use role-based routing or rely on the useEffect.

### Fix 3: Also fix the RequireRole issue from previous investigation
Add 'super_admin' to allowedRoles for /admin, /clients, /workbench in App.tsx.

---

## 7. REGRESSION TESTS

`	sx
describe('Post-login navigation', () => {
  it('navigates admin to admin dashboard', async () => {
    const mockUser = { id: '1', role: 'admin' };
    vi.mocked(useAuth).mockReturnValue({ user: mockUser, loading: false, login: vi.fn() } as any);
    
    render(<MemoryRouter initialEntries={['/login']}><LoginPage /></MemoryRouter>);
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/\/admin/), expect.any(Object));
    });
  });
  
  it('navigates client to introduction', async () => {
    const mockUser = { id: '1', role: 'client' };
    vi.mocked(useAuth).mockReturnValue({ user: mockUser, loading: false, login: vi.fn() } as any);
    
    render(<MemoryRouter initialEntries={['/login']}><LoginPage /></MemoryRouter>);
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/introduction', expect.any(Object));
    });
  });
  
  it('respects intended destination if provided', async () => {
    const mockUser = { id: '1', role: 'client' };
    vi.mocked(useAuth).mockReturnValue({ user: mockUser, loading: false, login: vi.fn() } as any);
    
    render(<MemoryRouter initialEntries={['/login']} state={{ from: '/packages' }}><LoginPage /></MemoryRouter>);
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/packages', expect.any(Object));
    });
  });
});
`

---

## CONCLUSION

**Exact navigation sequence:** LoginPage calls login() then immediately navigates to /introduction (or location.state.from) regardless of role. If already logged in, useEffect navigates to /introduction.

**Source of destination choice:** rontend/src/pages/LoginPage.tsx lines 147, 182, 137

**Admin dashboard exists:** Yes, rontend/src/pages/AdminPanel.tsx rendered at /admin route

**Problem:** **Login navigation** - no role-based routing after login. Also **route protection issue** prevents super_admin from accessing /admin even if routed there.

**Minimal fix:** Add role-based navigation in LoginPage (useEffect and/or after login) to route admins to /admin. Also fix RequireRole to allow super_admin (from previous investigation).
