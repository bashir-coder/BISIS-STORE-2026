import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'

const mockLogin = vi.fn().mockResolvedValue({})
const mockNavigate = vi.fn()
let mockSessionExpired = false
let mockLocation: { pathname: string; state?: { from?: string } } = {
  pathname: '/login',
}

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: vi.fn(() => mockNavigate),
    useLocation: vi.fn(() => mockLocation),
  }
})

vi.mock('../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({
    user: null,
    loading: false,
    login: mockLogin,
    loginWithGoogle: vi.fn(),
    logout: vi.fn(),
    updateProfile: vi.fn(),
    sessionExpired: mockSessionExpired,
    clearSessionExpired: vi.fn(),
  }),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
      signInWithPassword: vi.fn(),
      signInWithOAuth: vi.fn(),
      signInWithIdToken: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}))

const GOOGLE_CLIENT_ID = 'test-client-id'

beforeEach(() => {
  mockLogin.mockReset()
  mockLogin.mockResolvedValue({})
  mockNavigate.mockReset()
  mockSessionExpired = false
  mockLocation = { pathname: '/login' }
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('LoginPage session expiry UX', () => {
  it('shows session expired message when sessionExpired is true', async () => {
    const LoginPage = (await import('../LoginPage')).default

    mockSessionExpired = true

    render(
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <MemoryRouter initialEntries={[{ pathname: '/login' }]}>
          <LoginPage />
        </MemoryRouter>
      </GoogleOAuthProvider>,
    )

    await waitFor(() => {
      const elements = screen.getAllByText(/auth\.session_expired/)
      expect(elements.length).toBeGreaterThan(0)
    })
  })

  it('preserves redirect destination from location.state.from on successful login', async () => {
    const LoginPage = (await import('../LoginPage')).default

    mockLocation = { pathname: '/login', state: { from: '/dashboard' } }

    render(
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <MemoryRouter initialEntries={[{ pathname: '/login' }]}>
          <LoginPage />
        </MemoryRouter>
      </GoogleOAuthProvider>,
    )

    const emailInput = screen.getByLabelText(/البريد الإلكتروني|Email|E-posta/i)
    const passwordInput = screen.getByLabelText(/كلمة المرور|Password|Şifre/i, { selector: 'input' })
    const submitButton = screen.getByRole('button', { name: /إرسال|Submit|Gönder/i })

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })

    await act(async () => {
      fireEvent.click(submitButton)
    })

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled())
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
  })

  it('falls back to /introduction when no from state is present', async () => {
    const LoginPage = (await import('../LoginPage')).default

    render(
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <MemoryRouter initialEntries={[{ pathname: '/login' }]}>
          <LoginPage />
        </MemoryRouter>
      </GoogleOAuthProvider>
    )

    const emailInput = screen.getByLabelText(/البريد الإلكتروني|Email|E-posta/i)
    const passwordInput = screen.getByLabelText(/كلمة المرور|Password|Şifre/i, { selector: 'input' })
    const submitButton = screen.getByRole('button', { name: /إرسال|Submit|Gönder/i })

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })

    await act(async () => {
      fireEvent.click(submitButton)
    })

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled())
    expect(mockNavigate).toHaveBeenCalledWith('/introduction')
  })

  it('falls back to /introduction when from state is an external URL', async () => {
    const LoginPage = (await import('../LoginPage')).default

    mockLocation = { pathname: '/login', state: { from: 'https://evil.com' } }

    render(
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <MemoryRouter initialEntries={[{ pathname: '/login' }]}>
          <LoginPage />
        </MemoryRouter>
      </GoogleOAuthProvider>,
    )

    const emailInput = screen.getByLabelText(/البريد الإلكتروني|Email|E-posta/i)
    const passwordInput = screen.getByLabelText(/كلمة المرور|Password|Şifre/i, { selector: 'input' })
    const submitButton = screen.getByRole('button', { name: /إرسال|Submit|Gönder/i })

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })

    await act(async () => {
      fireEvent.click(submitButton)
    })

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled())
    expect(mockNavigate).toHaveBeenCalledWith('/introduction')
  })

  it('falls back to /introduction when from state is protocol-relative', async () => {
    const LoginPage = (await import('../LoginPage')).default

    mockLocation = { pathname: '/login', state: { from: '//evil.com' } }

    render(
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <MemoryRouter initialEntries={[{ pathname: '/login' }]}>
          <LoginPage />
        </MemoryRouter>
      </GoogleOAuthProvider>,
    )

    const emailInput = screen.getByLabelText(/البريد الإلكتروني|Email|E-posta/i)
    const passwordInput = screen.getByLabelText(/كلمة المرور|Password|Şifre/i, { selector: 'input' })
    const submitButton = screen.getByRole('button', { name: /إرسال|Submit|Gönder/i })

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })

    await act(async () => {
      fireEvent.click(submitButton)
    })

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled())
    expect(mockNavigate).toHaveBeenCalledWith('/introduction')
  })
})
