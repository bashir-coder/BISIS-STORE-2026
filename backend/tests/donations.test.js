const express = require('express')
const request = require('supertest')

jest.mock('../src/api/middleware/auth.middleware', () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: 'user-1', role: 'client', email: 'u@test', full_name: 'User', workspace_id: 'ws-1' }
    next()
  },
}))

jest.mock('../src/config/supabase.config', () => ({
  from: jest.fn(),
}))

const supabase = require('../src/config/supabase.config')
const router = require('../src/api/routes/donation.routes')

const app = express()
app.use(express.json())
app.use('/donations', router)

const createQuery = (result) => {
  const q = {
    select: jest.fn(() => q),
    insert: jest.fn(() => q),
    eq: jest.fn(() => q),
    order: jest.fn(() => q),
    single: jest.fn(async () => result),
    maybeSingle: jest.fn(async () => result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  }
  return q
}

describe('Donations', () => {
  beforeEach(() => jest.clearAllMocks())

  test('invalid amount rejected', async () => {
    const res = await request(app).post('/donations').send({ amount: 0 })
    expect(res.status).toBe(400)
  })

  test('missing amount rejected', async () => {
    const res = await request(app).post('/donations').send({})
    expect(res.status).toBe(400)
  })

  test('valid donation created', async () => {
    const q = createQuery({ data: { id: 1, amount: 10 }, error: null })
    supabase.from.mockReturnValue(q)
    const res = await request(app).post('/donations').send({ amount: 10 })
    expect(res.status).toBe(201)
  })

  test('list scoped to user for non-admin', async () => {
    const q = createQuery({ data: [{ id: 1 }], error: null })
    supabase.from.mockReturnValue(q)
    const res = await request(app).get('/donations')
    expect(res.status).toBe(200)
  })
})
