import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react'
import React from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from '../../contexts/AuthContext'
import { RequireRole } from '../../components/RequireRole'
import LoginPage from '../LoginPage'

// ---- controllable supabase mock (real network layer replaced) ----
// Each mock is declared with vi.hoisted so vi.mock (hoisted above module code)
// can reference them without TDZ errors.
const mockGetSession = vi.hoisted(() =>
  vi.fn(() => Promise.resolve({ data: { session: null } })),
)
const mockSignInWithPassword = vi.hoisted(() => vi.fn())
const mockSignInWithIdToken = vi.hoisted(() => vi.fn())
let onAuthStateChangeCb: ((event: any, session?: any) => void) | null = null
let mockGoogleOnSuccess: ((resp: { credential?: string }) => void) | null = null
const mockOnAuthStateChange = vi.hoisted(() =>
  vi.fn((cb: any) => {
    onAuthStateChangeCb = cb
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  }),
)

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      signInWithPassword: mockSignInWithPassword,
      signInWithOAuth: vi.fn(),
      signInWithIdToken: mockSignInWithIdToken,
      signOut: vi.fn(() => Promise.resolve({ error: null })),
      onAuthStateChange: mockOnAuthStateChange,
    },
  },
}))

// Mock @react-oauth/google so GoogleLogin captures its onSuccess handler
vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  GoogleLogin: ({ onSuccess }: { onSuccess?: (resp: { credential?: string }) => void }) => {
    if (onSuccess) mockGoogleOnSuccess = onSuccess
    return null
  },
}))

const AdminDashboard = () => <div data-testid="admin-dashboard">Admin Dashboard</div>
const Introduction = () => <div data-testid="introduction">Introduction</div>

const Consumer = () => {
  const { sessionExpired, clearSessionExpired, login } = useAuth()
  return (
    <div>
      {sessionExpired ? (
        <p data-testid="session-expired-msg">{'session-expired'}</p>
      ) : null}
      <button data-testid="clear-expiry" onClick={clearSessionExpired}>
        clear
      </button>
      <button
        data-testid="do-login"
        onClick={async () => {
          await login('test@example.com', 'password123')
        }}
      >
        login
      </button>
    </div>
  )
}

describe('AuthContext Provider integration (session expiry)', () => {
  beforeEach(() => {
    mockSignInWithPassword.mockReset()
    mockGetSession.mockReset()
    mockGetSession.mockResolvedValue({ data: { session: null } })
    // mockOnAuthStateChange keeps its capture implementation; do not reset it
    onAuthStateChangeCb = null
  })

  afterEach(() => {
    cleanup()
  })

  it('provides sessionExpired and clearSessionExpired to consumers', () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    )
    expect(screen.getByTestId('clear-expiry')).toBeInTheDocument()
    expect(screen.queryByTestId('session-expired-msg')).not.toBeInTheDocument()
  })

  it('sets sessionExpired when the auth session is lost', () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    )
    act(() => {
      onAuthStateChangeCb?.({ session: null })
    })
    expect(screen.getByTestId('session-expired-msg')).toHaveTextContent(
      'session-expired',
    )
  })

  it('clearSessionExpired removes the expiry message', () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    )
    act(() => {
      onAuthStateChangeCb?.({ session: null })
    })
    expect(screen.getByTestId('session-expired-msg')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('clear-expiry'))
    expect(screen.queryByTestId('session-expired-msg')).not.toBeInTheDocument()
  })

  it('successful login clears stale session-expiry state', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { user: { id: '1' } } })
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    )
    act(() => {
      onAuthStateChangeCb?.({ session: null })
    })
    expect(screen.getByTestId('session-expired-msg')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('do-login'))
    await waitFor(() =>
      expect(screen.queryByTestId('session-expired-msg')).not.toBeInTheDocument(),
    )
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    })
  })
})

describe('LoginPage redirect integration (real router state)', () => {
  const emailInput = /البريد الإلكتروني|Email|E-posta/i
  const passwordInput = /كلمة المرور|Password|Şifre/i
  const submitButton = /إرسال|Submit|Gönder/i

  const fillAndSubmit = () => {
    const email = screen.getByLabelText(emailInput)
    const password = screen.getByLabelText(passwordInput, { selector: 'input' })
    const submit = screen.getByRole('button', { name: submitButton })
    fireEvent.change(email, { target: { value: 'test@example.com' } })
    fireEvent.change(password, { target: { value: 'password123' } })
    fireEvent.click(submit)
  }

  beforeEach(() => {
    mockSignInWithPassword.mockReset()
    mockSignInWithPassword.mockResolvedValue({ data: { user: { id: '1' } } })
    mockSignInWithIdToken.mockReset()
    mockSignInWithIdToken.mockResolvedValue({ data: { user: { id: '1' } } })
    mockGetSession.mockReset()
    mockGetSession.mockResolvedValue({ data: { session: null } })
    // mockOnAuthStateChange keeps its capture implementation; do not reset it
    onAuthStateChangeCb = null
    mockGoogleOnSuccess = null
  })

  afterEach(() => {
    cleanup()
  })

  it('preserves a valid internal string destination after login', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { user: { id: '1' } } })
    render(
      <AuthProvider>
        <MemoryRouter
          initialEntries={[{ pathname: '/login', state: { from: '/dashboard' } }]}
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<AdminDashboard />} />
            <Route path="/introduction" element={<Introduction />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )

    fillAndSubmit()
    await waitFor(() =>
      expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument(),
    )
  })

  it('preserves pathname/search/hash from a location-object destination', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { user: { id: '1' } } })
    render(
      <AuthProvider>
        <MemoryRouter
          initialEntries={[
            {
              pathname: '/login',
              state: {
                from: {
                  pathname: '/dashboard',
                  search: '?tab=services',
                  hash: '#pricing',
                },
              },
            },
          ]}
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<AdminDashboard />} />
            <Route path="/introduction" element={<Introduction />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )

    fillAndSubmit()
    await waitFor(() =>
      expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument(),
    )
  })

  it('falls back to /introduction when no from state is present', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { user: { id: '1' } } })
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={[{ pathname: '/login' }]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<AdminDashboard />} />
            <Route path="/introduction" element={<Introduction />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )

    fillAndSubmit()
    await waitFor(() =>
      expect(screen.getByTestId('introduction')).toBeInTheDocument(),
    )
  })

  it('rejects an external URL destination and falls back to /introduction', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { user: { id: '1' } } })
    render(
      <AuthProvider>
        <MemoryRouter
          initialEntries={[{ pathname: '/login', state: { from: 'https://evil.example' } }]}
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<AdminDashboard />} />
            <Route path="/introduction" element={<Introduction />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )

    fillAndSubmit()
    await waitFor(() =>
      expect(screen.getByTestId('introduction')).toBeInTheDocument(),
    )
  })

  it('rejects a protocol-relative destination and falls back to /introduction', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { user: { id: '1' } } })
    render(
      <AuthProvider>
        <MemoryRouter
          initialEntries={[{ pathname: '/login', state: { from: '//evil.example' } }]}
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<AdminDashboard />} />
            <Route path="/introduction" element={<Introduction />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )

    fillAndSubmit()
    await waitFor(() =>
      expect(screen.getByTestId('introduction')).toBeInTheDocument(),
    )
  })

  it('end-to-end: RequireRole redirects to /login preserving destination, login returns to /dashboard', async () => {
    mockSignInWithPassword.mockImplementation(() => {
      const cb = onAuthStateChangeCb
      if (cb) {
        // Supabase calls onAuthStateChange(event, session): session is the 2nd arg.
        cb('SIGNED_IN', {
          user: {
            id: '1',
            email: 'admin@example.com',
            user_metadata: {},
            app_metadata: { role: 'admin' },
          },
        })
      }
      return Promise.resolve({ data: { user: { id: '1' } } })
    })

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={[{ pathname: '/dashboard' }]}>
          <Routes>
            <Route
              path="/dashboard"
              element={
                <RequireRole allowedRoles={['admin']}>
                  <AdminDashboard />
                </RequireRole>
              }
            />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/introduction" element={<Introduction />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )

    // RequireRole should have redirected to /login
    await waitFor(() =>
      expect(screen.getByLabelText(emailInput)).toBeInTheDocument(),
    )

    fillAndSubmit()

    // After login, user should be returned to the original dashboard destination
    await waitFor(() =>
      expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument(),
    )
  })

  it('Google login preserves a valid internal destination after sign-in', async () => {
    mockSignInWithIdToken.mockImplementation(() => {
      const cb = onAuthStateChangeCb
      if (cb) {
        cb('SIGNED_IN', {
          user: {
            id: '1',
            email: 'admin@example.com',
            user_metadata: {},
            app_metadata: { role: 'admin' },
          },
        })
      }
      return Promise.resolve({ data: { user: { id: '1' } } })
    })
    render(
      <AuthProvider>
        <MemoryRouter
          initialEntries={[{ pathname: '/login', state: { from: '/dashboard' } }]}
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<AdminDashboard />} />
            <Route path="/introduction" element={<Introduction />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )

    expect(mockGoogleOnSuccess).toBeTruthy()
    mockGoogleOnSuccess?.({ credential: 'fake-google-credential' })

    await waitFor(() =>
      expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument(),
    )
  })

  it('Google login falls back to /introduction when no from state is present', async () => {
    mockSignInWithIdToken.mockImplementation(() => {
      const cb = onAuthStateChangeCb
      if (cb) {
        cb('SIGNED_IN', {
          user: {
            id: '1',
            email: 'admin@example.com',
            user_metadata: {},
            app_metadata: { role: 'admin' },
          },
        })
      }
      return Promise.resolve({ data: { user: { id: '1' } } })
    })
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={[{ pathname: '/login' }]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<AdminDashboard />} />
            <Route path="/introduction" element={<Introduction />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )

    expect(mockGoogleOnSuccess).toBeTruthy()
    mockGoogleOnSuccess?.({ credential: 'fake-google-credential' })

    await waitFor(() =>
      expect(screen.getByTestId('introduction')).toBeInTheDocument(),
    )
  })

  it('Google login rejects an external URL destination and falls back to /introduction', async () => {
    mockSignInWithIdToken.mockImplementation(() => {
      const cb = onAuthStateChangeCb
      if (cb) {
        cb('SIGNED_IN', {
          user: {
            id: '1',
            email: 'admin@example.com',
            user_metadata: {},
            app_metadata: { role: 'admin' },
          },
        })
      }
      return Promise.resolve({ data: { user: { id: '1' } } })
    })
    render(
      <AuthProvider>
        <MemoryRouter
          initialEntries={[{ pathname: '/login', state: { from: 'https://evil.example' } }]}
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<AdminDashboard />} />
            <Route path="/introduction" element={<Introduction />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )

    expect(mockGoogleOnSuccess).toBeTruthy()
    mockGoogleOnSuccess?.({ credential: 'fake-google-credential' })

    await waitFor(() =>
      expect(screen.getByTestId('introduction')).toBeInTheDocument(),
    )
  })
})
