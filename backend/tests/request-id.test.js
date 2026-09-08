const request = require('supertest')
const app = require('../server')

describe('request correlation', () => {
  it('preserves a safe incoming request id in the response header', async () => {
    const response = await request(app)
      .get('/api/health')
      .set('x-request-id', 'ops-test-123')

    expect(response.headers['x-request-id']).toBe('ops-test-123')
  })

  it('generates a request id when the incoming value is unsafe', async () => {
    const response = await request(app)
      .get('/api/health')
      .set('x-request-id', 'contains spaces')

    expect(response.headers['x-request-id']).toMatch(/^[A-Za-z0-9._:-]+$/)
  })
})
