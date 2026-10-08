'use strict'

const { sendTask } = require('../../src/services/ai-os/service')

jest.mock('../../src/services/ai-os/client', () => ({
  sendToAIOS: jest.fn(),
}))

const { sendToAIOS } = require('../../src/services/ai-os/client')

describe('AI OS integration service', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
    jest.clearAllMocks()
  })

  afterAll(() => {
    process.env = originalEnv
  })

  test('delegates a valid request to the client', async () => {
    process.env.AI_OS_ENABLED = 'true'
    process.env.AI_OS_WEBHOOK_URL = 'https://example.com/webhook'
    process.env.AI_OS_WEBHOOK_SECRET = 'secret'

    sendToAIOS.mockResolvedValue({
      accepted: true,
      status: 200,
      response_available: false,
      _correlation_id: 'corr-123',
    })

    const result = await sendTask({ task: 'test' })

    expect(sendToAIOS).toHaveBeenCalledWith(
      { task: 'test' },
      {},
    )
    expect(result).toEqual({
      accepted: true,
      status: 200,
      response_available: false,
      _correlation_id: 'corr-123',
    })
  })

  test('returns transport-level success without inventing AI semantics', async () => {
    process.env.AI_OS_ENABLED = 'true'
    process.env.AI_OS_WEBHOOK_URL = 'https://example.com/webhook'
    process.env.AI_OS_WEBHOOK_SECRET = 'secret'

    sendToAIOS.mockResolvedValue({
      accepted: true,
      status: 202,
      response_available: false,
      _correlation_id: 'corr-456',
    })

    const result = await sendTask({ task: 'summarize' })

    expect(result).toEqual({
      accepted: true,
      status: 202,
      response_available: false,
      _correlation_id: 'corr-456',
    })
    expect(result).not.toHaveProperty('route')
    expect(result).not.toHaveProperty('category')
    expect(result).not.toHaveProperty('operation')
    expect(result).not.toHaveProperty('execution_allowed')
    expect(result).not.toHaveProperty('approval_required')
    expect(result).not.toHaveProperty('action')
    expect(result).not.toHaveProperty('report')
    expect(result).not.toHaveProperty('execution_id')
    expect(result).not.toHaveProperty('verification')
  })

  test('preserves _correlation_id from client', async () => {
    process.env.AI_OS_ENABLED = 'true'
    process.env.AI_OS_WEBHOOK_URL = 'https://example.com/webhook'
    process.env.AI_OS_WEBHOOK_SECRET = 'secret'

    sendToAIOS.mockResolvedValue({
      accepted: true,
      status: 200,
      response_available: false,
      _correlation_id: 'backend-correlation-789',
    })

    const result = await sendTask({ task: 'test' })

    expect(result._correlation_id).toBe('backend-correlation-789')
  })

  test('propagates client errors unchanged', async () => {
    process.env.AI_OS_ENABLED = 'true'
    process.env.AI_OS_WEBHOOK_URL = 'https://example.com/webhook'
    process.env.AI_OS_WEBHOOK_SECRET = 'secret'

    const error = new Error('validation failed')
    error.status = 400
    error.code = 'AI_OS_REQUEST_VALIDATION_FAILED'
    sendToAIOS.mockRejectedValue(error)

    await expect(sendTask({ task: '' })).rejects.toMatchObject({
      message: 'validation failed',
      status: 400,
      code: 'AI_OS_REQUEST_VALIDATION_FAILED',
    })
  })

  test('does not call Make directly', async () => {
    process.env.AI_OS_ENABLED = 'true'
    process.env.AI_OS_WEBHOOK_URL = 'https://example.com/webhook'
    process.env.AI_OS_WEBHOOK_SECRET = 'secret'

    sendToAIOS.mockResolvedValue({
      accepted: true,
      status: 200,
      response_available: false,
      _correlation_id: 'corr-direct',
    })

    await sendTask({ task: 'test' })

    expect(sendToAIOS).toHaveBeenCalledTimes(1)
  })

  test('does not implement retry behavior', async () => {
    process.env.AI_OS_ENABLED = 'true'
    process.env.AI_OS_WEBHOOK_URL = 'https://example.com/webhook'
    process.env.AI_OS_WEBHOOK_SECRET = 'secret'

    sendToAIOS.mockRejectedValue(new Error('transport failure'))

    await expect(sendTask({ task: 'test' })).rejects.toThrow(
      'transport failure',
    )
    expect(sendToAIOS).toHaveBeenCalledTimes(1)
  })

  test('invalid requests remain rejected through client path', async () => {
    process.env.AI_OS_ENABLED = 'true'
    process.env.AI_OS_WEBHOOK_URL = 'https://example.com/webhook'
    process.env.AI_OS_WEBHOOK_SECRET = 'secret'

    const error = new Error('invalid request')
    error.status = 400
    error.code = 'AI_OS_REQUEST_VALIDATION_FAILED'
    sendToAIOS.mockRejectedValue(error)

    await expect(sendTask({ task: '' })).rejects.toMatchObject({
      status: 400,
      code: 'AI_OS_REQUEST_VALIDATION_FAILED',
    })
  })

  test('passes correlationId option through to client', async () => {
    process.env.AI_OS_ENABLED = 'true'
    process.env.AI_OS_WEBHOOK_URL = 'https://example.com/webhook'
    process.env.AI_OS_WEBHOOK_SECRET = 'secret'

    sendToAIOS.mockResolvedValue({
      accepted: true,
      status: 200,
      response_available: false,
      _correlation_id: 'corr-option',
    })

    await sendTask({ task: 'test' }, { correlationId: 'req-999' })

    expect(sendToAIOS).toHaveBeenCalledWith(
      { task: 'test' },
      { correlationId: 'req-999' },
    )
  })
})
