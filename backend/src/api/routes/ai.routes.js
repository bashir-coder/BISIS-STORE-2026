const express = require('express')
const { authenticate } = require('../middleware/auth.middleware')
const { askAssistant, getAiStatus } = require('../../services/ai/ai.service')

const router = express.Router()

router.get('/status', authenticate, (req, res) => {
  res.json(getAiStatus())
})

router.post('/ask', authenticate, async (req, res) => {
  const { question, context } = req.body || {}
  if (typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({ message: 'Question is required.' })
  }

  try {
    const language = String(req.headers['accept-language'] || 'ar').split(',')[0].slice(0, 2)
    const result = await askAssistant({
      question: question.trim(),
      context,
      language,
    })

    if (result.status === 'disabled') {
      return res.status(503).json({
        message: result.message,
        code: result.code,
        status: result.status,
      })
    }

    return res.json(result)
  } catch (error) {
    console.error('AI provider request failed:', error)
    return res.status(502).json({
      message: 'The assistant provider is temporarily unavailable.',
      code: 'AI_PROVIDER_FAILED',
      status: 'failed',
    })
  }
})

module.exports = router
