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

jest.mock('../src/api/middleware/cache.middleware', () => {
  const fn = () => (_req, _res, next) => next()
  fn.clearCache = jest.fn()
  return fn
})

jest.mock('../src/config/supabase.config', () => ({
  from: jest.fn(),
}))

const supabase = require('../src/config/supabase.config')
const router = require('../src/api/routes/packages.routes')

const app = express()
app.use(express.json())
app.use('/packages', router)

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

describe('Packages', () => {
  beforeEach(() => jest.clearAllMocks())

  test('public list returns packages', async () => {
    const q = createQuery({ data: [{ id: 1, name: 'p', is_active: true }], error: null })
    supabase.from.mockReturnValue(q)
    const res = await request(app).get('/packages')
    expect(res.status).toBe(200)
  })

  test('admin list requires admin', async () => {
    const res = await request(app).get('/packages/admin')
    expect(res.status).toBe(403)
  })

  test('create requires name', async () => {
    const res = await request(app).post('/packages').set('x-test-role', 'admin').send({})
    expect(res.status).toBe(400)
  })

  test('create package as admin', async () => {
    const q = createQuery({ data: { id: 1, name: 'p', slug: 'p' }, error: null })
    supabase.from.mockReturnValue(q)
    const res = await request(app).post('/packages').set('x-test-role', 'admin').send({ name: 'p' })
    expect(res.status).toBe(201)
  })

test('delete requires admin', async () => {
    const res = await request(app).delete('/packages/1')
    expect(res.status).toBe(403)
  })

  test('created package payload does not include retired tier columns', async () => {
    const q = createQuery({ data: { id: 1, name: 'p', slug: 'p' }, error: null })
    supabase.from.mockReturnValue(q)
    const res = await request(app)
      .post('/packages')
      .set('x-test-role', 'admin')
      .send({
        name: 'p',
        tier_starter_price: '$99',
        tier_starter_features: ['a', 'b'],
        tier_growth_price: '$199',
        tier_growth_features: ['c'],
        tier_investor_price: '$499',
        tier_investor_features: ['d'],
      })
    expect(res.status).toBe(201)
    const inserted = q.insert.mock.calls[0][0][0]
    expect(inserted).not.toHaveProperty('tier_starter_price')
    expect(inserted).not.toHaveProperty('tier_starter_features')
    expect(inserted).not.toHaveProperty('tier_growth_price')
    expect(inserted).not.toHaveProperty('tier_growth_features')
    expect(inserted).not.toHaveProperty('tier_investor_price')
    expect(inserted).not.toHaveProperty('tier_investor_features')
    expect(inserted).toHaveProperty('price', 99)
    expect(inserted).toHaveProperty('features', ['a', 'b'])
  })

  test('updated package payload does not include retired tier columns', async () => {
    const q = createQuery({ data: { id: 1, name: 'p' }, error: null })
    supabase.from.mockReturnValue(q)
    const res = await request(app)
      .put('/packages/1')
      .set('x-test-role', 'admin')
      .send({
        tier_starter_price: '$99',
        tier_growth_features: ['c'],
        tier_investor_price: '$499',
      })
    expect(res.status).toBe(200)
    const updated = q.update.mock.calls[0][0]
    expect(updated).not.toHaveProperty('tier_starter_price')
    expect(updated).not.toHaveProperty('tier_starter_features')
    expect(updated).not.toHaveProperty('tier_growth_price')
    expect(updated).not.toHaveProperty('tier_growth_features')
    expect(updated).not.toHaveProperty('tier_investor_price')
    expect(updated).not.toHaveProperty('tier_investor_features')
  })
})
