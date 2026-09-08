const express = require('express')
const supabase = require('../../config/supabase.config')
const router = express.Router()

// ============================================================
// GET /api/public/services – جلب آخر الخدمات (عام)
// ============================================================
router.get('/services', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('id, name, description, category, price, duration_days, is_active, metadata')
      .eq('is_active', true)
      .limit(10)
      .order('name', { ascending: true })

    if (error) throw error
    res.json({ success: true, data: (data || []).map((service) => ({ ...service, delivery: service.metadata?.delivery || null })) })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Unable to complete request' })
  }
})

// ============================================================
// GET /api/public/health – حالة الخادم (عام)
// ============================================================
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    version: '1.0.0', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
})

module.exports = router
