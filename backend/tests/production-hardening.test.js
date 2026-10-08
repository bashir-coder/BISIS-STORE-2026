/**
 * BİŞİŞ V1 — production hardening tests.
 *
 * Covers:
 *  - API documentation (Swagger) gating in production
 *  - Provider IPN exemption from the global rate limiter
 */

const request = require('supertest')

// Loading the server in production mode is slow (Swagger is rebuilt,
// providers are initialized, etc.) — the default 5000 ms Jest timeout
// is not enough. Bump it for this file only.
jest.setTimeout(60000)

const originalNodeEnv = process.env.NODE_ENV
const originalSwaggerEnabled = process.env.SWAGGER_ENABLED

const loadServer = (nodeEnv, swaggerEnabled) => {
  jest.resetModules()
  process.env.NODE_ENV = nodeEnv
  if (swaggerEnabled === undefined) {
    delete process.env.SWAGGER_ENABLED
  } else {
    process.env.SWAGGER_ENABLED = swaggerEnabled
  }
  return require('../server')
}

afterEach(() => {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV
  } else {
    process.env.NODE_ENV = originalNodeEnv
  }

  if (originalSwaggerEnabled === undefined) {
    delete process.env.SWAGGER_ENABLED
  } else {
    process.env.SWAGGER_ENABLED = originalSwaggerEnabled
  }
})

describe('API documentation gating', () => {
  test('hides /api-docs and /api-docs.json in production by default', async () => {
    const app = loadServer('production')
    const client = request(app)

    const ui = await client.get('/api-docs')
    expect(ui.statusCode).toBe(404)

    const json = await client.get('/api-docs.json')
    expect(json.statusCode).toBe(404)
  })

  test('serves API documentation in production when explicitly enabled', async () => {
    const app = loadServer('production', 'true')
    const client = request(app)

    const json = await client.get('/api-docs.json')
    expect(json.statusCode).toBe(200)
    expect(json.body).toHaveProperty('openapi', '3.0.0')

    // swagger-ui-express serves the UI under the
    // trailing-slash path and redirects /api-docs
    // to it, so both prove the docs are mounted.
    const redirect = await client.get('/api-docs')
    expect([301, 302]).toContain(redirect.statusCode)

    const ui = await client.get('/api-docs/')
    expect(ui.statusCode).toBe(200)
  })

  test('serves API documentation outside production by default', async () => {
    const app = loadServer('development')
    const client = request(app)

    const json = await client.get('/api-docs.json')
    expect(json.statusCode).toBe(200)
    expect(json.body).toHaveProperty('openapi', '3.0.0')
  })
})

describe('Provider IPN rate limiting', () => {
  test('never throttles the NOWPayments IPN endpoints', async () => {
    const app = loadServer('test')
    const client = request(app)

    const statuses = []
    for (let index = 0; index < 105; index += 1) {
      const response = await client
        .post('/api/nowpayments/ipn')
        .send({ order_id: '42' })
      statuses.push(response.statusCode)
    }

    // Every request must reach the HMAC verification
    // (401 for a missing signature). A 429 would mean
    // the global limiter throttled the provider.
    expect(statuses).not.toContain(429)
    expect(new Set(statuses)).toEqual(new Set([401]))
  })

  test('never throttles the order-scoped IPN compatibility endpoint', async () => {
    const app = loadServer('test')
    const client = request(app)

    const statuses = []
    for (let index = 0; index < 105; index += 1) {
      const response = await client
        .post('/api/orders/42/nowpayments-ipn')
        .send({ order_id: '42' })
      statuses.push(response.statusCode)
    }

    expect(statuses).not.toContain(429)
    expect(new Set(statuses)).toEqual(new Set([401]))
  })

  test('still rate-limits other API routes', async () => {
    const app = loadServer('test')
    const client = request(app)

    const statuses = []
    for (let index = 0; index < 105; index += 1) {
      const response = await client.get('/api/live')
      statuses.push(response.statusCode)
    }

    expect(statuses).toContain(429)
    expect(statuses[0]).toBe(200)
  })
})
