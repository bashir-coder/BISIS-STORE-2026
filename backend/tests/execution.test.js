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
const router = require('../src/api/routes/execution.routes')

const app = express()
app.use(express.json())
app.use('/execution', router)

const createQuery = (result) => {
  const q = {
    select: jest.fn(() => q),
    insert: jest.fn(() => q),
    update: jest.fn(() => q),
    eq: jest.fn(() => q),
    order: jest.fn(() => q),
    limit: jest.fn(() => q),
    single: jest.fn(async () => result),
    maybeSingle: jest.fn(async () => result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  }
  return q
}

describe('Execution', () => {
  beforeEach(() => jest.clearAllMocks())

  test('templates list requires staff', async () => {
    const res = await request(app).get('/execution/templates')
    expect(res.status).toBe(403)
  })

  test('staff can list templates', async () => {
    const q = createQuery({ data: [{ id: 1, name: 't' }], error: null })
    supabase.from.mockReturnValue(q)
    const res = await request(app).get('/execution/templates').set('x-test-role', 'admin')
    expect(res.status).toBe(200)
  })

  test('create template requires name and milestones', async () => {
    const res = await request(app).post('/execution/templates').set('x-test-role', 'admin').send({})
    expect(res.status).toBe(400)
  })

  test('invalid template id rejected on patch', async () => {
    const res = await request(app).patch('/execution/templates/abc').set('x-test-role', 'admin').send({ name: 'x' })
    expect(res.status).toBe(400)
  })

  test('invalid template id rejected on delete', async () => {
    const res = await request(app).delete('/execution/templates/abc').set('x-test-role', 'admin')
    expect(res.status).toBe(400)
  })
})
