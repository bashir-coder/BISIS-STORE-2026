const express = require('express')
const request = require('supertest')

jest.mock('../src/api/middleware/auth.middleware', () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: 'client-1', role: 'client' }
    next()
  },
}))

jest.mock('../src/config/supabase.config', () => ({
  from: jest.fn(),
}))

const supabase = require('../src/config/supabase.config')
const router = require('../src/api/routes/subscription.routes')

const app = express()
app.use(express.json())
app.use('/subscriptions', router)

describe('subscription activation safety', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('does not create an active subscription from a client request', async () => {
    const response = await request(app)
      .post('/subscriptions')
      .send({
        plan_type: 'life_plan',
        status: 'active',
        price: 0,
        user_id: 'attacker-selected-user',
        expires_at: '2099-01-01T00:00:00.000Z',
        payment_status: 'verified',
      })

    expect(response.status).toBe(409)
    expect(response.body.code).toBe('SUBSCRIPTION_CHECKOUT_UNAVAILABLE')
    expect(supabase.from).not.toHaveBeenCalled()
  })
})
