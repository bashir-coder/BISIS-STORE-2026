const request = require('supertest')
const app = require('../server')
const supabase = require('../src/config/supabase.config')

describe('Authentication & Core API', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('GET /api/health – should return 200 OK with server health status', async () => {
    const res = await request(app).get('/api/health')
    expect(res.statusCode).toBe(200)
    expect(res.body.status).toBe('DEGRADED')
    expect(res.body.database).toBe('configured')
    expect(res.body.critical_configuration.payment_verifier).toBe('missing')
  })

  test('rejects a disallowed CORS origin with 403', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'https://not-allowed.example')

    expect(res.statusCode).toBe(403)
    expect(res.body.message).toBe('Origin is not allowed')
  })

  test('GET /api/auth/me – should return 401 when no token is provided', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.statusCode).toBe(401)
    expect(res.body.message).toBe('No token provided')
  })

  test('GET /api/auth/me – should return 401 when invalid token is provided', async () => {
    jest.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: null },
      error: new Error('Invalid token')
    })

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-dummy-token')

    expect(res.statusCode).toBe(401)
    expect(res.body.message).toBe('Invalid session')
  })

  test('GET /api/auth/workspaces – should return 401 without authentication', async () => {
    const res = await request(app).get('/api/auth/workspaces')
    expect(res.statusCode).toBe(401)
    expect(res.body.message).toBe('No token provided')
  })
})

describe('Profile synchronization', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('syncs is_verified from the current Supabase Auth user on refresh', async () => {
    const authUser = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      email: 'verified@example.com',
      email_confirmed_at: '2026-08-24T00:00:00Z',
      user_metadata: { full_name: 'Verified User' },
      app_metadata: { provider: 'email' },
    }
    const existingProfile = {
      id: authUser.id,
      email: authUser.email,
      role: 'client',
      is_active: true,
      is_verified: false,
    }
    const synchronizedProfile = { ...existingProfile, is_verified: true }
    const profileQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: existingProfile, error: null }),
    }
    const updateQuery = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: synchronizedProfile, error: null }),
    }

    jest.spyOn(supabase.auth, 'getUser').mockResolvedValue({ data: { user: authUser }, error: null })
    jest.spyOn(supabase, 'from').mockReturnValueOnce(profileQuery).mockReturnValueOnce(updateQuery)

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer valid-dummy-token')

    expect(res.statusCode).toBe(200)
    expect(res.body.user.is_verified).toBe(true)
    expect(updateQuery.update).toHaveBeenCalledWith(expect.objectContaining({ is_verified: true }))
  })
})

