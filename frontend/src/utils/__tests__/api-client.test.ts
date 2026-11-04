import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const responseRejectedHandlers: Array<(err: any) => any> = []

const mockGetSession = vi.fn()
const mockSignOut = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      signOut: mockSignOut,
    },
  },
}))

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      interceptors: {
        request: {
          use: vi.fn(() => 0),
        },
        response: {
          use: vi.fn((_fulfilled: any, rejected: any) => {
            if (rejected) responseRejectedHandlers.push(rejected)
            return 0
          }),
        },
      },
    })),
  },
  create: vi.fn(() => ({
    interceptors: {
      request: {
        use: vi.fn(() => 0),
      },
      response: {
        use: vi.fn((_fulfilled: any, rejected: any) => {
          if (rejected) responseRejectedHandlers.push(rejected)
          return 0
        }),
      },
    },
  })),
}))

const capturedEvents: Array<Event> = []
const onSessionExpired = (e: Event) => capturedEvents.push(e)
const onAuthChanged = (e: Event) => capturedEvents.push(e)

beforeEach(async () => {
  const mod = await import('../api-client')
  mod.__reset401Dedup()
  mockGetSession.mockReset()
  mockSignOut.mockReset()
  capturedEvents.length = 0
  localStorage.clear()
  window.addEventListener('auth-session-expired', onSessionExpired)
  window.addEventListener('auth-changed', onAuthChanged)
})

afterEach(() => {
  window.removeEventListener('auth-session-expired', onSessionExpired)
  window.removeEventListener('auth-changed', onAuthChanged)
})

describe('api-client 401 handling', () => {
  it('does not trigger session expiry for public endpoint 401 (no supabase session)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })

    expect(responseRejectedHandlers.length).toBeGreaterThan(0)

    const error = {
      response: { status: 401, data: { message: 'Unauthorized' } },
      config: { url: '/public-endpoint', method: 'GET' },
      isAxiosError: true,
    }

    await expect(responseRejectedHandlers[0](error)).rejects.toEqual(error)

    expect(mockSignOut).not.toHaveBeenCalled()
    expect(localStorage.getItem('BİŞİŞ_user')).toBeNull()
    const sessionExpiredEvents = capturedEvents.filter(
      (e) => e.type === 'auth-session-expired'
    )
    expect(sessionExpiredEvents).toHaveLength(0)
  })

  it('triggers session expiry event for authenticated request 401', async () => {
    const mod = await import('../api-client')
    mod.__reset401Dedup()
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'valid-token' } },
    })

    const error = {
      response: { status: 401, data: { message: 'Token expired' } },
      config: { url: '/api/protected', method: 'GET' },
      isAxiosError: true,
    }

    await expect(responseRejectedHandlers[0](error)).rejects.toEqual(error)

    const sessionExpiredEvents = capturedEvents.filter(
      (e) => e.type === 'auth-session-expired'
    )
    expect(sessionExpiredEvents).toHaveLength(1)
    expect((sessionExpiredEvents[0] as CustomEvent).detail.from).toBeDefined()
  })

  it('prevents repeated session expiry handling for simultaneous 401s', async () => {
    const mod = await import('../api-client')
    mod.__reset401Dedup()
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'valid-token' } },
    })

    const error = {
      response: { status: 401, data: { message: 'Token expired' } },
      config: { url: '/api/protected', method: 'GET' },
      isAxiosError: true,
    }

    await Promise.all(
      [1, 2, 3].map(() => responseRejectedHandlers[0](error).catch(() => {}))
    )

    const sessionExpiredEvents = capturedEvents.filter(
      (e) => e.type === 'auth-session-expired'
    )
    expect(sessionExpiredEvents).toHaveLength(1)
  })

  it('does not manually clear supabase tokens on 401', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'valid-token' } },
    })

    const error = {
      response: { status: 401, data: {} },
      config: { url: '/api/protected', method: 'GET' },
      isAxiosError: true,
    }

    await responseRejectedHandlers[0](error).catch(() => {})

    expect(mockSignOut).not.toHaveBeenCalled()
  })
})
