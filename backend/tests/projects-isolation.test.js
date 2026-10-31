const request = require('supertest')
const app = require('../server')
const supabase = require('../src/config/supabase.config')

const workspaceA = 'workspace-a'
const workspaceB = 'workspace-b'
const projectA = { id: 'project-a', workspace_id: workspaceA, name: 'Project A' }
const projectB = { id: 'project-b', workspace_id: workspaceB, name: 'Project B' }
const orderA = { id: 'order-a', workspace_id: workspaceA, project_id: null }
const orderB = { id: 'order-b', workspace_id: workspaceB, project_id: null }

describe('Project workspace isolation', () => {
  let profile
  let tables
  let queries
  let mutations
  let nextProjectId

  const resetData = (user) => {
    profile = user
    tables = {
      projects: [{ ...projectA }, { ...projectB }],
      orders: [{ ...orderA, project_id: 'project-a' }, { ...orderB }],
    }
    queries = []
    mutations = []
    nextProjectId = 1
  }

  const matches = (row, filters) => filters.every(({ column, value }) => (
    String(row[column]) === String(value)
  ))

  const makeQuery = (table) => {
    const query = {
      table,
      action: 'select',
      filters: [],
      payload: null,
      returning: false,
      select() {
        this.returning = true
        return this
      },
      eq(column, value) {
        this.filters.push({ column, value })
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
          table: this.table,
          action: this.action,
          filters: [...this.filters],
        })

        if (this.table === 'users') {
          return { data: profile, error: null }
        }

        const rows = tables[this.table]
        if (this.action === 'select') {
          return { data: rows.filter((row) => matches(row, this.filters)), error: null }
        }
        if (this.action === 'insert') {
          const inserted = this.payload.map((row) => ({
            id: `created-project-${nextProjectId++}`,
            ...row,
          }))
          rows.push(...inserted)
          mutations.push({ table: this.table, action: this.action, rows: inserted })
          return { data: inserted, error: null }
        }

        const matched = rows.filter((row) => matches(row, this.filters))
        mutations.push({
          table: this.table,
          action: this.action,
          payload: this.payload,
          filters: [...this.filters],
          rows: matched.map((row) => ({ ...row })),
        })
        if (this.action === 'update') {
          matched.forEach((row) => Object.assign(row, this.payload))
          return { data: this.returning ? matched : null, error: null }
        }
        if (this.action === 'delete') {
          tables[this.table] = rows.filter((row) => !matched.includes(row))
          return { data: null, error: null }
        }
        return { data: null, error: null }
      },
      single: async function () {
        const result = this.execute()
        const rows = Array.isArray(result.data) ? result.data : []
        return rows.length === 1
          ? { data: rows[0], error: null }
          : { data: null, error: { code: 'PGRST116', message: 'No rows found' } }
      },
      maybeSingle: async function () {
        const result = this.execute()
        if (!Array.isArray(result.data)) return result
        return { data: result.data[0] || null, error: null }
      },
      then(resolve, reject) {
        return Promise.resolve(this.execute()).then(resolve, reject)
      },
    }
    return query
  }

  const send = (method, path, body) => {
    const req = request(app)[method](path).set('Authorization', 'Bearer local-test-token')
    return body === undefined ? req : req.send(body)
  }

  const projectOrderQueries = () => queries.filter(({ table }) => (
    table === 'projects' || table === 'orders'
  ))

  beforeEach(() => {
    resetData({ id: 'admin-a', role: 'admin', workspace_id: workspaceA, is_active: true })
    jest.spyOn(supabase.auth, 'getUser').mockImplementation(async () => ({
      data: { user: { id: profile.id, email: 'test@example.invalid' } },
      error: null,
    }))
    jest.spyOn(supabase, 'from').mockImplementation((table) => makeQuery(table))
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test.each([
    ['null', null],
    ['missing', undefined],
    ['empty', ''],
  ])('rejects every project endpoint for admin with a %s workspace before project/order queries', async (_description, workspaceId) => {
    const user = { id: 'admin-no-workspace', role: 'admin', is_active: true }
    if (workspaceId !== undefined) user.workspace_id = workspaceId
    resetData(user)
    const routes = [
      ['get', '/api/projects'],
      ['get', '/api/projects/project-a'],
      ['post', '/api/projects', { name: 'New project' }],
      ['patch', '/api/projects/project-a', { name: 'Changed' }],
      ['delete', '/api/projects/project-a'],
      ['get', '/api/projects/project-a/orders'],
      ['patch', '/api/projects/project-a/assign/order-a'],
    ]

    for (const [method, path, body] of routes) {
      const res = await send(method, path, body)
      expect(res.statusCode).toBe(403)
      expect(res.body.message).toBe('An active workspace is required')
      expect(projectOrderQueries()).toHaveLength(0)
    }
    expect(mutations).toHaveLength(0)
  })

  test('admin from Workspace B cannot read, update, or delete a known Workspace A project', async () => {
    resetData({ id: 'admin-b', role: 'admin', workspace_id: workspaceB, is_active: true })

    const read = await send('get', '/api/projects/project-a')
    expect(read.statusCode).not.toBe(200)
    expect(JSON.stringify(read.body)).not.toContain('Project A')
    expect(projectOrderQueries().at(-1).filters).toContainEqual({ column: 'workspace_id', value: workspaceB })

    const orders = await send('get', '/api/projects/project-a/orders')
    expect(orders.statusCode).toBe(404)
    expect(projectOrderQueries().filter(({ table }) => table === 'orders')).toHaveLength(0)

    const update = await send('patch', '/api/projects/project-a', { name: 'stolen update' })
    expect(update.statusCode).not.toBe(200)
    expect(tables.projects.find(({ id }) => id === projectA.id).name).toBe('Project A')
    expect(mutations.some(({ table, action, rows }) => (
      table === 'projects' && action === 'update' && rows.some(({ id }) => id === projectA.id)
    ))).toBe(false)

    const remove = await send('delete', '/api/projects/project-a')
    expect(remove.statusCode).toBe(404)
    expect(tables.projects.some(({ id }) => id === projectA.id)).toBe(true)
    expect(mutations.some(({ action, rows }) => (
      action === 'delete' && rows.some(({ id }) => id === projectA.id)
    ))).toBe(false)
  })

  test.each([
    ['order B to project A', 'project-a', 'order-b'],
    ['order A to project B', 'project-b', 'order-a'],
  ])('admin B cannot assign %s across workspace boundaries', async (_description, targetProjectId, targetOrderId) => {
    resetData({ id: 'admin-b', role: 'admin', workspace_id: workspaceB, is_active: true })

    const res = await send('patch', `/api/projects/${targetProjectId}/assign/${targetOrderId}`)

    expect(res.statusCode).not.toBe(200)
    expect(mutations.some(({ table, action, rows }) => (
      table === 'orders' && action === 'update' && rows.some(({ id }) => id === targetOrderId)
    ))).toBe(false)
    const originalProjectId = targetOrderId === 'order-a' ? 'project-a' : null
    expect(tables.orders.find(({ id }) => id === targetOrderId).project_id).toBe(originalProjectId)
  })

  test.each([
    ['missing project', 'missing-project', 'order-a'],
    ['missing order', 'project-a', 'missing-order'],
  ])('does not assign when the %s is absent', async (_description, targetProjectId, targetOrderId) => {
    const res = await send('patch', `/api/projects/${targetProjectId}/assign/${targetOrderId}`)

    expect(res.statusCode).toBe(404)
    expect(mutations.some(({ table, action }) => table === 'orders' && action === 'update')).toBe(false)
  })

  test('admin can perform project operations within their workspace with scoped queries and mutations', async () => {
    const list = await send('get', '/api/projects')
    expect(list.statusCode).toBe(200)
    expect(list.body.map(({ id }) => id)).toEqual(['project-a'])
    expect(projectOrderQueries().at(-1).filters).toContainEqual({ column: 'workspace_id', value: workspaceA })

    const create = await send('post', '/api/projects', { name: 'Created in A' })
    expect(create.statusCode).toBe(201)
    expect(create.body.workspace_id).toBe(workspaceA)

    const update = await send('patch', '/api/projects/project-a', { name: 'Updated in A' })
    expect(update.statusCode).toBe(200)
    expect(mutations.find(({ table, action }) => table === 'projects' && action === 'update').filters)
      .toContainEqual({ column: 'workspace_id', value: workspaceA })

    const orders = await send('get', '/api/projects/project-a/orders')
    expect(orders.statusCode).toBe(200)
    expect(orders.body.map(({ id }) => id)).toEqual(['order-a'])

    const assignment = await send('patch', '/api/projects/project-a/assign/order-a')
    expect(assignment.statusCode).toBe(200)
    const assignmentMutation = mutations.find(({ table, action }) => table === 'orders' && action === 'update')
    expect(assignmentMutation.filters).toContainEqual({ column: 'workspace_id', value: workspaceA })
    expect(tables.orders.find(({ id }) => id === 'order-a').project_id).toBe('project-a')

    const remove = await send('delete', '/api/projects/project-a')
    expect(remove.statusCode).toBe(200)
    const detachMutation = mutations.find(({ table, action, payload }) => (
      table === 'orders' && action === 'update' && payload?.project_id === null
    ))
    expect(detachMutation.filters).toContainEqual({ column: 'workspace_id', value: workspaceA })
    expect(tables.orders.find(({ id }) => id === 'order-b').project_id).toBeNull()
    expect(tables.projects.some(({ id }) => id === 'project-a')).toBe(false)
  })

  test('super_admin retains global project access but cannot create a cross-workspace assignment', async () => {
    resetData({ id: 'super-admin', role: 'super_admin', workspace_id: null, is_active: true })

    const list = await send('get', '/api/projects')
    expect(list.statusCode).toBe(200)
    expect(list.body.map(({ id }) => id).sort()).toEqual(['project-a', 'project-b'])

    tables.orders.find(({ id }) => id === 'order-b').project_id = 'project-a'
    const orders = await send('get', '/api/projects/project-a/orders')
    expect(orders.statusCode).toBe(200)
    expect(orders.body.map(({ id }) => id)).toEqual(['order-a'])
    expect(projectOrderQueries().filter(({ table }) => table === 'orders').at(-1).filters)
      .toContainEqual({ column: 'workspace_id', value: workspaceA })

    const update = await send('patch', '/api/projects/project-a', { name: 'Global admin update' })
    expect(update.statusCode).toBe(200)
    expect(mutations.find(({ table, action }) => table === 'projects' && action === 'update').filters)
      .not.toContainEqual(expect.objectContaining({ column: 'workspace_id' }))

    const crossWorkspaceAssignment = await send('patch', '/api/projects/project-a/assign/order-b')
    expect(crossWorkspaceAssignment.statusCode).toBe(400)
    expect(mutations.some(({ table, action }) => table === 'orders' && action === 'update')).toBe(false)
    expect(tables.orders.find(({ id }) => id === 'order-b').project_id).toBe('project-a')
  })

  test.each(['manager', 'editor', 'client'])(
    '%s is rejected from all project routes before project/order queries',
    async (role) => {
      resetData({ id: `user-${role}`, role, workspace_id: workspaceA, is_active: true })
      const routes = [
        ['get', '/api/projects'],
        ['get', '/api/projects/project-a'],
        ['post', '/api/projects', { name: 'New project' }],
        ['patch', '/api/projects/project-a', { name: 'Changed' }],
        ['delete', '/api/projects/project-a'],
        ['get', '/api/projects/project-a/orders'],
        ['patch', '/api/projects/project-a/assign/order-a'],
      ]

      for (const [method, path, body] of routes) {
        const res = await send(method, path, body)
        expect(res.statusCode).toBe(403)
        expect(res.body.message).toBe('Insufficient permissions')
      }
      expect(projectOrderQueries()).toHaveLength(0)
      expect(mutations).toHaveLength(0)
    }
  )
})
