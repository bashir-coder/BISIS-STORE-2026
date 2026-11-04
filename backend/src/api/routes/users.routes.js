const express = require('express')
const { authenticate, authorize } = require('../middleware/auth.middleware')
const supabase = require('../../config/supabase.config')
const router = express.Router()

router.get('/me', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email, avatar, role, is_active, is_verified, workspace_id, created_at, updated_at')
      .eq('id', req.user.id)
      .single()
    if (error || !data) return res.status(404).json({ message: 'User profile not found' })
    res.json(data)
  } catch (err) {
    console.error('Profile fetch failed:', err)
    res.status(500).json({ message: 'Unable to load user profile' })
  }
})

// Persona persistence retired by migration 018_remove_personas_system.sql.
// Kept as a backward-compatible stub so existing clients hitting
// /api/users/me/persona receive a deterministic rejection instead of a
// 500. No database queries are issued.

router.patch('/me/persona', authenticate, async (req, res) => {
  res.status(410).json({ message: 'Persona preference is no longer supported' })
})

router.get('/', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    let query = supabase
      .from('users')
      .select('id, full_name, email, avatar, role, is_active, is_verified, workspace_id, created_at, updated_at')
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

router.patch('/:id/status', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { id } = req.params
    const { is_active } = req.body

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ message: 'is_active must be a boolean' })
    }


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
