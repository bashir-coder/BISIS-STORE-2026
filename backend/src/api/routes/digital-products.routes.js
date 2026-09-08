const express = require('express')
const { authenticate, authorize } = require('../middleware/auth.middleware')
const supabase = require('../../config/supabase.config')
const router = express.Router()

// ============================================================
// GET /api/digital-products – جلب جميع المنتجات الرقمية (عام)
// ============================================================
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('digital_products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data || [])
  } catch (err) {
    res.status(500).json({ message: 'Unable to complete request' })
  }
})

// ============================================================
// GET /api/digital-products/:id – جلب منتج واحد
// ============================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { data, error } = await supabase
      .from('digital_products')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    if (!data) return res.status(404).json({ message: 'Product not found' })
    res.json(data)
  } catch (err) {
    res.status(500).json({ message: 'Unable to complete request' })
  }
})

// ============================================================
// POST /api/digital-products – إنشاء منتج (Admin)
// ============================================================
router.post('/', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { name, description, price, file_url, thumbnail, category } = req.body

    if (!name || !price) {
      return res.status(400).json({ message: 'Name and price are required' })
    }

    const { data, error } = await supabase
      .from('digital_products')
      .insert([{
        name,
        description: description || '',
        price,
        file_url: file_url || null,
        thumbnail: thumbnail || null,
        category: category || 'general',
        downloads_count: 0,
        is_active: true
      }])
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    res.status(400).json({ message: 'Invalid request' })
  }
})

module.exports = router