const express = require('express')
const { authenticate, authorize } = require('../middleware/auth.middleware')
const supabase = require('../../config/supabase.config')
const cache = require('../middleware/cache.middleware')
const { clearCache } = require('../middleware/cache.middleware')
const router = express.Router()

const LANGUAGES = ['ar', 'en', 'tr']
const localizedText = (value, maxLength = 2000) => {
  if (typeof value === 'string') {
    const text = value.trim().slice(0, maxLength)
    return text ? Object.fromEntries(LANGUAGES.map((lang) => [lang, text])) : null
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const result = {}
  for (const lang of LANGUAGES) {
    const text = typeof value[lang] === 'string' ? value[lang].trim().slice(0, maxLength) : ''
    if (!text) return null
    result[lang] = text
  }
  return result
}
const parseId = (value) => {
  const normalized = String(value || '').trim()
  if (/^\d+$/.test(normalized)) return Number(normalized)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) return normalized
  return null
}

const validateFaq = (body, partial = false) => {
  const payload = {}
  if (!partial || body.question !== undefined) {
    const question = localizedText(body.question)
    if (!question) return { error: 'question must include ar, en and tr text' }
    payload.question = question
  }
  if (!partial || body.answer !== undefined) {
    const answer = localizedText(body.answer, 5000)
    if (!answer) return { error: 'answer must include ar, en and tr text' }
    payload.answer = answer
  }
  if (body.category !== undefined) {
    if (typeof body.category !== 'string' || !body.category.trim()) return { error: 'category must be text' }
    payload.category = body.category.trim().slice(0, 80)
  }
  if (body.order_index !== undefined) {
    if (!Number.isInteger(Number(body.order_index)) || Number(body.order_index) < 0) return { error: 'order_index must be a non-negative integer' }
    payload.order_index = Number(body.order_index)
  }
  if (body.is_active !== undefined) {
    if (typeof body.is_active !== 'boolean') return { error: 'is_active must be boolean' }
    payload.is_active = body.is_active
  }
  return { payload }
}

// ============================================================
// Admin FAQ management
// ============================================================
router.get('/admin', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { data, error } = await supabase.from('faqs').select('*').order('order_index', { ascending: true })
    if (error) throw error
    res.json({ success: true, data: data || [] })
  } catch (err) {
    console.error('Admin FAQ listing failed:', err)
    res.status(500).json({ success: false, message: 'Unable to load FAQs' })
  }
})

router.post('/', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { payload, error: validationError } = validateFaq(req.body || {})
    if (validationError) return res.status(400).json({ message: validationError })
    const { data, error } = await supabase.from('faqs').insert([payload]).select().single()
    if (error) throw error
    clearCache('/api/faqs')
    res.status(201).json({ success: true, data })
  } catch (err) {
    console.error('FAQ creation failed:', err)
    res.status(500).json({ message: 'Unable to create FAQ' })
  }
})

router.patch('/:id', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const id = parseId(req.params.id)
    if (id === null) return res.status(400).json({ message: 'Invalid FAQ id' })
    const { payload, error: validationError } = validateFaq(req.body || {}, true)
    if (validationError) return res.status(400).json({ message: validationError })
    if (!Object.keys(payload).length) return res.status(400).json({ message: 'No FAQ changes provided' })
    const { data, error } = await supabase.from('faqs').update(payload).eq('id', id).select().single()
    if (error) throw error
    if (!data) return res.status(404).json({ message: 'FAQ not found' })
    clearCache('/api/faqs')
    res.json({ success: true, data })
  } catch (err) {
    console.error('FAQ update failed:', err)
    res.status(500).json({ message: 'Unable to update FAQ' })
  }
})

router.delete('/:id', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const id = parseId(req.params.id)
    if (id === null) return res.status(400).json({ message: 'Invalid FAQ id' })
    const { data, error } = await supabase.from('faqs').update({ is_active: false }).eq('id', id).select('id, is_active').single()
    if (error) throw error
    if (!data) return res.status(404).json({ message: 'FAQ not found' })
    clearCache('/api/faqs')
    res.json({ success: true, archived: true, data })
  } catch (err) {
    console.error('FAQ archive failed:', err)
    res.status(500).json({ message: 'Unable to archive FAQ' })
  }
})

// ============================================================
// Public FAQs
// ============================================================
router.get('/', cache(600), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('faqs')
      .select('*')
      .eq('is_active', true)
      .order('order_index', { ascending: true })

    if (error) throw error
    res.json({ success: true, data: data || [] })
  } catch (err) {
    console.error('Error fetching FAQs:', err)
    res.status(500).json({ success: false, message: 'Unable to load FAQs' })
  }
})

module.exports = router
