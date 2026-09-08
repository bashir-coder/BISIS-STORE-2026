const express = require('express')
const { body, validationResult } = require('express-validator')
const { authenticate, authorize } = require('../middleware/auth.middleware')
const supabase = require('../../config/supabase.config')
const cache = require('../middleware/cache.middleware')
const { clearCache } = require('../middleware/cache.middleware')
const router = express.Router()

const slugify = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[^\w\s-]/g, '')
  .replace(/[\s_-]+/g, '-')
  .replace(/^-+|-+$/g, '')

const parsePrice = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const normalized = value.replace(/[^0-9.-]/g, '')
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const normalizeArray = (value) => Array.isArray(value) ? value : []

const buildPackagePayload = (body) => {
  const name = String(body.name || '').trim()
  const starterFeatures = normalizeArray(body.tier_starter_features)
  const basePrice = parsePrice(body.price) ?? parsePrice(body.tier_starter_price) ?? 0
  return {
    category: String(body.category || '').trim() || null,
    name,
    slug: slugify(body.slug || name),
    description: String(body.description || '').trim() || null,
    price: basePrice,
    features: normalizeArray(body.features).length ? normalizeArray(body.features) : starterFeatures,
    services: normalizeArray(body.services),
    persona_ids: normalizeArray(body.persona_ids),
    is_popular: body.is_popular === true,
    is_active: body.is_active !== false,
    tier_starter_price: body.tier_starter_price || `$${basePrice}`,
    tier_starter_features: starterFeatures,
    tier_growth_price: body.tier_growth_price || '$0',
    tier_growth_features: normalizeArray(body.tier_growth_features),
    tier_investor_price: body.tier_investor_price || '$0',
    tier_investor_features: normalizeArray(body.tier_investor_features),
  }
}

router.get('/admin', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { data, error } = await supabase.from('packages').select('*').order('category', { ascending: true })
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    console.error('Admin package listing failed:', err)
    res.status(500).json({ message: 'Unable to load packages' })
  }
})

router.get('/', cache(300), async (req, res) => {
  try {
    const { category } = req.query
    let query = supabase.from('packages').select('*').eq('is_active', true)
    if (category && category !== 'all') query = query.eq('category', category)
    const { data, error } = await query.order('category', { ascending: true })
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    console.error('Package listing failed:', err)
    res.status(500).json({ message: 'Unable to load packages' })
  }
})

router.post(
  '/',
  authenticate,
  authorize('admin', 'super_admin'),
  [
    body('category').optional().isString(),
    body('name').notEmpty().withMessage('Name is required'),
    body('description').optional().isString(),
    body('price').optional().isNumeric(),
    body('persona_ids').optional().isArray(),
  ],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

    try {
      const payload = buildPackagePayload(req.body)
      if (!payload.slug) return res.status(400).json({ message: 'A valid package name or slug is required' })
      const { data, error } = await supabase.from('packages').insert([payload]).select().single()
      if (error) throw error
      clearCache('/api/packages')
      res.status(201).json({ success: true, data })
    } catch (err) {
      console.error('Package creation failed:', err)
      res.status(500).json({ message: 'Unable to create package' })
    }
  }
)

router.put(
  '/:id',
  authenticate,
  authorize('admin', 'super_admin'),
  [
    body('category').optional().isString(),
    body('name').optional().notEmpty(),
    body('description').optional().isString(),
    body('price').optional().isNumeric(),
    body('persona_ids').optional().isArray(),
  ],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

    try {
      const updateData = { updated_at: new Date().toISOString() }
      const fields = [
        'category', 'name', 'description', 'price', 'features', 'services', 'persona_ids',
        'is_popular', 'is_active', 'tier_starter_price', 'tier_starter_features',
        'tier_growth_price', 'tier_growth_features', 'tier_investor_price', 'tier_investor_features'
      ]
      fields.forEach((field) => {
        if (req.body[field] !== undefined) updateData[field] = req.body[field]
      })
      if (req.body.slug !== undefined) updateData.slug = slugify(req.body.slug)
      else if (req.body.name !== undefined) updateData.slug = slugify(req.body.name)

      const { data, error } = await supabase.from('packages').update(updateData).eq('id', req.params.id).select().single()
      if (error) throw error
      if (!data) return res.status(404).json({ message: 'Package not found' })
      clearCache('/api/packages')
      res.json({ success: true, data })
    } catch (err) {
      console.error('Package update failed:', err)
      res.status(500).json({ message: 'Unable to update package' })
    }
  }
)

router.delete('/:id', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('packages')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('id, is_active')
      .single()
    if (error) throw error
    if (!data) return res.status(404).json({ message: 'Package not found' })
    clearCache('/api/packages')
    res.json({ success: true, archived: true, data })
  } catch (err) {
    console.error('Package archive failed:', err)
    res.status(500).json({ message: 'Unable to archive package' })
  }
})

module.exports = router
