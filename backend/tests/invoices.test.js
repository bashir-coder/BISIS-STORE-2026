const express = require('express')
const request = require('supertest')

jest.mock('../src/api/middleware/auth.middleware', () => ({
  authenticate: (req, _res, next) => {
    const role = req.get('x-test-role') || 'client'
    req.user = { id: `${role}-1`, role, workspace_id: 'ws-1' }
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
const router = require('../src/api/routes/invoices.routes')

const app = express()
app.use(express.json())
app.use('/invoices', router)

const createQuery = (result) => {
  const q = {
    select: jest.fn(() => q),
    insert: jest.fn(() => q),
    update: jest.fn(() => q),
    eq: jest.fn(() => q),
    order: jest.fn(() => q),
    single: jest.fn(async () => result),
    maybeSingle: jest.fn(async () => result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  }
  return q
}

describe('Invoices', () => {
  beforeEach(() => jest.clearAllMocks())

  test('create requires order_id', async () => {
    const res = await request(app).post('/invoices').set('x-test-role', 'admin').send({})
    expect(res.status).toBe(400)
  })

  test('invalid invoice status rejected', async () => {
    const res = await request(app).patch('/invoices/1').set('x-test-role', 'admin').send({ status: 'bogus' })
    expect(res.status).toBe(400)
  })

  test('client cannot list all invoices', async () => {
    const res = await request(app).get('/invoices')
    expect(res.status).toBe(403)
  })

  test('get missing invoice returns 404', async () => {
    const q = createQuery({ data: null, error: null })
    supabase.from.mockReturnValue(q)
    const res = await request(app).get('/invoices/1')
    expect(res.status).toBe(404)
  })
})
