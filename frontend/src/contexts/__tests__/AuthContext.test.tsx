import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, screen, cleanup, waitFor } from '@testing-library/react'

const mockGetSession = vi.fn()
const mockSignOut = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      signOut: mockSignOut,
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}))

const dispatchedEvents: Array<Event> = []
const originalDispatchEvent = window.dispatchEvent.bind(window)

const { AuthProvider, useAuth } = await import('../../contexts/AuthContext')

beforeEach(() => {
  mockGetSession.mockReset()
  mockSignOut.mockReset()
  mockSignOut.mockResolvedValue({ error: null })
  dispatchedEvents.length = 0
  localStorage.clear()
  mockGetSession.mockResolvedValue({ data: { session: null } })
  // Replace dispatchEvent with a capturing stub
  window.dispatchEvent = ((event: Event) => {
    dispatchedEvents.push(event)
    return true
  }) as any
})

afterEach(() => {
  cleanup()
  window.dispatchEvent = originalDispatchEvent
})

describe('AuthContext unified logout', () => {
  it('calls supabase signOut on logout', async () => {
    function TestComponent() {
      const { logout } = useAuth()
      return (
        <button data-testid="logout-btn" onClick={async () => await logout()}>
          logout
        </button>
      )
    }

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await fireEvent.click(screen.getByTestId('logout-btn'))
    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1))
  })

  it('clears BİŞİŞ_user and BİŞİŞ_token on logout', async () => {
    localStorage.setItem('BİŞİŞ_user', 'user-data')
    localStorage.setItem('BİŞİŞ_token', 'token-data')

    function TestComponent() {
      const { logout } = useAuth()
      return (
        <button data-testid="logout-btn" onClick={async () => await logout()}>
          logout
        </button>
      )
    }

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await fireEvent.click(screen.getByTestId('logout-btn'))
    await waitFor(() => {
      expect(localStorage.getItem('BİŞİŞ_user')).toBeNull()
      expect(localStorage.getItem('BİŞİŞ_token')).toBeNull()
    })
  })

  it('dispatches auth-changed event on logout', async () => {
    function TestComponent() {
      const { logout } = useAuth()
      return (
        <button data-testid="logout-btn" onClick={async () => await logout()}>
          logout
        </button>
      )
    }

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await fireEvent.click(screen.getByTestId('logout-btn'))
    await waitFor(() => {
      const authChangedEvents = dispatchedEvents.filter(
        (e) => e.type === 'auth-changed'
      )
      expect(authChangedEvents).toHaveLength(1)
    })
  })

  it('does NOT clear BİŞİŞ_human_verified or BİŞİŞ_introduction_shown', async () => {
    localStorage.setItem('BİŞİŞ_human_verified', 'true')
    localStorage.setItem('BİŞİŞ_introduction_shown', 'true')

    function TestComponent() {
      const { logout } = useAuth()
      return (
        <button data-testid="logout-btn" onClick={async () => await logout()}>
          logout
        </button>
      )
    }

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await fireEvent.click(screen.getByTestId('logout-btn'))

    expect(localStorage.getItem('BİŞİŞ_human_verified')).toBe('true')
    expect(localStorage.getItem('BİŞİŞ_introduction_shown')).toBe('true')
  })

  it('does NOT clear BİŞİŞ_theme', async () => {
    localStorage.setItem('BİŞİŞ_theme', 'dark')

    function TestComponent() {
      const { logout } = useAuth()
      return (
        <button data-testid="logout-btn" onClick={async () => await logout()}>
          logout
        </button>
      )
    }

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await fireEvent.click(screen.getByTestId('logout-btn'))

    expect(localStorage.getItem('BİŞİŞ_theme')).toBe('dark')
  })
})
