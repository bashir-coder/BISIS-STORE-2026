const express = require('express')
const request = require('supertest')

jest.mock('../src/api/middleware/auth.middleware', () => ({
  authenticate: (req, _res, next) => {
    const role = req.get('x-test-role') || 'client'
    req.user = { id: `${role}-1`, role }
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

jest.mock('../src/api/middleware/cache.middleware', () => {
  const fn = () => (_req, _res, next) => next()
  fn.clearCache = jest.fn()
  return fn
})

const supabase = require('../src/config/supabase.config')
const router = require('../src/api/routes/faqs.routes')

const app = express()
app.use(express.json())
app.use('/faqs', router)

const createQuery = (result) => {
  const query = {
    select: jest.fn(() => query),
    insert: jest.fn(() => query),
    update: jest.fn(() => query),
    eq: jest.fn(() => query),
    order: jest.fn(() => query),
    single: jest.fn(async () => result),
    maybeSingle: jest.fn(async () => result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  }
  return query
}

describe('FAQs', () => {
  beforeEach(() => jest.clearAllMocks())

  test('public list returns active FAQs', async () => {
    const q = createQuery({ data: [{ id: 1, question: { en: 'q' }, is_active: true }], error: null })
    supabase.from.mockReturnValue(q)
    const res = await request(app).get('/faqs')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  test('admin create requires auth', async () => {
    const res = await request(app).post('/faqs').send({})
    expect(res.status).toBe(403)
  })

  test('admin create validates question', async () => {
    const q = createQuery({ data: null, error: null })
    supabase.from.mockReturnValue(q)
    const res = await request(app).post('/faqs').set('x-test-role', 'admin').send({ answer: { en: 'a', ar: 'a', tr: 'a' } })
    expect(res.status).toBe(400)
  })

  test('invalid FAQ id rejected', async () => {
    const res = await request(app).patch('/faqs/not-an-id').set('x-test-role', 'admin').send({ question: { en: 'q', ar: 'q', tr: 'q' } })
    expect(res.status).toBe(400)
  })
})
