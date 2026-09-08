const express = require('express')
const { authenticate, authorize } = require('../middleware/auth.middleware')
const supabase = require('../../config/supabase.config')
const cache = require('../middleware/cache.middleware')
const { clearCache } = require('../middleware/cache.middleware')
const router = express.Router()

const normalizeText = (value, maxLength) => typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
const parsePrice = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}
const parseId = (value) => /^\d+$/.test(String(value || '')) ? Number(value) : null
const dedupeServices = (services) => {
  const seen = new Set()
  return services.filter((service) => {
    const key = service.metadata?.source_id || service.name
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const validateService = (body, partial = false) => {
  const payload = {}
  if (!partial || body.name !== undefined) {
    const name = normalizeText(body.name, 180)
    if (!name) return { error: 'Service name is required' }
    payload.name = name
  }
  if (!partial || body.category !== undefined) {
    const category = normalizeText(body.category, 80)
    if (!category) return { error: 'Service category is required' }
    payload.category = category
  }
  if (body.description !== undefined) payload.description = normalizeText(body.description, 5000) || null
  if (body.level !== undefined) {
    const level = normalizeText(body.level, 40)
    if (!level) return { error: 'Service level is invalid' }
    payload.level = level
  }
  if (body.price !== undefined) {
    const price = parsePrice(body.price)
    if (price === null) return { error: 'Service price must be a non-negative number' }
    payload.price = price
  }
  if (body.duration_days !== undefined) {
    const duration = Number(body.duration_days)
    if (!Number.isInteger(duration) || duration < 1 || duration > 3650) return { error: 'duration_days must be a positive integer' }
    payload.duration_days = duration
  }
  if (body.is_active !== undefined) {
    if (typeof body.is_active !== 'boolean') return { error: 'is_active must be boolean' }
    payload.is_active = body.is_active
  }
  if (body.persona_ids !== undefined) {
    if (!Array.isArray(body.persona_ids)) return { error: 'persona_ids must be an array' }
    payload.persona_ids = body.persona_ids
  }
  if (body.metadata !== undefined) {
    if (!body.metadata || typeof body.metadata !== 'object' || Array.isArray(body.metadata)) return { error: 'metadata must be an object' }
    payload.metadata = body.metadata
  }
  for (const field of ['requirements', 'prompt', 'name_en', 'name_tr', 'description_en', 'description_tr']) {
    if (body[field] !== undefined) payload[field] = normalizeText(body[field], 5000) || null
  }
  return { payload }
}

// ============================================================
// Public catalog
// ============================================================
router.get('/', cache(300), async (req, res) => {
  try {
    const { data, error } = await supabase.from('services').select('*').eq('is_active', true).order('category', { ascending: true })
    if (error) throw error
    res.json(dedupeServices((data || []).map((service) => ({ ...service, delivery: service.delivery || service.metadata?.delivery || null }))))
  } catch (err) {
    console.error('Error fetching services:', err)
    res.status(500).json({ success: false, message: 'Unable to load services' })
  }
})

router.get('/filter', cache(300), async (req, res) => {
  try {
    const { category, level } = req.query
    let query = supabase.from('services').select('*').eq('is_active', true)
    if (category) query = query.eq('category', category)
    if (level) query = query.eq('level', level)
    const { data, error } = await query
    if (error) throw error
    res.json(dedupeServices((data || []).map((service) => ({ ...service, delivery: service.delivery || service.metadata?.delivery || null }))))
  } catch (err) {
    console.error('Error filtering services:', err)
    res.status(500).json({ success: false, message: 'Unable to filter services' })
  }
})

// ============================================================
// Admin catalog management
// ============================================================
router.get('/admin', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { data, error } = await supabase.from('services').select('*').eq('is_active', true).order('category', { ascending: true })
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    console.error('Admin service listing failed:', err)
    res.status(500).json({ message: 'Unable to load services' })
  }
})

router.post('/', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { payload, error: validationError } = validateService(req.body || {})
    if (validationError) return res.status(400).json({ message: validationError })
    const { data, error } = await supabase.from('services').insert([payload]).select().single()
    if (error) throw error
    clearCache('/api/services')
    res.status(201).json({ success: true, data })
  } catch (err) {
    console.error('Service creation failed:', err)
    res.status(500).json({ message: 'Unable to create service' })
  }
})

router.patch('/:id', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const id = parseId(req.params.id)
    if (id === null) return res.status(400).json({ message: 'Invalid service id' })
    const { payload, error: validationError } = validateService(req.body || {}, true)
    if (validationError) return res.status(400).json({ message: validationError })
    if (!Object.keys(payload).length) return res.status(400).json({ message: 'No service changes provided' })
    payload.updated_at = new Date().toISOString()
    const { data, error } = await supabase.from('services').update(payload).eq('id', id).select().single()
    if (error) throw error
    if (!data) return res.status(404).json({ message: 'Service not found' })
    clearCache('/api/services')
    res.json({ success: true, data })
  } catch (err) {
    console.error('Service update failed:', err)
    res.status(500).json({ message: 'Unable to update service' })
  }
})

router.delete('/:id', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const id = parseId(req.params.id)
    if (id === null) return res.status(400).json({ message: 'Invalid service id' })
    const { data, error } = await supabase.from('services').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id).select('id, is_active').single()
    if (error) throw error
    if (!data) return res.status(404).json({ message: 'Service not found' })
    clearCache('/api/services')
    res.json({ success: true, archived: true, data })
  } catch (err) {
    console.error('Service archive failed:', err)
    res.status(500).json({ message: 'Unable to archive service' })
  }
})

module.exports = router
