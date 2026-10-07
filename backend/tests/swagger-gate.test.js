const request = require('supertest')
const app = require('../server')

describe('Swagger gating', () => {
  test('exposes /api-docs in non-production environments', async () => {
    const res = await request(app).get('/api-docs').redirects(1)

    expect(res.statusCode).toBe(200)
  })

  test('exposes /api-docs.json in non-production environments', async () => {
    const res = await request(app).get('/api-docs.json')

    expect(res.statusCode).toBe(200)
    expect(res.body).toHaveProperty('openapi')
  })
})
