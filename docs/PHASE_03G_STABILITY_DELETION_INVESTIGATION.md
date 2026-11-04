# BEŞİR — Phase 03G: Stability & Deletion Impact Investigation (Final Report)

**Role:** Diagnostic / read-only audit. No files modified, committed, pushed, reset, stashed, or discarded.  
**Branch:** `master` | **HEAD:** `2c5613c` | **Working tree:** dirty (pre-existing + 03D/03E changes preserved).

---

## 1. Executive summary

Five tests are currently failing across three test files. Root causes established:

| # | Test file | Failing test | Root cause | Category |
|---|-----------|--------------|------------|----------|
| 1 | `RequireRole.test.tsx` | renders loading indicator while loading | `RequireRole` returns `null` when `loading`; test expects `getByRole('status')` element | Test expectation vs component behavior mismatch |
| 2 | `AuthContext.test.tsx` | clears BİŞİŞ_user and BİŞİŞ_token on logout | Test mocks `supabase.auth.signOut: vi.fn()` → returns `undefined`; `AuthContext.logout` does `const { error } = await supabase.auth.signOut()` → destructuring `undefined` throws | Test mock issue (mock doesn't return a promise) |
| 3 | `AuthContext.test.tsx` | dispatches auth-changed event on logout | Same as #2 — unhandled rejection prevents `waitFor` from resolving | Test mock issue |
| 4 | `LoginPage.test.tsx` | shows session expired message when location.state.sessionExpired is true | Test sets `location.state.sessionExpired=true` but LoginPage reads `useAuth().sessionExpired` (mocked `false`); component never renders the message | Test expectation vs component behavior mismatch |
| 5 | `LoginPage.test.tsx` | preserves redirect destination from location.state.from on successful login | LoginPage hardcodes `navigate('/introduction')` on success, ignoring `location.state.from` | Production code limitation (pre-existing behavior) |

**RequireRole "syntax error" claim is FALSE.** `RequireRole.tsx` is valid TypeScript (typecheck passes cleanly). It is actively used by `App.tsx` for admin route protection. No syntax error exists — the earlier report was incorrect.

**Deleted files (ChatPage, AIChatbot, chat.routes.js, personas.routes.js):** Zero active code references found in `frontend/src` or `backend/src`. All remaining mentions are confined to `docs/` documentation. Deletions are clean — no dangling code references, no runtime 404/500 risk from code.

**All failures pre-date the 03D/03E sessions.** Git history shows `RequireRole.tsx`, `AuthContext.tsx`, and `LoginPage.tsx` were last modified in commits `2c5613c`/`7541060`/`ea32c51` (pre-phase baseline). The 03D/03E sessions did not touch `AuthContext.tsx` or `RequireRole.tsx`, and touched `LoginPage.tsx` only for a one-line error-color class (`text-red-300` → `text-destructive`) unrelated to these failing tests.

---

## 2. Five-test failure breakdown

### 2.1 RequireRole.test.tsx — "renders loading indicator while loading"

**Exact error:**
```
TestingLibraryElementError: Unable to find an accessible element with the role "status"
There are no accessible roles.
```
**Relevant assertion:** `src/components/__tests__/RequireRole.test.tsx:36` — `expect(screen.getByRole('status')).toBeTruthy()`
**Component behavior:** `RequireRole.tsx:19-21` — `if (loading) { return null; }`
**Root cause:** Test mocks `useAuth` to return `{ user: null, loading: true }` and expects a `status` role element, but `RequireRole` renders `null` during loading. The test was written against a component behavior (rendering a loading/status indicator) that `RequireRole` does not implement.
**Verdict:** Test expectation mismatch. Component behaves as coded; test asserts a UI that doesn't exist.

### 2.2 AuthContext.test.tsx — "clears BİŞİŞ_user and BİŞİŞ_token on logout"

**Exact error:**
```
TypeError: Cannot destructure property 'error' of '(intermediate value)' as it is undefined.
    at logout src/contexts/AuthContext.tsx:74:13
    const { error } = await supabase.auth.signOut();
```
**Relevant assertion:** `src/contexts/__tests__/AuthContext.test.tsx:83-86` — `waitFor(() => { expect(localStorage.getItem('BİŞİŞ_user')).toBeNull(); ... })`
**Root cause:** Test mocks `supabase.auth.signOut: mockSignOut` where `mockSignOut = vi.fn()` returns `undefined` (not a resolved promise). `AuthContext.logout:74` does `const { error } = await supabase.auth.signOut()` → `await undefined` → `undefined`, then destructuring `undefined` throws an unhandled rejection. `waitFor` never resolves → test fails.
**Verdict:** Test mock issue. `mockSignOut` must return `Promise.resolve({ data: {}, error: null })` for the destructuring to work.

### 2.3 AuthContext.test.tsx — "dispatches auth-changed event on logout"

**Exact error:** Same `TypeError: Cannot destructure property 'error' of '(intermediate value)' as it is undefined.` at `AuthContext.tsx:74:13`.
**Relevant assertion:** `src/contexts/__tests__/AuthContext.test.tsx:106-111` — waits for `dispatchedEvents` to contain an `auth-changed` event.
**Root cause:** Same as #2 — unhandled rejection from `mockSignOut` returning `undefined` prevents execution from reaching the dispatch logic; `waitFor` times out.
**Verdict:** Test mock issue (same root cause as #2).

**Note:** The sibling test "calls supabase signOut on logout" PASSES because it only asserts `mockSignOut` was called once, without awaiting the result destructuring.

### 2.4 LoginPage.test.tsx — "shows session expired message when location.state.sessionExpired is true"

**Exact error:** `waitFor` times out — `screen.getAllByText(/auth\.session_expired/)` finds 0 elements.
**Relevant assertion:** `src/pages/__tests__/LoginPage.test.tsx:72-75` — `expect(elements.length).toBeGreaterThan(0)`
**Root cause:** Test sets `MemoryRouter initialEntries={[{ pathname: '/login', state: { sessionExpired: true } }]}` but `LoginPage` reads session expiry from `useAuth().sessionExpired` (mocked as `false` at line 27), not from `location.state`. The component never renders the session-expired message.
**Verdict:** Test expectation mismatch. The test sets router state that the component does not consume.

### 2.5 LoginPage.test.tsx — "preserves redirect destination from location.state.from on successful login"

**Exact error:**
```
AssertionError: expected "spy" to be called with arguments: [ '/dashboard' ]
Received:
  1st spy call: Array [ "/introduction" ]
```
**Relevant assertion:** `src/pages/__tests__/LoginPage.test.tsx:101` — `expect(mockNavigate).toHaveBeenCalledWith('/dashboard')`
**Root cause:** `LoginPage.tsx:37` — `navigate('/introduction')` is hardcoded on successful login. It does not read or preserve `location.state.from`. After login, the component navigates to `/introduction` regardless of the `from` state.
**Verdict:** Production code limitation — `LoginPage` does not implement `from`-state redirect preservation. This is pre-existing behavior, not a regression.

---

## 3. RequireRole diagnosis

**File:** `frontend/src/components/RequireRole.tsx` (35 lines, valid TypeScript)

**Previous report claim:** "RequireRole.tsx has a reported pre-existing syntax error that blocks production build."

**Actual evidence:**
- `tsc --noEmit` (typecheck) passes cleanly — no syntax error.
- `RequireRole.tsx` imports `React`, `Navigate`, `useLocation` from `react-router-dom`, and `useAuth` from `../contexts/AuthContext`.
- It is actively consumed by `frontend/src/App.tsx:13` (import) and used at lines 229, 238, 247 to wrap admin routes with `allowedRoles={['admin']}`.
- The component logic: returns `null` while `loading`; returns `<Navigate to="/login" ...>` when `!user`; returns `<Navigate to={fallbackPath} ...>` when `!hasAccess`; otherwise renders `children`. No syntax error.

**Conclusion:** The "syntax error" report is **incorrect/misleading**. There is no syntax error in `RequireRole.tsx`. The single failing RequireRole test is a behavior mismatch (test expects a loading `status` element; component returns `null`), not a syntax or runtime defect in the component.

**TypeScript vs Vite build:** `tsc --noEmit` passes. The earlier `vite build` chunk-size warnings are size warnings, not errors, and unrelated to RequireRole.

---

## 4. Deleted-file reference audit

Deleted files:
- `frontend/src/components/AIChatbot.tsx`
- `frontend/src/pages/ChatPage.tsx`
- `backend/src/api/routes/chat.routes.js`
- `backend/src/api/routes/personas.routes.js`

**Active code search (frontend/src + backend/src, `*.{ts,tsx,js,jsx}`):**
- Zero imports referencing `AIChatbot`, `ChatPage`, `chat.routes`, or `personas.routes`.
- Zero route references, navigation links, lazy imports, or API calls to removed endpoints.
- Zero tests expecting removed functionality.

**Remaining mentions:** Confined entirely to `docs/` documentation files:
- `docs/SDACK_V1_Rescue_and_Launch_Plan.md` (ChatPage, AIChatbot in roadmap tables)
- `docs/SDACK_V1_P0_Role_Contract_Investigation.md` (AIChatbot `role: 'user'` discussion)
- `docs/SDACK_Strategic_Review.md` (chat.routes, AIChatbot, personas.routes in architecture tables)
- `docs/operations/FINAL_PRICING_OFFER_SYNC_CHECK.md` (AIChatbot pricing conflict)
- `docs/operations/FOUNDATION_PRICING_DECISION.md` (AIChatbot stale prices)
- `docs/operations/FIRST_CUSTOMER_HANDOFF_FINAL.md` (AIChatbot FAQ prices)

**Classification:**
| Deleted file | Active code references? | Classification |
|--------------|------------------------|----------------|
| `AIChatbot.tsx` | None in src/ | Intentional removal — clean |
| `ChatPage.tsx` | None in src/ | Intentional removal — clean |
| `chat.routes.js` | None in src/ | Intentional removal — clean |
| `personas.routes.js` | None in src/ | Intentional removal — clean |

**Risk:** No dangling code references. No runtime 404/500 risk from code. The only remaining references are stale documentation, which is low-risk and out of scope for this phase.

---

## 5. Prioritized risk register

| Rank | Severity | User-facing impact | Security/data impact | Likelihood | Confidence | Finding | Status |
|------|----------|-------------------|---------------------|------------|------------|---------|--------|
| P0 | High | Moderate (logout flow breaks silently) | None | High | Confirmed | AuthContext.test mock issue + RequireRole loading test mismatch — 5 tests failing, blocks test-suite confidence | Confirmed defect (test side) |
| P0 | High | None (build validation blocked) | None | High | Confirmed | Pre-existing `vite build` chunk-size warnings + (historical) RequireRole build-blocker claim disproven | Build passes, size warnings only |
| P1 | Low | None | None | Low | Confirmed | Deleted files have no dangling references | Intentional removal — clean |
| P1 | Low | Moderate (redirect always to /introduction) | None | High | Confirmed | LoginPage hardcodes `navigate('/introduction')`, ignores `location.state.from` | Pre-existing production limitation |
| P2 | Low | None | None | Low | Confirmed | `tokens.ts.status` lacks `danger`/`destructive` though CSS/tailwind define it | Token sync gap (documented in 03F) |
| P3 | Low | None | None | Low | Confirmed | Stale docs references to deleted files | Stale documentation |

**Confirmed defects:** 5 failing tests (4 test-side mismatches/mock issues, 1 production behavior limitation in LoginPage redirect).
**Possible risks:** None confirmed beyond the above.

---

## 6. Recommended minimal fixes (with affected file paths)

Do not implement in this phase. These are recommendations for a subsequent fix phase:

1. **Fix `mockSignOut` to return a promise** — `frontend/src/contexts/__tests__/AuthContext.test.tsx:6` — change `mockSignOut = vi.fn()` to `vi.fn().mockResolvedValue({ error: null })`. Fixes tests #2 and #3.
2. **Align RequireRole loading UI with test** OR **fix test expectation** — `frontend/src/components/RequireRole.tsx:19-21` (return a loading/status element instead of `null`) OR `frontend/src/components/__tests__/RequireRole.test.tsx:36` (assert `null` renders / no crash). Fixes test #1.
3. **Make LoginPage consume `sessionExpired` from context** — `frontend/src/pages/LoginPage.tsx` — read `sessionExpired` from `useAuth()` and render the message; OR update the test mock to set `sessionExpired: true`. Fixes test #4.
4. **Preserve `location.state.from` redirect** — `frontend/src/pages/LoginPage.tsx:37` — replace hardcoded `navigate('/introduction')` with logic that reads `useLocation().state?.from ?? '/introduction'`. Fixes test #5 (production enhancement).
5. **(Optional) Sync `tokens.ts.status`** — `frontend/src/design-system/tokens.ts:77-84` — add `danger`/`destructive` to match CSS/tailwind.

**Verification after fixes:** Re-run `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`. Expect 83/83 tests passing and clean build.

---

## 7. Items that should remain untouched

- `frontend/src/contexts/AuthContext.tsx` — production logout logic is correct; only the *test mock* is defective. Do not modify production code to accommodate a broken mock.
- `frontend/src/components/RequireRole.tsx` — valid TypeScript, no syntax error, actively used by App.tsx. Do not modify unless also updating the loading-UI behavior.
- Deleted files (`AIChatbot.tsx`, `ChatPage.tsx`, `chat.routes.js`, `personas.routes.js`) — do not restore. No dangling references exist.
- All pre-existing working-tree changes unrelated to these test files — preserve per constraints.
- Nothing should be committed, pushed, reset, stashed, or discarded.

---

## 8. Confirmation

No files were modified during this investigation. All findings are based on direct reads of the failing test files, `RequireRole.tsx`, `AuthContext.tsx`, `LoginPage.tsx`, `App.tsx`, `git diff`/`git log`/`git status` output, grep searches across `frontend/src` and `backend/src`, and vitest runs capturing exact error messages.
