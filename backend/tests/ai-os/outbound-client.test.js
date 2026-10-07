'use strict'

const { sendToAIOS } = require('../../src/services/ai-os/client')

describe('AI OS outbound client', () => {
  const originalFetch = global.fetch
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
      }),
    )
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  test('fails closed when AI_OS_ENABLED is false', async () => {
    process.env.AI_OS_ENABLED = 'false'
    process.env.AI_OS_WEBHOOK_URL = 'https://example.com/webhook'
    process.env.AI_OS_WEBHOOK_SECRET = 'secret'

    await expect(sendToAIOS({ task: 'test' })).rejects.toMatchObject({
      code: 'AI_OS_INTEGRATION_DISABLED',
      status: 503,
    })
  })

  test('fails closed when webhook URL is missing', async () => {
    process.env.AI_OS_ENABLED = 'true'
    delete process.env.AI_OS_WEBHOOK_URL
    process.env.AI_OS_WEBHOOK_SECRET = 'secret'

    await expect(sendToAIOS({ task: 'test' })).rejects.toMatchObject({
      code: 'AI_OS_CONFIGURATION_MISSING',
      status: 503,
    })
  })

  test('rejects invalid request before transport', async () => {
    process.env.AI_OS_ENABLED = 'true'
    process.env.AI_OS_WEBHOOK_URL = 'https://example.com/webhook'
    process.env.AI_OS_WEBHOOK_SECRET = 'secret'

    await expect(sendToAIOS({})).rejects.toMatchObject({
      code: 'AI_OS_REQUEST_VALIDATION_FAILED',
      status: 400,
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('maps timeout error', async () => {
    process.env.AI_OS_ENABLED = 'true'
    process.env.AI_OS_WEBHOOK_URL = 'https://example.com/webhook'
    process.env.AI_OS_WEBHOOK_SECRET = 'secret'
    process.env.AI_OS_TIMEOUT_MS = '100'

    global.fetch = jest.fn(() => {
      const err = new Error('The operation was aborted')
      err.name = 'AbortError'
      return Promise.reject(err)
    })

    await expect(sendToAIOS({ task: 'test' })).rejects.toMatchObject({
      code: 'AI_OS_TIMEOUT',
      status: 504,
    })
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  test('maps network failure', async () => {
    process.env.AI_OS_ENABLED = 'true'
    process.env.AI_OS_WEBHOOK_URL = 'https://example.com/webhook'
    process.env.AI_OS_WEBHOOK_SECRET = 'secret'

    const networkError = new Error('connect ECONNREFUSED')
    networkError.code = 'ECONNREFUSED'
    global.fetch = jest.fn(() => Promise.reject(networkError))

    await expect(sendToAIOS({ task: 'test' })).rejects.toMatchObject({
      code: 'AI_OS_TRANSPORT_FAILURE',
      status: 502,
    })
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  test('returns transport success without inventing AI semantics', async () => {
    process.env.AI_OS_ENABLED = 'true'
    process.env.AI_OS_WEBHOOK_URL = 'https://example.com/webhook'
    process.env.AI_OS_WEBHOOK_SECRET = 'secret'

    const result = await sendToAIOS({ task: 'test' })
    expect(result).toEqual({
      accepted: true,
      status: 200,
      response_available: false,
      _correlation_id: expect.any(String),
    })
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  test('handles HTTP error response', async () => {
    process.env.AI_OS_ENABLED = 'true'
    process.env.AI_OS_WEBHOOK_URL = 'https://example.com/webhook'
    process.env.AI_OS_WEBHOOK_SECRET = 'secret'

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      }),
    )

    await expect(sendToAIOS({ task: 'test' })).rejects.toMatchObject({
      code: 'AI_OS_TRANSPORT_FAILURE',
      status: 400,
    })
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  test('never exposes secrets in errors', async () => {
    process.env.AI_OS_ENABLED = 'true'
    process.env.AI_OS_WEBHOOK_URL = 'https://example.com/webhook'
    process.env.AI_OS_WEBHOOK_SECRET = 'super-secret-key'

    global.fetch = jest.fn(() => Promise.reject(new Error('Network error')))

    try {
      await sendToAIOS({ task: 'test' })
    } catch (err) {
      expect(err.message).not.toContain('super-secret-key')
      expect(err.message).not.toContain('WEBHOOK_SECRET')
    }
  })

  test('no automatic retry on failure', async () => {
    process.env.AI_OS_ENABLED = 'true'
    process.env.AI_OS_WEBHOOK_URL = 'https://example.com/webhook'
    process.env.AI_OS_WEBHOOK_SECRET = 'secret'

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      }),
    )

    await expect(sendToAIOS({ task: 'test' })).rejects.toThrow()
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  test('sends only verified Make fields and strips internal metadata', async () => {
    process.env.AI_OS_ENABLED = 'true'
    process.env.AI_OS_WEBHOOK_URL = 'https://example.com/webhook'
    process.env.AI_OS_WEBHOOK_SECRET = 'secret'

    await sendToAIOS({
      task: 'test task',
      description: 'desc',
      context: 'ctx',
      priority: 'high',
      requested_agent: 'agent',
      founder_approval: true,
      task_id: 'task-123',
      timestamp: '2026-01-01T00:00:00Z',
      attachments: [{ url: 'http://example.com/file' }],
    })

    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/webhook',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    )

    const callArgs = global.fetch.mock.calls[0]
    const body = JSON.parse(callArgs[1].body)
    expect(body).toEqual({
      task: 'test task',
      description: 'desc',
      context: 'ctx',
      priority: 'high',
      requested_agent: 'agent',
      founder_approval: true,
      task_id: 'task-123',
      timestamp: '2026-01-01T00:00:00Z',
      attachments: [{ url: 'http://example.com/file' }],
    })
    expect(body).not.toHaveProperty('_backend_source')
    expect(body).not.toHaveProperty('_correlation_id')
  })
})
