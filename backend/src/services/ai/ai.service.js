const OpenAI = require('openai')

const getAiProvider = () => {
  const configuredProvider = String(process.env.AI_PROVIDER || '').trim().toLowerCase()
  if (configuredProvider === 'openai' && process.env.OPENAI_API_KEY) return 'openai'
  return 'disabled'
}

const getAiStatus = () => {
  const provider = getAiProvider()
  return {
    provider,
    status: provider === 'disabled' ? 'disabled' : 'configured',
    configured: provider !== 'disabled',
  }
}

const askAssistant = async ({ question, context, language }) => {
  const status = getAiStatus()
  if (!status.configured) {
    return {
      status: 'disabled',
      code: 'AI_PROVIDER_DISABLED',
      message: 'AI assistant is not configured.',
    }
  }

  if (status.provider !== 'openai') {
    return {
      status: 'disabled',
      code: 'AI_PROVIDER_UNSUPPORTED',
      message: 'The configured AI provider is not available.',
    }
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: `You are the BİŞIŞ support assistant. Reply in ${language === 'ar' ? 'Arabic' : language === 'tr' ? 'Turkish' : 'English'}. Do not claim that payment is available unless the application explicitly confirms it.`,
      },
      ...(context ? [{ role: 'assistant', content: String(context).slice(0, 4000) }] : []),
      { role: 'user', content: String(question).slice(0, 4000) },
    ],
    temperature: 0.4,
    max_tokens: 500,
  })

  const answer = completion.choices[0]?.message?.content?.trim()
  if (!answer) throw new Error('AI provider returned no answer')
  return { status: 'real', provider: status.provider, answer }
}

module.exports = { askAssistant, getAiStatus }
