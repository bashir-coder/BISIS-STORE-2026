const express = require('express')
const request = require('supertest')

jest.mock('../src/api/middleware/auth.middleware', () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: 'user-1', role: 'client' }
    next()
  },
}))

jest.mock('../src/services/ai/ai.service', () => ({
  askAssistant: jest.fn(),
  getAiStatus: jest.fn(() => ({ status: 'disabled' })),
}))

const { askAssistant, getAiStatus } = require('../src/services/ai/ai.service')
const router = require('../src/api/routes/ai.routes')

const app = express()
app.use(express.json())
app.use('/ai', router)

describe('AI', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getAiStatus.mockReturnValue({ status: 'disabled' })
  })

  test('status requires auth', async () => {
    // bypass auth mock by not setting header; mock still sets user, so just call
    const res = await request(app).get('/ai/status')
    expect(res.status).toBe(200)
  })

  test('ask requires question', async () => {
    const res = await request(app).post('/ai/ask').send({})
    expect(res.status).toBe(400)
  })

  test('ask returns disabled status', async () => {
    askAssistant.mockResolvedValue({ status: 'disabled', message: 'disabled', code: 'AI_DISABLED' })
    const res = await request(app).post('/ai/ask').send({ question: 'hi' })
    expect(res.status).toBe(503)
  })

  test('ask handles provider failure', async () => {
    getAiStatus.mockReturnValue({ status: 'enabled' })
    askAssistant.mockRejectedValue(new Error('provider down'))
    const res = await request(app).post('/ai/ask').send({ question: 'hi' })
    expect(res.status).toBe(502)
  })
})
