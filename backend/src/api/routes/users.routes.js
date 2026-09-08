const express = require('express')
const { authenticate, authorize } = require('../middleware/auth.middleware')
const supabase = require('../../config/supabase.config')
const router = express.Router()
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// ============================================================
// GET /api/users/me – جلب profile المستخدم الحالي
// ============================================================
router.get('/me', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email, avatar, role, is_active, is_verified, persona_id, workspace_id, created_at, updated_at')
      .eq('id', req.user.id)
      .single()
    if (error || !data) return res.status(404).json({ message: 'User profile not found' })
    res.json(data)
  } catch (err) {
    console.error('Profile fetch failed:', err)
    res.status(500).json({ message: 'Unable to load user profile' })
  }
})

// ============================================================
// PATCH /api/users/me/persona – حفظ تفضيل الشخصية للمستخدم الحالي
// ============================================================
router.patch('/me/persona', authenticate, async (req, res) => {
  try {
    const { persona_id: personaId } = req.body || {}
    if (!UUID_PATTERN.test(String(personaId || ''))) {
      return res.status(400).json({ message: 'A valid persona_id is required' })
    }

    const { data: persona, error: personaError } = await supabase
      .from('personas')
      .select('id, slug')
      .eq('id', personaId)
      .maybeSingle()
    if (personaError) throw personaError
    if (!persona) return res.status(404).json({ message: 'Persona not found' })

    const { data, error } = await supabase
      .from('users')
      .update({ persona_id: persona.id, updated_at: new Date().toISOString() })
      .eq('id', req.user.id)
      .select('id, persona_id, updated_at')
      .single()
    if (error || !data) throw error || new Error('Profile update returned no row')
    res.json({ user: data, persona })
  } catch (err) {
    console.error('Persona update failed:', err)
    res.status(500).json({ message: 'Unable to save persona preference' })
  }
})

// ============================================================
// GET /api/users – قائمة العملاء الآمنة لـClient 360 (Admin only)
// ============================================================
router.get('/', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    let query = supabase
      .from('users')
      .select('id, full_name, email, avatar, role, is_active, is_verified, persona_id, workspace_id, created_at, updated_at')
      .eq('role', 'client')
      .order('created_at', { ascending: false })
      .limit(100)

    if (req.user.role !== 'super_admin') {
      if (!req.user.workspace_id) return res.status(403).json({ message: 'An active workspace is required' })
      query = query.eq('workspace_id', req.user.workspace_id)
    }

    const { data, error } = await query
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    console.error('Client list fetch failed:', err)
    res.status(500).json({ message: 'Unable to load clients' })
  }
})

// ============================================================
// GET /api/users/:id – جلب معلومات مستخدم
// ============================================================
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params
    const isPrivileged = ['admin', 'super_admin', 'manager'].includes(req.user.role)
    if (id !== req.user.id && !isPrivileged) {
      return res.status(403).json({ message: 'You are not allowed to view this user' })
    }
    let query = supabase
      .from('users')
      .select('id, full_name, email, avatar, role, is_active, created_at')
      .eq('id', id)
    if (id !== req.user.id && req.user.role !== 'super_admin') {
      if (!req.user.workspace_id) return res.status(403).json({ message: 'An active workspace is required' })
      query = query.eq('workspace_id', req.user.workspace_id)
    }
    const { data, error } = await query.single()
    if (error) return res.status(404).json({ message: 'User not found' })
    res.json(data)
  } catch (err) {
    res.status(400).json({ message: 'Invalid request' })
  }
})

// ============================================================
// PATCH /api/users/:id/status – تعطيل/تفعيل حساب (Admin فقط)
// ============================================================
router.patch('/:id/status', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { id } = req.params
    const { is_active } = req.body

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ message: 'is_active must be a boolean' })
    }

    // منع تعطيل الحساب الخاص بك
    if (id === req.user.id) {
      return res.status(403).json({ message: 'You cannot deactivate your own account' })
    }

    let query = supabase
      .from('users')
      .update({ is_active })
      .eq('id', id)
    if (req.user.role !== 'super_admin') {
      if (!req.user.workspace_id) return res.status(403).json({ message: 'An active workspace is required' })
      query = query.eq('workspace_id', req.user.workspace_id)
    }
    const { data, error } = await query.select('id, full_name, email, role, is_active').single()

    if (error) throw error
    res.json({ 
      message: `User ${is_active ? 'activated' : 'deactivated'} successfully`,
      user: data 
    })
  } catch (err) {
    res.status(400).json({ message: 'Invalid request' })
  }
})

module.exports = router
