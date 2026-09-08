const express = require('express')
const { authenticate, authorize } = require('../middleware/auth.middleware')
const supabase = require('../../config/supabase.config')
const router = express.Router()

const TICKET_STATUSES = new Set(['open', 'in_progress', 'resolved', 'closed'])
const normalizeText = (value, maxLength) => {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}
const validProjectId = (value) => value === null || value === undefined || value === '' ? null : (/^\d+$/.test(String(value)) ? Number(value) : undefined)

async function getOwnedProject(projectId, userId) {
  const { data, error } = await supabase
    .from('orders')
    .select('project_id, workspace_id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data || null
}

// ============================================================
// POST / – إنشاء تذكرة جديدة
// ============================================================
router.post('/', authenticate, async (req, res) => {
  try {
    const title = normalizeText(req.body?.title, 160)
    const description = normalizeText(req.body?.description, 5000)
    const projectId = validProjectId(req.body?.project_id)
    if (!title || !description) {
      return res.status(400).json({ message: 'Title and description are required' })
    }
    if (projectId === undefined) return res.status(400).json({ message: 'Invalid project_id' })
    let workspaceId = req.user.workspace_id || null
    if (projectId !== null) {
      const project = await getOwnedProject(projectId, req.user.id)
      if (!project) return res.status(404).json({ message: 'Project not found' })
      workspaceId = project.workspace_id || workspaceId
    }

    const { data: ticket, error } = await supabase
      .from('tickets')
      .insert([{
        user_id: req.user.id,
        workspace_id: workspaceId,
        project_id: projectId,
        title,
        description,
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) throw error
    res.status(201).json(ticket)
  } catch (err) {
    console.error('Ticket creation failed:', err)
    res.status(500).json({ message: 'Unable to create ticket' })
  }
})

// ============================================================
// GET /my – تذاكر المستخدم
// ============================================================
router.get('/my', authenticate, async (req, res) => {
  try {
    const projectId = validProjectId(req.query.project_id)
    if (projectId === undefined) return res.status(400).json({ message: 'Invalid project_id' })
    let query = supabase
      .from('tickets')
      .select('*')
      .eq('user_id', req.user.id)
    if (projectId !== null) query = query.eq('project_id', projectId)
    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error
    res.json(data || [])
  } catch (err) {
    console.error('Ticket listing failed:', err)
    res.status(500).json({ message: 'Unable to load tickets' })
  }
})

// ============================================================
// GET / – كل التذاكر (للمدير)
// ============================================================
router.get('/', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    let query = supabase
      .from('tickets')
      .select('*, users(full_name, email)')
      .order('created_at', { ascending: false })
    const projectId = validProjectId(req.query.project_id)
    if (projectId === undefined) return res.status(400).json({ message: 'Invalid project_id' })
    if (projectId !== null) query = query.eq('project_id', projectId)
    if (req.user.role !== 'super_admin') {
      if (!req.user.workspace_id) return res.status(403).json({ message: 'An active workspace is required' })
      query = query.eq('workspace_id', req.user.workspace_id)
    }
    const { data, error } = await query

    if (error) throw error
    res.json(data || [])
  } catch (err) {
    console.error('Admin ticket listing failed:', err)
    res.status(500).json({ message: 'Unable to load tickets' })
  }
})

// ============================================================
// PATCH /:id – تحديث التذكرة (رد أو تغيير حالة)
// ============================================================
router.patch('/:id', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { id } = req.params
    const status = req.body?.status
    const adminResponse = req.body?.admin_response
    if (status !== undefined && !TICKET_STATUSES.has(status)) {
      return res.status(400).json({ message: 'Invalid ticket status' })
    }
    if (adminResponse !== undefined && typeof adminResponse !== 'string') {
      return res.status(400).json({ message: 'admin_response must be text' })
    }

    const updatePayload = { updated_at: new Date().toISOString() }
    if (status !== undefined) updatePayload.status = status
    if (adminResponse !== undefined) updatePayload.admin_response = normalizeText(adminResponse, 5000) || null
    if (Object.keys(updatePayload).length === 1) return res.status(400).json({ message: 'No ticket changes provided' })

    let query = supabase
      .from('tickets')
      .update(updatePayload)
      .eq('id', id)
    if (req.user.role !== 'super_admin') {
      if (!req.user.workspace_id) return res.status(403).json({ message: 'An active workspace is required' })
      query = query.eq('workspace_id', req.user.workspace_id)
    }
    const { data, error } = await query.select().single()

    if (error) throw error
    res.json(data)
  } catch (err) {
    console.error('Ticket update failed:', err)
    res.status(500).json({ message: 'Unable to update ticket' })
  }
})

module.exports = router
