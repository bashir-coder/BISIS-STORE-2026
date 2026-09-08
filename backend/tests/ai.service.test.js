const { askAssistant, getAiStatus } = require('../src/services/ai/ai.service')

describe('AI provider boundary', () => {
  const originalProvider = process.env.AI_PROVIDER
  const originalKey = process.env.OPENAI_API_KEY

  beforeEach(() => {
    delete process.env.AI_PROVIDER
    delete process.env.OPENAI_API_KEY
  })

  afterAll(() => {
    if (originalProvider === undefined) delete process.env.AI_PROVIDER
    else process.env.AI_PROVIDER = originalProvider
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = originalKey
  })

  it('reports disabled and returns a structured unavailable state without a provider key', async () => {
    expect(getAiStatus()).toEqual({ provider: 'disabled', status: 'disabled', configured: false })
    await expect(askAssistant({ question: 'hello', language: 'en' })).resolves.toEqual({
      status: 'disabled',
      code: 'AI_PROVIDER_DISABLED',
      message: 'AI assistant is not configured.',
    })
  })
})
