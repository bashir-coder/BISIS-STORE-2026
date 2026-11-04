const express = require('express')
const request = require('supertest')

jest.mock('../src/api/middleware/auth.middleware', () => ({
  authenticate: (req, _res, next) => {
    const role = req.get('x-test-role') || 'client'
    req.user = { id: `${role}-1`, role, email: `${role}@test`, workspace_id: 'ws-1', full_name: 'Test User' }
    next()
  },
  authorize: (...roles) => (req, res, next) => (
    roles.includes(req.user?.role)
      ? next()
      : res.status(403).json({ message: 'Insufficient permissions' })
  ),
}))

jest.mock('../src/config/supabase.config', () => ({
  from: jest.fn(),
}))

const supabase = require('../src/config/supabase.config')
const router = require('../src/api/routes/tickets.routes')

const app = express()
app.use(express.json())
app.use('/tickets', router)

const createQuery = (result) => {
  const q = {
    select: jest.fn(() => q),
    insert: jest.fn(() => q),
    update: jest.fn(() => q),
    eq: jest.fn(() => q),
    limit: jest.fn(() => q),
    order: jest.fn(() => q),
    single: jest.fn(async () => result),
    maybeSingle: jest.fn(async () => result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  }
  return q
}

describe('Tickets', () => {
  beforeEach(() => jest.clearAllMocks())

  test('create requires title and description', async () => {
    const res = await request(app).post('/tickets').send({})
    expect(res.status).toBe(400)
  })

  test('client can create ticket', async () => {
    const q = createQuery({ data: { id: 1, title: 't', status: 'open' }, error: null })
    supabase.from.mockReturnValue(q)
    const res = await request(app).post('/tickets').send({ title: 't', description: 'd' })
    expect(res.status).toBe(201)
  })

  test('invalid project_id rejected', async () => {
    const res = await request(app).post('/tickets').send({ title: 't', description: 'd', project_id: 'abc' })
    expect(res.status).toBe(400)
  })

  test('my tickets list scoped to user', async () => {
    const q = createQuery({ data: [{ id: 1 }], error: null })
    supabase.from.mockReturnValue(q)
    const res = await request(app).get('/tickets/my')
    expect(res.status).toBe(200)
  })

  test('admin list requires admin role', async () => {
    const res = await request(app).get('/tickets')
    expect(res.status).toBe(403)
  })

  test('admin can list tickets', async () => {
    const q = createQuery({ data: [{ id: 1 }], error: null })
    supabase.from.mockReturnValue(q)
    const res = await request(app).get('/tickets').set('x-test-role', 'admin')
    expect(res.status).toBe(200)
  })

  test('invalid ticket status rejected on patch', async () => {
    const res = await request(app).patch('/tickets/1').set('x-test-role', 'admin').send({ status: 'bogus' })
    expect(res.status).toBe(400)
  })
})
