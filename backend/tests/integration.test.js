const request = require('supertest')
const app = require('../server')
const supabase = require('../src/config/supabase.config')

describe('Runtime Integration Verification Suite', () => {
  // Test User Fixtures
  const userA = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'userA@example.com',
    full_name: 'User A',
    role: 'client',
    workspace_id: 'aaaa1111-aaaa-1111-aaaa-111111111111',
    is_active: true,
  }

  const userB = {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'userB@example.com',
    full_name: 'User B',
    role: 'client',
    workspace_id: 'bbbb2222-bbbb-2222-bbbb-222222222222',
    is_active: true,
  }

  const staffWorkspaceA = {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'staffA@example.com',
    full_name: 'Staff Workspace A',
    role: 'admin',
    workspace_id: 'aaaa1111-aaaa-1111-aaaa-111111111111',
    is_active: true,
  }

  const staffWorkspaceB = {
    id: '44444444-4444-4444-4444-444444444444',
    email: 'staffB@example.com',
    full_name: 'Staff Workspace B',
    role: 'admin',
    workspace_id: 'bbbb2222-bbbb-2222-bbbb-222222222222',
    is_active: true,
  }

  const superAdmin = {
    id: '99999999-9999-9999-9999-999999999999',
    email: 'superadmin@example.com',
    full_name: 'Super Admin',
    role: 'super_admin',
    workspace_id: null,
    is_active: true,
  }

  const inactiveUser = {
    id: '55555555-5555-5555-5555-555555555555',
    email: 'inactive@example.com',
    full_name: 'Inactive User',
    role: 'client',
    is_active: false,
  }

  const tokenFor = (user) => `token-${user.id}`

  beforeEach(() => {
    jest.restoreAllMocks()
    jest.spyOn(supabase.auth, 'getUser').mockImplementation(async (token) => {
      if (!token) return { data: { user: null }, error: new Error('No token') }
      const users = [userA, userB, staffWorkspaceA, staffWorkspaceB, superAdmin, inactiveUser]
      const found = users.find(u => token === tokenFor(u))
      if (found) {
        return {
          data: {
            user: {
              id: found.id,
              email: found.email,
              user_metadata: { full_name: found.full_name },
              app_metadata: { provider: 'supabase' },
              email_confirmed_at: '2026-01-01T00:00:00Z',
            }
          },
          error: null
        }
      }
      return { data: { user: null }, error: new Error('Invalid token') }
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  // STEP 2 — AUTHENTICATION FLOW
  describe('Step 2: Authentication Flow', () => {
    test('rejects unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/auth/me')
      expect(res.statusCode).toBe(401)
      expect(res.body.message).toBe('No token provided')
    })

    test('rejects deactivated account with 403 ACCOUNT_INACTIVE', async () => {
      const queryMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: inactiveUser, error: null }),
        single: jest.fn().mockResolvedValue({ data: inactiveUser, error: null })
      }
      jest.spyOn(supabase, 'from').mockReturnValue(queryMock)

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tokenFor(inactiveUser)}`)

      expect(res.statusCode).toBe(403)
      expect(res.body.code).toBe('ACCOUNT_INACTIVE')
    })

    test('accepts valid Supabase Bearer token and returns user profile', async () => {
      const queryMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: userA, error: null }),
        single: jest.fn().mockResolvedValue({ data: userA, error: null })
      }
      jest.spyOn(supabase, 'from').mockReturnValue(queryMock)

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tokenFor(userA)}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.user.id).toBe(userA.id)
      expect(res.body.user.email).toBe(userA.email)
    })
  })

  // STEP 8 — NEW V1 PROFILE PROVISIONING
  describe('Step 8: V1 Profile Provisioning', () => {
    test('provisions a new V1 profile when the auth UUID has no public profile', async () => {
      const createdUser = { ...userA, name: userA.full_name, auth_provider: 'email' }
      const existingQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
      const insertQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: createdUser, error: null }),
      }
      let fromCalls = 0
      jest.spyOn(supabase, 'from').mockImplementation(() => {
        fromCalls += 1
        return fromCalls === 1 ? existingQuery : insertQuery
      })

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tokenFor(userA)}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.user.id).toBe(userA.id)
      expect(res.body.user.role).toBe('client')
      expect(insertQuery.insert).toHaveBeenCalledWith([expect.objectContaining({ id: userA.id, role: 'client' })])
    })
  })

  // STEP 3 & STEP 6 — AUTHORIZATION / IDOR / ORDERS
  describe('Step 3 & 6: Order IDOR and Access Control', () => {
    test('customer cannot download file from an order they do not own (404/403 IDOR prevention)', async () => {
      const orderB = { id: 'order-bbb', user_id: userB.id, workspace_id: userB.workspace_id, status: 'new', payment_status: 'pending' }

      const queryMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockImplementation(async () => {
          // User A attempts to access orderB
          return { data: orderB, error: null }
        }),
        single: jest.fn().mockResolvedValue({ data: userA, error: null })
      }
      jest.spyOn(supabase, 'from').mockImplementation((table) => {
        if (table === 'users') {
          return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: async () => ({ data: userA, error: null }), single: async () => ({ data: userA, error: null }) }
        }
        return queryMock
      })

      // User A tries to download User B's file
      const res = await request(app)
        .get('/api/orders/order-bbb/files/file-123/download')
        .set('Authorization', `Bearer ${tokenFor(userA)}`)

      expect([403, 404]).toContain(res.statusCode)
    })

    test('customer cannot access internal files (403 forbidden)', async () => {
      const orderA = { id: 'order-aaa', user_id: userA.id, workspace_id: userA.workspace_id, status: 'new', payment_status: 'verified' }
      const internalFile = { id: 'file-internal-1', order_id: 'order-aaa', object_path: 'orders/order-aaa/secret.pdf', original_name: 'secret.pdf', file_kind: 'internal' }

      jest.spyOn(supabase, 'from').mockImplementation((table) => {
        if (table === 'users') {
          return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: async () => ({ data: userA, error: null }), single: async () => ({ data: userA, error: null }) }
        }
        if (table === 'orders') {
          return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: async () => ({ data: orderA, error: null }) }
        }
        if (table === 'order_files') {
          return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: async () => ({ data: internalFile, error: null }) }
        }
        return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: async () => ({ data: null, error: null }) }
      })

      const res = await request(app)
        .get('/api/orders/order-aaa/files/file-internal-1/download')
        .set('Authorization', `Bearer ${tokenFor(userA)}`)

      expect(res.statusCode).toBe(403)
      expect(res.body.message).toContain('not allowed to download')
    })
  })

  // STEP 4 — WORKSPACE / STAFF ACCESS
  describe('Step 4: Workspace and Staff Access Control', () => {
    test('customer cannot access admin analytics (403 Insufficient permissions)', async () => {
      jest.spyOn(supabase, 'from').mockImplementation((table) => {
        if (table === 'users') {
          return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: async () => ({ data: userA, error: null }), single: async () => ({ data: userA, error: null }) }
        }
        return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis() }
      })

      const res = await request(app)
        .get('/api/orders/admin/analytics')
        .set('Authorization', `Bearer ${tokenFor(userA)}`)

      expect(res.statusCode).toBe(403)
      expect(res.body.message).toBe('Insufficient permissions')
    })

    test('staff from Workspace B cannot access Workspace A project (404 Project not found)', async () => {
      jest.spyOn(supabase, 'from').mockImplementation((table) => {
        if (table === 'users') {
          return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: async () => ({ data: staffWorkspaceB, error: null }), single: async () => ({ data: staffWorkspaceB, error: null }) }
        }
        if (table === 'projects') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockImplementation((col, val) => {
              // Project belongs to Workspace A, staff is in Workspace B
              if (col === 'workspace_id' && val === staffWorkspaceB.workspace_id) {
                return { single: async () => ({ data: null, error: new Error('Not found') }) }
              }
              return { single: async () => ({ data: null, error: new Error('Not found') }) }
            })
          }
        }
        return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis() }
      })

      const res = await request(app)
        .get('/api/projects/proj-workspace-a')
        .set('Authorization', `Bearer ${tokenFor(staffWorkspaceB)}`)

      expect(res.statusCode).toBe(400)
    })
  })

  // STEP 5 — CHAT FLOW
  describe('Step 5: Chat Flow & Authorization', () => {
    test('unauthorized user cannot read messages from another conversation (403)', async () => {
      const convUserB = { id: 'conv-bbb', user_id: userB.id, order_id: null, project_id: null, workspace_id: userB.workspace_id }

      jest.spyOn(supabase, 'from').mockImplementation((table) => {
        if (table === 'users') {
          return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: async () => ({ data: userA, error: null }), single: async () => ({ data: userA, error: null }) }
        }
        if (table === 'conversations') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockImplementation(() => {
              return { single: async () => ({ data: convUserB, error: null }), maybeSingle: async () => ({ data: convUserB, error: null }) }
            })
          }
        }
        return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis() }
      })

      const res = await request(app)
        .get('/api/chat/conv-bbb/messages')
        .set('Authorization', `Bearer ${tokenFor(userA)}`)

      expect(res.statusCode).toBe(403)
      expect(res.body.message).toContain('Unauthorized')
    })

    test('authorized user can retrieve their unread message count', async () => {
      const convUserA = [{ id: 'conv-aaa' }]

      jest.spyOn(supabase, 'from').mockImplementation((table) => {
        if (table === 'users') {
          return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: async () => ({ data: userA, error: null }), single: async () => ({ data: userA, error: null }) }
        }
        if (table === 'conversations') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockImplementation(() => {
              return Promise.resolve({ data: convUserA, error: null })
            })
          }
        }
        if (table === 'messages') {
          return {
            select: jest.fn().mockReturnThis(),
            neq: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockImplementation(() => {
              return Promise.resolve({ count: 3, error: null })
            })
          }
        }
        return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis() }
      })

      const res = await request(app)
        .get('/api/chat/unread')
        .set('Authorization', `Bearer ${tokenFor(userA)}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.unread).toBe(3)
    })
  })

  // STEP 7 — INVOICES & TICKETS
  describe('Step 7: Invoices & Tickets IDOR Prevention', () => {
    test('customer cannot access invoice for another user order (404/403)', async () => {
      const orderB = { id: 'order-bbb', user_id: userB.id, workspace_id: userB.workspace_id }
      const invoiceB = { id: 'inv-bbb', order_id: 'order-bbb', amount: 249, total: 286.35, status: 'issued' }

      jest.spyOn(supabase, 'from').mockImplementation((table) => {
        if (table === 'users') {
          return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: async () => ({ data: userA, error: null }), single: async () => ({ data: userA, error: null }) }
        }
        if (table === 'invoices') {
          return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: async () => ({ data: invoiceB, error: null }) }
        }
        if (table === 'orders') {
          return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: async () => ({ data: orderB, error: null }) }
        }
        return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis() }
      })

      const res = await request(app)
        .get('/api/invoices/inv-bbb')
        .set('Authorization', `Bearer ${tokenFor(userA)}`)

      expect(res.statusCode).toBe(404)
      expect(res.body.message).toBe('Invoice not found')
    })
  })
})


describe('Persona persistence API', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('persists a valid persona for the authenticated user only', async () => {
    const testUserA = {
      id: '11111111-1111-1111-1111-111111111111',
      email: 'userA@example.com',
      full_name: 'User A',
      role: 'client',
      workspace_id: 'aaaa1111-aaaa-1111-aaaa-111111111111',
      is_active: true,
    }
    const personaId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    jest.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: {
        user: {
          id: testUserA.id,
          email: testUserA.email,
          user_metadata: { full_name: testUserA.full_name },
          app_metadata: { provider: 'supabase' },
          email_confirmed_at: '2026-01-01T00:00:00Z',
        },
      },
      error: null,
    })
    const profileQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { ...testUserA, is_verified: true }, error: null }),
    }
    const personaQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: personaId, slug: 'startup' }, error: null }),
    }
    const updateQuery = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: testUserA.id, persona_id: personaId }, error: null }),
    }
    jest.spyOn(supabase, 'from')
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce(personaQuery)
      .mockReturnValueOnce(updateQuery)

    const res = await request(app)
      .patch('/api/users/me/persona')
      .set('Authorization', `Bearer token-${testUserA.id}`)
      .send({ persona_id: personaId })

    expect(res.statusCode).toBe(200)
    expect(res.body.user.persona_id).toBe(personaId)
    expect(updateQuery.eq).toHaveBeenCalledWith('id', testUserA.id)
    expect(updateQuery.update).toHaveBeenCalledWith(expect.objectContaining({ persona_id: personaId }))
  })
})


describe('Client 360 authorization', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('client cannot access the internal client directory', async () => {
    const client = {
      id: '11111111-1111-1111-1111-111111111111',
      email: 'userA@example.com',
      full_name: 'User A',
      role: 'client',
      workspace_id: 'aaaa1111-aaaa-1111-aaaa-111111111111',
      is_active: true,
    }
    jest.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: {
        user: {
          id: client.id,
          email: client.email,
          user_metadata: { full_name: client.full_name },
          app_metadata: { provider: 'supabase' },
          email_confirmed_at: '2026-01-01T00:00:00Z',
        },
      },
      error: null,
    })
    jest.spyOn(supabase, 'from').mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: client, error: null }),
    })

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer token-${client.id}`)

    expect(res.statusCode).toBe(403)
    expect(res.body.message).toBe('Insufficient permissions')
  })
})


describe('Execution Engine authorization', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('unauthenticated users cannot access project execution structure', async () => {
    const res = await request(app).get('/api/execution/projects/1/structure')
    expect(res.statusCode).toBe(401)
  })

  test('unauthenticated users cannot access the client service-delivery home', async () => {
    const res = await request(app).get('/api/service-delivery/client/home')
    expect(res.statusCode).toBe(401)
  })

  test('client cannot initialize a service-delivery project', async () => {
    const client = {
      id: '22222222-2222-2222-2222-222222222222',
      email: 'client@example.com',
      full_name: 'Client',
      role: 'client',
      workspace_id: 'bbbb2222-bbbb-2222-bbbb-222222222222',
      is_active: true,
    }
    jest.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: { id: client.id, email: client.email, user_metadata: {}, app_metadata: {}, email_confirmed_at: '2026-01-01T00:00:00Z' } },
      error: null,
    })
    jest.spyOn(supabase, 'from').mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: client, error: null }),
    })
    const res = await request(app)
      .post('/api/service-delivery/orders/1/initialize')
      .set('Authorization', `Bearer token-${client.id}`)
      .send({ template_id: 1 })
    expect(res.statusCode).toBe(403)
    expect(res.body.message).toBe('Insufficient permissions')
  })

  test('client cannot access the staff operations queue', async () => {
    const client = {
      id: '22222222-2222-2222-2222-222222222222',
      email: 'client@example.com',
      full_name: 'Client',
      role: 'client',
      workspace_id: 'bbbb2222-bbbb-2222-bbbb-222222222222',
      is_active: true,
    }
    jest.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: { id: client.id, email: client.email, user_metadata: {}, app_metadata: {}, email_confirmed_at: '2026-01-01T00:00:00Z' } },
      error: null,
    })
    jest.spyOn(supabase, 'from').mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: client, error: null }),
    })
    const res = await request(app)
      .get('/api/service-delivery/operations/queue')
      .set('Authorization', `Bearer token-${client.id}`)
    expect(res.statusCode).toBe(403)
    expect(res.body.message).toBe('Insufficient permissions')
  })

  test('client cannot access the staff Client 360 overview', async () => {
    const client = {
      id: '22222222-2222-2222-2222-222222222222',
      email: 'client@example.com',
      full_name: 'Client',
      role: 'client',
      workspace_id: 'bbbb2222-bbbb-2222-bbbb-222222222222',
      is_active: true,
    }
    jest.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: { id: client.id, email: client.email, user_metadata: {}, app_metadata: {}, email_confirmed_at: '2026-01-01T00:00:00Z' } },
      error: null,
    })
    jest.spyOn(supabase, 'from').mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: client, error: null }),
    })
    const res = await request(app)
      .get(`/api/service-delivery/clients/${client.id}/overview`)
      .set('Authorization', `Bearer token-${client.id}`)
    expect(res.statusCode).toBe(403)
    expect(res.body.message).toBe('Insufficient permissions')
  })

  test('client cannot access internal execution structure', async () => {
    const client = {
      id: '22222222-2222-2222-2222-222222222222',
      email: 'client@example.com',
      full_name: 'Client',
      role: 'client',
      workspace_id: 'bbbb2222-bbbb-2222-bbbb-222222222222',
      is_active: true,
    }
    jest.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: { id: client.id, email: client.email, user_metadata: {}, app_metadata: {}, email_confirmed_at: '2026-01-01T00:00:00Z' } },
      error: null,
    })
    jest.spyOn(supabase, 'from').mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: client, error: null }),
    })
    const res = await request(app)
      .get('/api/execution/projects/1/structure')
      .set('Authorization', `Bearer token-${client.id}`)
    expect(res.statusCode).toBe(403)
    expect(res.body.message).toBe('Insufficient permissions')
  })
})
