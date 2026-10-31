const mockSupabase = {
  auth: { getUser: jest.fn() },
  from: jest.fn(),
}

jest.mock('../src/config/supabase.config', () => mockSupabase)

const express = require('express')
const request = require('supertest')
const router = require('../src/api/routes/service-delivery.routes')

const workspaceA = 'workspace-a'
const workspaceB = 'workspace-b'

describe('Service delivery initialization authorization', () => {
  let app
  let profile
  let order
  let membership
  let membershipError
  let membershipQueryThrows
  let projectInsertError
  let orderLinkError
  let linkConflict
  let tables
  let queries
  let mutations
  let nextProjectId

  const resetHarness = (options = {}) => {
    profile = options.profile || {
      id: 'staff-a',
      role: 'admin',
      workspace_id: workspaceA,
      is_active: true,
    }
    order = options.order === undefined
      ? {
          id: 42,
          workspace_id: workspaceA,
          payment_status: 'verified',
          status: 'paid',
          project_id: null,
          service: 'Design service',
        }
      : options.order
    membership = options.membership === undefined
      ? { workspace_id: workspaceA, user_id: profile.id }
      : options.membership
    membershipError = options.membershipError || null
    membershipQueryThrows = options.membershipQueryThrows || null
    projectInsertError = options.projectInsertError || null
    orderLinkError = options.orderLinkError || null
    linkConflict = Boolean(options.linkConflict)
    tables = {
      projects: [],
      project_activity: [],
      project_milestones: [],
      project_tasks: [],
      project_requirements: [],
    }
    queries = []
    mutations = []
    nextProjectId = 100

    mockSupabase.auth.getUser.mockImplementation(async (token) => (
      token === `token-${profile.id}`
        ? { data: { user: { id: profile.id, email: 'test@example.invalid' } }, error: null }
        : { data: { user: null }, error: new Error('Invalid token') }
    ))
    mockSupabase.from.mockImplementation((table) => makeQuery(table))
  }

  const matches = (row, filters) => filters.every(({ column, operator, value }) => (
    operator === 'is'
      ? row[column] === value
      : String(row[column]) === String(value)
  ))

  const makeQuery = (table) => {
    if (table === 'workspace_members' && membershipQueryThrows) throw membershipQueryThrows
    const query = {
      action: 'select',
      filters: [],
      payload: null,
      returning: false,
      select() {
        this.returning = true
        return this
      },
      eq(column, value) {
        this.filters.push({ column, operator: 'eq', value })
        return this
      },
      is(column, value) {
        this.filters.push({ column, operator: 'is', value })
        return this
      },
      order() {
        return this
      },
      insert(payload) {
        this.action = 'insert'
        this.payload = payload
        return this
      },
      update(payload) {
        this.action = 'update'
        this.payload = payload
        return this
      },
      delete() {
        this.action = 'delete'
        return this
      },
      execute() {
        queries.push({
          table,
          action: this.action,
          filters: [...this.filters],
          payload: this.payload,
        })

        if (this.action === 'select') {
          if (table === 'users') {
            return { data: matches(profile, this.filters) ? [profile] : [], error: null }
          }
          if (table === 'workspace_members') {
            if (membershipError) return { data: null, error: membershipError }
            return { data: membership && matches(membership, this.filters) ? [membership] : [], error: null }
          }
          if (table === 'orders') {
            return { data: order && matches(order, this.filters) ? [order] : [], error: null }
          }
          if (table === 'project_templates') {
            return {
              data: [{ id: 1, service_id: 7, name: 'Default', is_active: true }]
                .filter((row) => matches(row, this.filters)),
              error: null,
            }
          }
          if (table === 'projects') {
            return { data: tables.projects.filter((row) => matches(row, this.filters)), error: null }
          }
          return { data: tables[table] || [], error: null }
        }

        if (this.action === 'insert') {
          if (table === 'projects' && projectInsertError) {
            return { data: null, error: projectInsertError }
          }
          const inserted = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((row) => ({
            id: table === 'projects' ? nextProjectId++ : `${table}-${nextProjectId++}`,
            ...row,
          }))
          if (tables[table]) tables[table].push(...inserted)
          mutations.push({ table, action: 'insert', rows: inserted })
          return { data: this.returning ? inserted : null, error: null }
        }

        if (this.action === 'update') {
          if (table === 'orders' && orderLinkError) {
            return { data: null, error: orderLinkError }
          }
          if (table === 'orders' && linkConflict) {
            return { data: [], error: null }
          }
          const rows = table === 'orders'
            ? (order && matches(order, this.filters) ? [order] : [])
            : (tables[table] || []).filter((row) => matches(row, this.filters))
          rows.forEach((row) => Object.assign(row, this.payload))
          if (rows.length) mutations.push({ table, action: 'update', rows, payload: this.payload })
          return { data: this.returning ? rows : null, error: null }
        }

        if (this.action === 'delete') {
          const rows = (tables[table] || []).filter((row) => matches(row, this.filters))
          tables[table] = (tables[table] || []).filter((row) => !rows.includes(row))
          if (rows.length) mutations.push({ table, action: 'delete', rows })
          return { data: null, error: null }
        }

        return { data: null, error: null }
      },
      maybeSingle() {
        const result = this.execute()
        if (result.error || !Array.isArray(result.data)) return result
        if (result.data.length > 1) return { data: null, error: new Error('Multiple rows returned') }
        return { data: result.data[0] || null, error: null }
      },
      single() {
        const result = this.execute()
        if (result.error || !Array.isArray(result.data)) return result
        if (result.data.length !== 1) return { data: null, error: new Error('Expected one row') }
        return { data: result.data[0], error: null }
      },
      then(resolve, reject) {
        return Promise.resolve(this.execute()).then(resolve, reject)
      },
    }
    return query
  }

  const sendInitialize = (body = { template_id: 1 }) => request(app)
    .post('/api/service-delivery/orders/42/initialize')
    .set('Authorization', `Bearer token-${profile.id}`)
    .send(body)

  const hasMutation = (table, action) => mutations.some((mutation) => (
    mutation.table === table && mutation.action === action
  ))

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use('/api/service-delivery', router)
    resetHarness()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('authorized staff initializes an eligible order in the active workspace', async () => {
    const response = await sendInitialize()

    expect(response.statusCode).toBe(201)
    expect(response.body.data.project.workspace_id).toBe(workspaceA)
    expect(queries.find(({ table }) => table === 'orders').filters).toContainEqual({
      column: 'workspace_id',
      operator: 'eq',
      value: workspaceA,
    })
    expect(order.project_id).toBe(100)
    expect(hasMutation('projects', 'insert')).toBe(true)
    expect(hasMutation('orders', 'update')).toBe(true)
  })

  test('staff cannot initialize an order in another workspace', async () => {
    order = { ...order, workspace_id: workspaceB }

    const response = await sendInitialize({ template_id: 1, workspace_id: workspaceB })

    expect(response.statusCode).toBe(404)
    expect(response.body.message).toBe('Order not found')
    expect(hasMutation('projects', 'insert')).toBe(false)
    expect(hasMutation('orders', 'update')).toBe(false)
    expect(hasMutation('project_deliveries', 'update')).toBe(false)
  })

  test('ordinary staff cannot initialize an order with a null workspace', async () => {
    order = { ...order, workspace_id: null }

    const response = await sendInitialize()

    expect(response.statusCode).toBe(404)
    expect(hasMutation('projects', 'insert')).toBe(false)
    expect(hasMutation('orders', 'update')).toBe(false)
  })

  test('staff without an active workspace is rejected before workspace or order lookup', async () => {
    profile = { ...profile, workspace_id: null }

    const response = await sendInitialize()

    expect(response.statusCode).toBe(403)
    expect(queries.some(({ table }) => table === 'workspace_members' || table === 'orders')).toBe(false)
    expect(mutations).toHaveLength(0)
  })

  test.each([
    ['missing membership', { membership: null }, 403],
    ['membership lookup failure', { membershipError: new Error('membership lookup failed') }, 403],
    ['thrown membership lookup failure', { membershipQueryThrows: new Error('membership query unavailable') }, 500],
  ])(
    'staff is rejected when workspace authorization has a %s',
    async (_label, options, expectedStatus) => {
      resetHarness(options)

      const response = await sendInitialize()

      expect(response.statusCode).toBe(expectedStatus)
      expect(queries.some(({ table }) => table === 'workspace_members')).toBe(!options.membershipQueryThrows)
      expect(queries.some(({ table }) => table === 'orders')).toBe(false)
      expect(mutations).toHaveLength(0)
    },
    10000,
  )

  test('super_admin retains cross-workspace initialization', async () => {
    profile = { id: 'root', role: 'super_admin', workspace_id: null, is_active: true }
    order = { ...order, workspace_id: workspaceB }

    const response = await sendInitialize()

    expect(response.statusCode).toBe(201)
    expect(response.body.data.project.workspace_id).toBe(workspaceB)
    expect(queries.some(({ table }) => table === 'workspace_members')).toBe(false)
    expect(queries.find(({ table }) => table === 'orders').filters).not.toContainEqual(
      expect.objectContaining({ column: 'workspace_id' }),
    )
  })

  test('super_admin can initialize a null-workspace order using the existing profile-workspace fallback', async () => {
    profile = { id: 'root', role: 'super_admin', workspace_id: workspaceA, is_active: true }
    order = { ...order, workspace_id: null }

    const response = await sendInitialize()

    expect(response.statusCode).toBe(201)
    expect(response.body.data.project.workspace_id).toBe(workspaceA)
    expect(queries.some(({ table }) => table === 'workspace_members')).toBe(false)
  })

  test('super_admin without a profile workspace cannot create a project for a null-workspace order', async () => {
    profile = { id: 'root', role: 'super_admin', workspace_id: null, is_active: true }
    order = { ...order, workspace_id: null }

    const response = await sendInitialize()

    expect(response.statusCode).toBe(403)
    expect(response.body.message).toBe('An active workspace is required')
    expect(queries.some(({ table }) => table === 'workspace_members')).toBe(false)
    expect(hasMutation('projects', 'insert')).toBe(false)
    expect(hasMutation('orders', 'update')).toBe(false)
  })

  test('non-staff users are rejected before order access or mutation', async () => {
    profile = { ...profile, role: 'client' }

    const response = await sendInitialize()

    expect(response.statusCode).toBe(403)
    expect(response.body.message).toBe('Insufficient permissions')
    expect(queries.some(({ table }) => table === 'orders')).toBe(false)
    expect(mutations).toHaveLength(0)
  })

  test('missing orders do not create or link projects', async () => {
    order = null

    const response = await sendInitialize()

    expect(response.statusCode).toBe(404)
    expect(hasMutation('projects', 'insert')).toBe(false)
    expect(hasMutation('orders', 'update')).toBe(false)
  })

  test('project insertion failure does not attempt to link the order', async () => {
    projectInsertError = new Error('project insert failed')

    const response = await sendInitialize()

    expect(response.statusCode).toBe(500)
    expect(hasMutation('projects', 'insert')).toBe(false)
    expect(queries.some(({ table, action }) => table === 'orders' && action === 'update')).toBe(false)
  })

  test('order-link failure returns an error and invokes existing project cleanup', async () => {
    orderLinkError = new Error('order link failed')

    const response = await sendInitialize()

    expect(response.statusCode).toBe(500)
    expect(hasMutation('orders', 'update')).toBe(false)
    expect(hasMutation('projects', 'delete')).toBe(true)
    expect(tables.projects).toHaveLength(0)
  })

  test('zero rows updated by the conditional order link is a conflict, not success', async () => {
    linkConflict = true

    const response = await sendInitialize()

    expect(response.statusCode).toBe(409)
    expect(response.body.code).toBe('ORDER_LINK_CONFLICT')
    expect(hasMutation('orders', 'update')).toBe(false)
    expect(hasMutation('projects', 'delete')).toBe(true)
    expect(tables.projects).toHaveLength(0)
  })
})
