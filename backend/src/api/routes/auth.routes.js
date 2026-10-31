const express = require('express')
const supabase = require('../../config/supabase.config')
const { authenticate } = require('../middleware/auth.middleware')
const { canAccessWorkspace } = require('../utils/workspace-access')
const router = express.Router()

router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user })
})

router.get('/workspaces', authenticate, async (req, res) => {
  try {
    let query = supabase.from('workspaces').select('*').order('name', { ascending: true })
    if (req.user.role !== 'super_admin') {
      const { data: memberships, error: membershipError } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', req.user.id)
      if (membershipError) throw membershipError
      query = query.in('id', (memberships || []).map((membership) => membership.workspace_id))
    }
    const { data, error } = await query

    if (error) throw error
    res.json(data || [])
  } catch (err) {
    res.status(400).json({ message: 'Invalid request' })
  }
})

router.post('/switch-workspace', authenticate, async (req, res) => {
  try {
    const { workspace_id } = req.body
    if (!workspace_id) {
      return res.status(400).json({ message: 'Workspace ID required' })
    }

    const { data: workspace, error: findError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', workspace_id)
      .single()

    if (findError || !workspace) {
      return res.status(404).json({ message: 'Workspace not found' })
    }

    if (!(await canAccessWorkspace(req.user, workspace_id))) {
      return res.status(403).json({ message: 'You are not a member of this workspace' })
    }

    const { data: user, error: updateError } = await supabase
      .from('users')
      .update({ workspace_id })
      .eq('id', req.user.id)
      .select()
      .single()

    if (updateError) throw updateError

    res.json({
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        workspace_id: user.workspace_id,
        avatar: user.avatar,
        is_verified: user.is_verified,
        is_active: user.is_active,
      },
    })
  } catch (err) {
    res.status(400).json({ message: 'Invalid request' })
  }
})

module.exports = router
