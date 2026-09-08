const express = require('express')
const { authenticate, authorize } = require('../middleware/auth.middleware')
const supabase = require('../../config/supabase.config')
const router = express.Router()

// ===============================
// GET all projects (Admin)
// ===============================
router.get('/', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    let query = supabase.from('projects').select('*')
    
    if (req.user.role !== 'super_admin' && req.user.workspace_id) {
      query = query.eq('workspace_id', req.user.workspace_id)
    }
    
    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    res.status(400).json({ message: 'Invalid request' })
  }
})

// ===============================
// GET single project
// ===============================
router.get('/:id', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { id } = req.params // ✅ استخدام المعرف كسلسلة نصية
    let query = supabase
      .from('projects')
      .select('*')
      .eq('id', id)
    
    if (req.user.role !== 'super_admin' && req.user.workspace_id) {
      query = query.eq('workspace_id', req.user.workspace_id)
    }
    
    const { data, error } = await query.single()
    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(400).json({ message: 'Invalid request' })
  }
})

// ===============================
// CREATE project
// ===============================
router.post('/', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { name, description, status } = req.body
    
    if (!name) {
      return res.status(400).json({ message: 'Project name is required' })
    }
    
    if (!req.user.workspace_id) {
      return res.status(403).json({ message: 'An active workspace is required' })
    }
    const payload = {
      name,
      description: description || '',
      status: status || 'active',
      workspace_id: req.user.workspace_id,
      created_by: req.user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    const { data, error } = await supabase
      .from('projects')
      .insert([payload])
      .select()
      .single()
    
    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    res.status(400).json({ message: 'Invalid request' })
  }
})

// ===============================
// UPDATE project
// ===============================
router.patch('/:id', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { id } = req.params
    const { name, description, status } = req.body
    
    const updatePayload = {
      name,
      description,
      status,
      updated_at: new Date().toISOString()
    }
    
    // Remove undefined fields
    Object.keys(updatePayload).forEach(key => {
      if (updatePayload[key] === undefined) delete updatePayload[key]
    })
    
    let query = supabase
      .from('projects')
      .update(updatePayload)
      .eq('id', id)
    
    if (req.user.role !== 'super_admin' && req.user.workspace_id) {
      query = query.eq('workspace_id', req.user.workspace_id)
    }
    
    const { data, error } = await query.select().single()
    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(400).json({ message: 'Invalid request' })
  }
})

// ===============================
// DELETE project
// ===============================
router.delete('/:id', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { id } = req.params
    
    let projectQuery = supabase.from('projects').select('id, workspace_id').eq('id', id)
    if (req.user.role !== 'super_admin') {
      if (!req.user.workspace_id) return res.status(403).json({ message: 'An active workspace is required' })
      projectQuery = projectQuery.eq('workspace_id', req.user.workspace_id)
    }
    const { data: project, error: projectError } = await projectQuery.maybeSingle()
    if (projectError || !project) return res.status(404).json({ message: 'Project not found' })

    // Only detach orders after the project has been authorized in its workspace.
    let detachQuery = supabase.from('orders').update({ project_id: null }).eq('project_id', id)
    if (req.user.role !== 'super_admin') detachQuery = detachQuery.eq('workspace_id', req.user.workspace_id)
    const { error: detachError } = await detachQuery
    if (detachError) throw detachError
    
    let query = supabase
      .from('projects')
      .delete()
      .eq('id', id)
    
    if (req.user.role !== 'super_admin' && req.user.workspace_id) {
      query = query.eq('workspace_id', req.user.workspace_id)
    }
    
    const { error } = await query
    if (error) throw error
    res.json({ message: 'Project deleted successfully' })
  } catch (err) {
    res.status(400).json({ message: 'Invalid request' })
  }
})

// ===============================
// GET orders by project
// ===============================
router.get('/:id/orders', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { id } = req.params
    
    let query = supabase
      .from('orders')
      .select('*')
      .eq('project_id', id)
    
    if (req.user.role !== 'super_admin' && req.user.workspace_id) {
      query = query.eq('workspace_id', req.user.workspace_id)
    }
    
    const { data, error } = await query
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    res.status(400).json({ message: 'Invalid request' })
  }
})

// ===============================
// ASSIGN order to project
// ===============================
router.patch('/:projectId/assign/:orderId', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { projectId, orderId } = req.params
    
    // Check if project exists
    let projectQuery = supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
    
    if (req.user.role !== 'super_admin' && req.user.workspace_id) {
      projectQuery = projectQuery.eq('workspace_id', req.user.workspace_id)
    }
    
    const { data: project, error: projectError } = await projectQuery.single()
    if (projectError || !project) {
      return res.status(404).json({ message: 'Project not found' })
    }
    
    // Check if order exists and belongs to same workspace
    let orderQuery = supabase
      .from('orders')
      .select('id')
      .eq('id', orderId)
    
    if (req.user.role !== 'super_admin' && req.user.workspace_id) {
      orderQuery = orderQuery.eq('workspace_id', req.user.workspace_id)
    }
    
    const { data: order, error: orderError } = await orderQuery.single()
    if (orderError || !order) {
      return res.status(404).json({ message: 'Order not found' })
    }
    
    // Assign order to project
    const { data, error } = await supabase
      .from('orders')
      .update({ project_id: projectId })
      .eq('id', orderId)
      .select()
      .single()
    
    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(400).json({ message: 'Invalid request' })
  }
})

module.exports = router
