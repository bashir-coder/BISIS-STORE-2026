const express = require('express')
const { authenticate } = require('../middleware/auth.middleware')
const supabase = require('../../config/supabase.config')
const router = express.Router()

// ============================================================
// GET /api/donations – جلب التبرعات (مع تصفية حسب المستخدم)
// ============================================================
router.get('/', authenticate, async (req, res) => {
  try {
    let query = supabase.from('donations').select('*')
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      query = query.eq('donor_email', req.user.email)
    }
    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    res.status(500).json({ message: 'Unable to complete request' })
  }
})

// ============================================================
// POST /api/donations – إنشاء تبرع جديد
// ============================================================
router.post('/', authenticate, async (req, res) => {
  try {
    const { amount, cause, message, is_anonymous, txid } = req.body

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid donation amount' })
    }

    const { data, error } = await supabase
      .from('donations')
      .insert([{
        donor_name: is_anonymous ? 'Anonymous' : req.user.full_name,
        donor_email: is_anonymous ? null : req.user.email,
        amount,
        currency: 'USDC',
        cause: cause || 'Gaza Emergency Relief',
        txid: txid || null,
        message: message || '',
        is_anonymous: is_anonymous || false
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