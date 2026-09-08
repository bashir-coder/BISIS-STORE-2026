const express = require('express')
const supabase = require('../../config/supabase.config')
const router = express.Router()

// ============================================================
// GET /api/personas – جلب جميع الشخصيات
// ============================================================
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('personas')
      .select('*')
      .order('id', { ascending: true })

    if (error) throw error
    res.json(data || [])
  } catch (err) {
    console.error('Error fetching personas:', err)
    res.status(500).json({ message: 'Unable to complete request' })
  }
})

module.exports = router