const express = require('express')
const { authenticate, authorize } = require('../middleware/auth.middleware')
const supabase = require('../../config/supabase.config')

const router = express.Router()
const staffRoles = new Set(['admin', 'super_admin', 'manager', 'editor'])
const deliveryTransitions = {
  prepare: { from: new Set(['ready_for_delivery', 'revision_requested']), to: 'prepared' },
  deliver: { from: new Set(['prepared']), to: 'client_review' },
  approve: { from: new Set(['client_review', 'delivered']), to: 'completed' },
  revision: { from: new Set(['client_review', 'delivered']), to: 'revision_requested' },
}

const safeId = (value) => /^\d+$/.test(String(value || '')) ? Number(value) : null
const safeUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '')) ? String(value) : null
const isStaff = (user) => Boolean(user && staffRoles.has(user.role))
const errorResponse = (res, status, message, code) => res.status(status).json({ message, ...(code ? { code } : {}) })

const recordActivity = async ({ projectId, actorId, eventType, visibility = 'internal', payload = {} }) => {
  const { error } = await supabase.from('project_activity').insert([{
    project_id: projectId,
    actor_id: actorId || null,
    entity_type: 'project',
    entity_id: String(projectId),
    event_type: eventType,
    visibility,
    payload,
  }])
  if (error) throw error
}

const notifyProjectOwner = async ({ projectId, message, type = 'service_delivery' }) => {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, user_id')
    .eq('project_id', projectId)
    .not('user_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (orderError) throw orderError
  if (!order?.user_id) return null
  const { data, error } = await supabase.from('notifications').insert([{
    user_id: order.user_id,
    order_id: order.id,
    message,
    type,
  }]).select().single()
  if (error) throw error
  return data
}

const getStaffProject = async (projectId, user) => {
  let query = supabase.from('projects').select('*').eq('id', projectId)
  if (user.role !== 'super_admin') {
    if (!user.workspace_id) return null
    query = query.eq('workspace_id', user.workspace_id)
  }
  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return data
}

const getClientProject = async (projectId, userId) => {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, user_id, project_id, package, service, status, amount, price, created_at, updated_at')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (orderError) throw orderError
  if (!order) return null
  const { data: project, error: projectError } = await supabase.from('projects').select('*').eq('id', projectId).maybeSingle()
  if (projectError) throw projectError
  return project ? { project, order } : null
}

const fetchExecutionData = async (projectIds) => {
  if (!projectIds.length) return { milestones: [], tasks: [], activity: [], requirements: [], deliveries: [] }
  const [milestones, tasks, activity, requirements, deliveries] = await Promise.all([
    supabase.from('project_milestones').select('*').in('project_id', projectIds).order('position', { ascending: true }),
    supabase.from('project_tasks').select('*').in('project_id', projectIds).order('created_at', { ascending: false }),
    supabase.from('project_activity').select('*').in('project_id', projectIds).eq('visibility', 'client').order('created_at', { ascending: false }).limit(100),
    supabase.from('project_requirements').select('*').in('project_id', projectIds).eq('client_visible', true).order('created_at', { ascending: true }),
    supabase.from('project_deliveries').select('*').in('project_id', projectIds),
  ])
  for (const response of [milestones, tasks, activity, requirements, deliveries]) if (response.error) throw response.error
  return {
    milestones: milestones.data || [],
    tasks: tasks.data || [],
    activity: activity.data || [],
    requirements: requirements.data || [],
    deliveries: deliveries.data || [],
  }
}

const deriveState = ({ tasks = [], requirements = [], delivery = null }) => {
  const pendingRequirements = requirements.filter((item) => item.is_required && ['requested', 'needs_revision'].includes(item.status))
  if (pendingRequirements.length) return { execution_state: 'waiting_on_client', waiting_on: 'client' }
  if (delivery?.status === 'client_review') return { execution_state: 'waiting_on_review', waiting_on: 'review' }
  if (delivery?.status === 'approved' || delivery?.status === 'completed') return { execution_state: 'completed', waiting_on: null }
  if (tasks.some((task) => task.status === 'blocked')) return { execution_state: 'blocked', waiting_on: 'founder' }
  if (tasks.length && tasks.every((task) => ['done', 'cancelled'].includes(task.status))) return { execution_state: 'ready_for_delivery', waiting_on: 'founder' }
  if (tasks.some((task) => ['in_progress', 'done'].includes(task.status))) return { execution_state: 'in_progress', waiting_on: 'founder' }
  if (tasks.length) return { execution_state: 'in_progress', waiting_on: 'founder' }
  return { execution_state: 'not_started', waiting_on: null }
}

const updateProjectState = async (projectId, state) => {
  const { data, error } = await supabase.from('projects').update({
    execution_state: state.execution_state,
    waiting_on: state.waiting_on,
    state_updated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', projectId).select('id,execution_state,waiting_on,state_updated_at').single()
  if (error) throw error
  return data
}

const applyTemplate = async ({ projectId, templateId, actorId }) => {
  const { data: template, error: templateError } = await supabase.from('project_templates').select('*').eq('id', templateId).eq('is_active', true).maybeSingle()
  if (templateError) throw templateError
  if (!template) throw Object.assign(new Error('Template not found'), { status: 404, code: 'TEMPLATE_NOT_FOUND' })
  const [milestonesResponse, tasksResponse] = await Promise.all([
    supabase.from('project_template_milestones').select('*').eq('template_id', template.id).order('position', { ascending: true }),
    supabase.from('project_template_tasks').select('*').order('position', { ascending: true }),
  ])
  if (milestonesResponse.error) throw milestonesResponse.error
  if (tasksResponse.error) throw tasksResponse.error
  const templateMilestones = milestonesResponse.data || []
  const templateTasks = (tasksResponse.data || []).filter((task) => templateMilestones.some((milestone) => milestone.id === task.template_milestone_id))
  const milestoneRows = templateMilestones.map((milestone) => ({ project_id: projectId, title: milestone.title, description: milestone.description, position: milestone.position, created_by: actorId }))
  const { data: milestones, error: milestoneInsertError } = milestoneRows.length
    ? await supabase.from('project_milestones').insert(milestoneRows).select()
    : { data: [], error: null }
  if (milestoneInsertError) throw milestoneInsertError
  const milestoneMap = new Map((milestones || []).map((item) => [item.position, item.id]))
  const taskRows = templateTasks.map((task) => {
    const sourceMilestone = templateMilestones.find((milestone) => milestone.id === task.template_milestone_id)
    return { project_id: projectId, milestone_id: milestoneMap.get(sourceMilestone?.position) || null, title: task.title, description: task.description, priority: task.priority, client_visible: task.client_visible, created_by: actorId }
  })
  const { data: tasks, error: taskInsertError } = taskRows.length
    ? await supabase.from('project_tasks').insert(taskRows).select()
    : { data: [], error: null }
  if (taskInsertError) throw taskInsertError
  await recordActivity({ projectId, actorId, eventType: 'PROJECT_STRUCTURE_INITIALIZED', visibility: 'internal', payload: { template_id: template.id, milestone_count: milestones?.length || 0, task_count: tasks?.length || 0 } })
  return { template, milestones: milestones || [], tasks: tasks || [] }
}

const cleanupInitializedProject = async ({ projectId }) => {
  // The project is newly created in this operation, so project-scoped cleanup
  // is safer than relying on in-memory inserted-id tracking after a partial failure.
  const taskCleanup = await supabase.from('project_tasks').delete().eq('project_id', projectId)
  if (taskCleanup.error) throw taskCleanup.error
  const milestoneCleanup = await supabase.from('project_milestones').delete().eq('project_id', projectId)
  if (milestoneCleanup.error) throw milestoneCleanup.error
  const activityCleanup = await supabase.from('project_activity').delete().eq('project_id', projectId)
  if (activityCleanup.error) throw activityCleanup.error
  const requirementCleanup = await supabase.from('project_requirements').delete().eq('project_id', projectId)
  if (requirementCleanup.error) throw requirementCleanup.error
  const projectCleanup = await supabase.from('projects').delete().eq('id', projectId)
  if (projectCleanup.error) throw projectCleanup.error
}

const summarizeProject = ({ project, order, milestones, tasks, activity, requirements, delivery, files = [] }) => {
  const clientTasks = tasks.filter((task) => task.client_visible)
  const completedTasks = clientTasks.filter((task) => ['done', 'cancelled'].includes(task.status)).length
  const progress = clientTasks.length ? Math.round((completedTasks / clientTasks.length) * 100) : null
  const pendingRequirements = requirements.filter((item) => item.is_required && ['requested', 'needs_revision'].includes(item.status))
  const nextAction = pendingRequirements.length
    ? { type: 'requirements', title: 'Complete project requirements', priority: 'high' }
    : delivery?.status === 'client_review'
      ? { type: 'review_delivery', title: 'Review your delivery', priority: 'high' }
      : delivery?.status === 'prepared' || delivery?.status === 'delivered'
        ? { type: 'view_delivery', title: 'View delivery', priority: 'high' }
        : project.execution_state === 'ready_for_delivery'
          ? { type: 'prepare_delivery', title: 'Delivery is ready for preparation', priority: 'medium' }
          : null
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    execution_state: project.execution_state,
    waiting_on: project.waiting_on,
    state_updated_at: project.state_updated_at,
    progress: progress === null ? null : { percent: progress, completed: completedTasks, total: clientTasks.length },
    current_milestone: milestones.find((milestone) => ['in_progress', 'blocked'].includes(milestone.status)) || null,
    next_action: nextAction,
    order,
    milestones: milestones.filter((milestone) => clientTasks.some((task) => task.milestone_id === milestone.id)),
    tasks: clientTasks,
    requirements,
    activity,
    delivery,
    delivery_files: files,
  }
}

router.post('/orders/:orderId/initialize', authenticate, authorize('admin', 'super_admin', 'manager', 'editor'), async (req, res) => {
  let createdProjectId = null
  const createdMilestoneIds = []
  const createdTaskIds = []
  try {
    const orderId = safeId(req.params.orderId)
    const templateId = safeId(req.body?.template_id)
    if (!orderId || !templateId) return errorResponse(res, 400, 'order_id and template_id are required')
    const { data: order, error: orderError } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle()
    if (orderError) throw orderError
    if (!order) return errorResponse(res, 404, 'Order not found')
    if (!['verified', 'paid', 'completed'].includes(order.payment_status) && order.status !== 'processing') return errorResponse(res, 409, 'Order is not ready for project initialization', 'ORDER_NOT_READY')
    const existingProjectId = order.project_id
    const idempotencyKey = `order:${order.id}:project-init`
    if (existingProjectId) return res.status(200).json({ data: { project_id: existingProjectId, idempotent: true, idempotency_key: idempotencyKey, initialization_status: 'initialized' } })
    const template = await supabase.from('project_templates').select('id,service_id,name').eq('id', templateId).eq('is_active', true).maybeSingle()
    if (template.error) throw template.error
    if (!template.data) return errorResponse(res, 404, 'Template not found', 'TEMPLATE_NOT_FOUND')
    const workspaceId = order.workspace_id || req.user.workspace_id
    if (!workspaceId) return errorResponse(res, 403, 'An active workspace is required')
    const projectName = String(req.body?.name || order.service || order.package || `Order #${order.id}`).trim().slice(0, 180)
    const { data: project, error: projectError } = await supabase.from('projects').insert([{
      workspace_id: workspaceId,
      created_by: req.user.id,
      name: projectName,
      description: String(req.body?.description || '').slice(0, 5000),
      status: 'active',
      execution_state: 'not_started',
      waiting_on: null,
    }]).select().single()
    if (projectError) throw projectError
    createdProjectId = project.id
    const { error: orderLinkError } = await supabase.from('orders').update({ project_id: project.id }).eq('id', order.id).is('project_id', null)
    if (orderLinkError) throw orderLinkError
    const applied = await applyTemplate({ projectId: project.id, templateId: templateId, actorId: req.user.id })
    createdMilestoneIds.push(...applied.milestones.map((item) => item.id))
    createdTaskIds.push(...applied.tasks.map((item) => item.id))
    const inputRequirements = Array.isArray(req.body?.requirements) ? req.body.requirements : []
    const requirementRows = inputRequirements.map((item) => ({
      project_id: project.id,
      title: String(item.title || '').trim().slice(0, 180),
      description: String(item.description || '').trim().slice(0, 2000),
      requirement_type: ['text', 'file', 'choice'].includes(item.requirement_type) ? item.requirement_type : 'text',
      is_required: item.is_required !== false,
      client_visible: item.client_visible !== false,
      created_by: req.user.id,
    })).filter((item) => item.title)
    let createdRequirements = []
    if (requirementRows.length) {
      const { data: insertedRequirements, error: requirementError } = await supabase.from('project_requirements').insert(requirementRows).select()
      if (requirementError) throw requirementError
      createdRequirements = insertedRequirements || []
    }
    await recordActivity({ projectId: project.id, actorId: req.user.id, eventType: 'PROJECT_CREATED', visibility: 'client', payload: { order_id: order.id } })
    const state = deriveState({ tasks: applied.tasks, requirements: createdRequirements, delivery: null })
    const updatedProject = await updateProjectState(project.id, state)
    return res.status(201).json({ data: { project: { ...project, ...updatedProject }, order_id: order.id, template_id: templateId, idempotency_key: idempotencyKey, initialization_status: 'initialized', milestones: applied.milestones, tasks: applied.tasks, requirements: createdRequirements } })
  } catch (error) {
    if (createdProjectId) {
      try { await cleanupInitializedProject({ projectId: createdProjectId }) } catch (cleanupError) { console.error('Project initialization cleanup failed:', cleanupError) }
    }
    console.error('Project initialization failed:', error)
    return errorResponse(res, Number(error.status) || 500, error.code === 'TEMPLATE_NOT_FOUND' ? 'Template not found' : 'Project initialization failed', error.code)
  }
})

router.get('/projects/:projectId/requirements', authenticate, async (req, res) => {
  try {
    const projectId = safeId(req.params.projectId)
    if (!projectId) return errorResponse(res, 400, 'Invalid project id')
    const access = isStaff(req.user) ? await getStaffProject(projectId, req.user) : await getClientProject(projectId, req.user.id)
    if (!access) return errorResponse(res, 404, 'Project not found')
    let query = supabase.from('project_requirements').select('*').eq('project_id', projectId).order('created_at', { ascending: true })
    if (!isStaff(req.user)) query = query.eq('client_visible', true)
    const { data, error } = await query
    if (error) throw error
    res.json({ data: data || [] })
  } catch (error) {
    console.error('Requirements listing failed:', error)
    errorResponse(res, 500, 'Unable to load project requirements')
  }
})

router.post('/projects/:projectId/requirements', authenticate, authorize('admin', 'super_admin', 'manager', 'editor'), async (req, res) => {
  try {
    const projectId = safeId(req.params.projectId)
    if (!projectId) return errorResponse(res, 400, 'Invalid project id')
    if (!await getStaffProject(projectId, req.user)) return errorResponse(res, 404, 'Project not found')
    const title = String(req.body?.title || '').trim()
    if (!title) return errorResponse(res, 400, 'Requirement title is required')
    const payload = {
      project_id: projectId,
      title: title.slice(0, 180),
      description: String(req.body?.description || '').slice(0, 2000),
      requirement_type: ['text', 'file', 'choice'].includes(req.body?.requirement_type) ? req.body.requirement_type : 'text',
      is_required: req.body?.is_required !== false,
      client_visible: req.body?.client_visible !== false,
      created_by: req.user.id,
    }
    const { data, error } = await supabase.from('project_requirements').insert([payload]).select().single()
    if (error) throw error
    await recordActivity({ projectId, actorId: req.user.id, eventType: 'REQUIREMENT_REQUESTED', visibility: 'client', payload: { requirement_id: data.id } })
    await notifyProjectOwner({ projectId, message: 'Your project needs information from you.' })
    const [projectData, taskData, deliveryData] = await Promise.all([
      supabase.from('project_requirements').select('*').eq('project_id', projectId),
      supabase.from('project_tasks').select('*').eq('project_id', projectId),
      supabase.from('project_deliveries').select('*').eq('project_id', projectId).maybeSingle(),
    ])
    if (projectData.error || taskData.error || deliveryData.error) throw projectData.error || taskData.error || deliveryData.error
    await updateProjectState(projectId, deriveState({ requirements: projectData.data || [], tasks: taskData.data || [], delivery: deliveryData.data || null }))
    res.status(201).json({ data })
  } catch (error) {
    console.error('Requirement creation failed:', error)
    errorResponse(res, 500, 'Unable to create requirement')
  }
})

router.patch('/projects/:projectId/requirements/:requirementId', authenticate, async (req, res) => {
  try {
    const projectId = safeId(req.params.projectId)
    const requirementId = safeId(req.params.requirementId)
    if (!projectId || !requirementId) return errorResponse(res, 400, 'Invalid requirement or project id')
    const access = isStaff(req.user) ? await getStaffProject(projectId, req.user) : await getClientProject(projectId, req.user.id)
    if (!access) return errorResponse(res, 404, 'Project not found')
    const { data: current, error: currentError } = await supabase.from('project_requirements').select('*').eq('id', requirementId).eq('project_id', projectId).maybeSingle()
    if (currentError) throw currentError
    if (!current || (!isStaff(req.user) && !current.client_visible)) return errorResponse(res, 404, 'Requirement not found')
    const update = { updated_at: new Date().toISOString(), updated_by: req.user.id }
    if (isStaff(req.user)) {
      for (const key of ['title', 'description', 'requirement_type', 'is_required', 'client_visible', 'status']) if (req.body?.[key] !== undefined) update[key] = req.body[key]
    } else {
      if (current.status === 'approved' || current.status === 'not_applicable') return errorResponse(res, 409, 'Requirement is no longer editable', 'REQUIREMENT_LOCKED')
      if (req.body?.response_value === undefined && !req.body?.file_id) return errorResponse(res, 400, 'A response or file is required')
      if (req.body?.response_value !== undefined) update.response_value = String(req.body.response_value).slice(0, 10000)
      if (req.body?.file_id) {
        const fileId = String(req.body.file_id)
        const { data: file, error: fileError } = await supabase.from('order_files').select('id,order_id,uploaded_by,file_kind').eq('id', fileId).maybeSingle()
        if (fileError) throw fileError
        if (!file || file.uploaded_by !== req.user.id || file.file_kind !== 'customer_input') return errorResponse(res, 403, 'File is not allowed for this requirement')
        const { data: linkedOrder } = await supabase.from('orders').select('id').eq('id', file.order_id).eq('project_id', projectId).eq('user_id', req.user.id).maybeSingle()
        if (!linkedOrder) return errorResponse(res, 403, 'File does not belong to this project')
        update.file_id = file.id
      }
      update.status = 'submitted'
      update.completed_at = new Date().toISOString()
    }
    const { data, error } = await supabase.from('project_requirements').update(update).eq('id', current.id).eq('project_id', projectId).select().single()
    if (error) throw error
    await recordActivity({ projectId, actorId: req.user.id, eventType: isStaff(req.user) ? 'REQUIREMENT_APPROVED' : 'REQUIREMENT_SUBMITTED', visibility: 'client', payload: { requirement_id: current.id } })
    const [requirements, tasks, deliveries] = await Promise.all([
      supabase.from('project_requirements').select('*').eq('project_id', projectId),
      supabase.from('project_tasks').select('*').eq('project_id', projectId),
      supabase.from('project_deliveries').select('*').eq('project_id', projectId).maybeSingle(),
    ])
    if (requirements.error || tasks.error || deliveries.error) throw requirements.error || tasks.error || deliveries.error
    await updateProjectState(projectId, deriveState({ requirements: requirements.data || [], tasks: tasks.data || [], delivery: deliveries.data || null }))
    if (!isStaff(req.user)) await notifyProjectOwner({ projectId, message: 'A client requirement was submitted.' })
    res.json({ data })
  } catch (error) {
    console.error('Requirement update failed:', error)
    errorResponse(res, 500, 'Unable to update requirement')
  }
})

router.get('/projects/:projectId/client-view', authenticate, async (req, res) => {
  try {
    const projectId = safeId(req.params.projectId)
    if (!projectId) return errorResponse(res, 400, 'Invalid project id')
    const access = isStaff(req.user) ? await getStaffProject(projectId, req.user) : await getClientProject(projectId, req.user.id)
    if (!access) return errorResponse(res, 404, 'Project not found')
    const { project, order } = isStaff(req.user) ? { project: access, order: null } : access
    const execution = await fetchExecutionData([projectId])
    const requirements = isStaff(req.user) ? execution.requirements : execution.requirements.filter((item) => item.client_visible)
    const tasks = isStaff(req.user) ? execution.tasks : execution.tasks.filter((item) => item.client_visible)
    const activity = isStaff(req.user) ? execution.activity : execution.activity.filter((item) => item.visibility === 'client')
    const delivery = execution.deliveries[0] || null
    let files = []
    if (order?.id) {
      const filesResponse = await supabase.from('order_files').select('id,order_id,original_name,mime_type,byte_size,file_kind,created_at').eq('order_id', order.id).eq('file_kind', 'delivery').order('created_at', { ascending: false })
      if (filesResponse.error) throw filesResponse.error
      files = filesResponse.data || []
    }
    res.json({ data: summarizeProject({ project, order, milestones: execution.milestones, tasks, activity, requirements, delivery, files }) })
  } catch (error) {
    console.error('Client project view failed:', error)
    errorResponse(res, 500, 'Unable to load project')
  }
})

router.get('/clients/:clientId/overview', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const clientId = safeUuid(req.params.clientId)
    if (!clientId) return errorResponse(res, 400, 'Invalid client id')
    let clientQuery = supabase.from('users').select('id,full_name,email,avatar,role,workspace_id').eq('id', clientId).eq('role', 'client')
    if (req.user.role !== 'super_admin') {
      if (!req.user.workspace_id) return errorResponse(res, 403, 'An active workspace is required')
      clientQuery = clientQuery.eq('workspace_id', req.user.workspace_id)
    }
    const { data: client, error: clientError } = await clientQuery.maybeSingle()
    if (clientError) throw clientError
    if (!client) return errorResponse(res, 404, 'Client not found')

    let ordersQuery = supabase.from('orders').select('id,project_id,package,service,status,payment_status,amount,price,created_at,updated_at').eq('user_id', clientId).not('project_id', 'is', null)
    if (req.user.role !== 'super_admin') ordersQuery = ordersQuery.eq('workspace_id', req.user.workspace_id)
    const { data: orders, error: ordersError } = await ordersQuery.order('updated_at', { ascending: false }).limit(100)
    if (ordersError) throw ordersError
    const projectIds = [...new Set((orders || []).map((order) => order.project_id).filter(Boolean))]
    let projects = []
    if (projectIds.length) {
      let projectsQuery = supabase.from('projects').select('id,name,description,status,execution_state,waiting_on,state_updated_at,workspace_id,created_at,updated_at').in('id', projectIds)
      if (req.user.role !== 'super_admin') projectsQuery = projectsQuery.eq('workspace_id', req.user.workspace_id)
      const projectsResponse = await projectsQuery
      if (projectsResponse.error) throw projectsResponse.error
      projects = projectsResponse.data || []
    }
    const execution = await fetchExecutionData(projectIds)
    let files = []
    let allActivity = []
    if (projectIds.length) {
      const orderIds = (orders || []).map((order) => order.id)
      const [filesResponse, activityResponse] = await Promise.all([
        orderIds.length ? supabase.from('order_files').select('id,order_id,original_name,mime_type,byte_size,file_kind,created_at').in('order_id', orderIds).order('created_at', { ascending: false }) : { data: [], error: null },
        supabase.from('project_activity').select('id,project_id,event_type,visibility,created_at,actor_id').in('project_id', projectIds).order('created_at', { ascending: false }).limit(200),
      ])
      if (filesResponse.error || activityResponse.error) throw filesResponse.error || activityResponse.error
      files = filesResponse.data || []
      allActivity = activityResponse.data || []
    }
    let ticketsQuery = supabase.from('tickets').select('id,project_id,status,title,created_at,updated_at').eq('user_id', clientId)
    if (req.user.role !== 'super_admin') ticketsQuery = ticketsQuery.eq('workspace_id', req.user.workspace_id)
    const ticketsResponse = await ticketsQuery.order('updated_at', { ascending: false }).limit(100)
    if (ticketsResponse.error) throw ticketsResponse.error
    const tickets = ticketsResponse.data || []
    const projectOverview = projects.map((project) => {
      const projectOrders = (orders || []).filter((order) => order.project_id === project.id)
      const requirements = execution.requirements.filter((item) => item.project_id === project.id)
      const tasks = execution.tasks.filter((item) => item.project_id === project.id)
      const milestones = execution.milestones.filter((item) => item.project_id === project.id)
      const delivery = execution.deliveries.find((item) => item.project_id === project.id) || null
      const projectTickets = tickets.filter((ticket) => ticket.project_id === project.id)
      const projectFiles = files.filter((file) => projectOrders.some((order) => order.id === file.order_id))
      const projectActivity = allActivity.filter((item) => item.project_id === project.id)
      return {
        ...project,
        order: projectOrders[0] || null,
        requirements: {
          total: requirements.length,
          required: requirements.filter((item) => item.is_required).length,
          submitted: requirements.filter((item) => ['submitted', 'approved', 'not_applicable'].includes(item.status)).length,
          pending: requirements.filter((item) => item.is_required && ['requested', 'needs_revision'].includes(item.status)).length,
          needs_revision: requirements.filter((item) => item.status === 'needs_revision').length,
        },
        execution: {
          milestones: milestones.length,
          completed_milestones: milestones.filter((item) => item.status === 'completed').length,
          tasks: tasks.length,
          completed_tasks: tasks.filter((item) => ['done', 'cancelled'].includes(item.status)).length,
          client_visible_tasks: tasks.filter((item) => item.client_visible).length,
        },
        delivery: delivery ? { status: delivery.status, revision_count: delivery.revision_count || 0, updated_at: delivery.updated_at || null } : null,
        files: { total: projectFiles.length, customer_inputs: projectFiles.filter((file) => file.file_kind === 'customer_input').length, deliveries: projectFiles.filter((file) => file.file_kind === 'delivery').length, latest: projectFiles[0] || null },
        activity: { total: projectActivity.length, client_visible: projectActivity.filter((item) => item.visibility === 'client').length, internal: projectActivity.filter((item) => item.visibility === 'internal').length, latest: projectActivity[0] || null },
        tickets: { total: projectTickets.length, open: projectTickets.filter((ticket) => ['open', 'in_progress'].includes(ticket.status)).length, latest: projectTickets[0] || null },
      }
    })
    return res.json({ data: { client, projects: projectOverview, totals: { orders: (orders || []).length, projects: projectOverview.length, open_tickets: tickets.filter((ticket) => ['open', 'in_progress'].includes(ticket.status)).length } } })
  } catch (error) {
    console.error('Client 360 overview failed:', error)
    errorResponse(res, 500, 'Unable to load client overview')
  }
})

router.get('/operations/queue', authenticate, authorize('admin', 'super_admin', 'manager', 'editor'), async (req, res) => {
  try {
    let projectsQuery = supabase.from('projects').select('id,workspace_id,name,status,execution_state,waiting_on,state_updated_at,updated_at').order('updated_at', { ascending: false }).limit(100)
    if (req.user.role !== 'super_admin') {
      if (!req.user.workspace_id) return res.json({ data: [] })
      projectsQuery = projectsQuery.eq('workspace_id', req.user.workspace_id)
    }
    const projectsResponse = await projectsQuery
    if (projectsResponse.error) throw projectsResponse.error
    const projects = projectsResponse.data || []
    const projectIds = projects.map((project) => project.id)
    const execution = await fetchExecutionData(projectIds)
    const ordersResponse = projectIds.length ? await supabase.from('orders').select('id,project_id,service,package,status').in('project_id', projectIds).order('created_at', { ascending: true }) : { data: [], error: null }
    if (ordersResponse.error) throw ordersResponse.error
    const queue = projects.map((project) => {
      const tasks = execution.tasks.filter((task) => task.project_id === project.id)
      const requirements = execution.requirements.filter((item) => item.project_id === project.id)
      const delivery = execution.deliveries.find((item) => item.project_id === project.id) || null
      const state = deriveState({ tasks, requirements, delivery })
      const pendingRequirements = requirements.filter((item) => item.is_required && ['requested', 'needs_revision'].includes(item.status)).length
      const nextAction = state.execution_state === 'waiting_on_client' ? { type: 'requirements', title: 'Follow up on client requirements', priority: 'high' }
        : state.execution_state === 'waiting_on_review' ? { type: 'review', title: 'Review client delivery response', priority: 'high' }
          : state.execution_state === 'ready_for_delivery' ? { type: 'delivery', title: 'Prepare delivery', priority: 'high' }
            : state.execution_state === 'blocked' ? { type: 'blocked', title: 'Resolve blocked execution', priority: 'high' }
              : state.execution_state === 'completed' ? null : { type: 'execution', title: 'Continue execution', priority: 'medium' }
      return { ...project, ...state, pending_requirements: pendingRequirements, task_count: tasks.length, completed_task_count: tasks.filter((task) => ['done', 'cancelled'].includes(task.status)).length, delivery_status: delivery?.status || null, order: ordersResponse.data?.find((order) => order.project_id === project.id) || null, next_action: nextAction }
    })
    res.json({ data: queue })
  } catch (error) {
    console.error('Operations queue failed:', error)
    errorResponse(res, 500, 'Unable to load service delivery queue')
  }
})

router.get('/client/home', authenticate, async (req, res) => {
  try {
    const { data: orders, error: orderError } = await supabase.from('orders').select('id,project_id,package,service,status,payment_status,amount,price,created_at,updated_at').eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(50)
    if (orderError) throw orderError
    const projectIds = [...new Set((orders || []).map((order) => order.project_id).filter(Boolean))]
    const { data: projects, error: projectError } = projectIds.length ? await supabase.from('projects').select('*').in('id', projectIds) : { data: [], error: null }
    if (projectError) throw projectError
    const execution = await fetchExecutionData(projectIds)
    const projectsById = new Map((projects || []).map((project) => [project.id, project]))
    const projectCards = projectIds.map((projectId) => {
      const project = projectsById.get(projectId)
      if (!project) return null
      const order = orders.find((item) => item.project_id === projectId) || null
      return summarizeProject({
        project,
        order,
        milestones: execution.milestones.filter((item) => item.project_id === projectId),
        tasks: execution.tasks.filter((item) => item.project_id === projectId && item.client_visible),
        activity: execution.activity.filter((item) => item.project_id === projectId && item.visibility === 'client').slice(0, 10),
        requirements: execution.requirements.filter((item) => item.project_id === projectId && item.client_visible),
        delivery: execution.deliveries.find((item) => item.project_id === projectId) || null,
      })
    }).filter(Boolean)
    const notifications = await supabase.from('notifications').select('id,order_id,message,type,read,created_at').eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(20)
    if (notifications.error) throw notifications.error
    const actions = projectCards.flatMap((project) => project.next_action ? [{ ...project.next_action, project_id: project.id, project_name: project.name }] : [])
    res.json({ data: { projects: projectCards, orders: orders || [], actions, notifications: notifications.data || [] } })
  } catch (error) {
    console.error('Client home failed:', error)
    errorResponse(res, 500, 'Unable to load your BİŞIŞ workspace')
  }
})

router.post('/projects/:projectId/delivery/prepare', authenticate, authorize('admin', 'super_admin', 'manager', 'editor'), async (req, res) => {
  try {
    const projectId = safeId(req.params.projectId)
    if (!projectId) return errorResponse(res, 400, 'Invalid project id')
    if (!await getStaffProject(projectId, req.user)) return errorResponse(res, 404, 'Project not found')
    const { data: current } = await supabase.from('project_deliveries').select('*').eq('project_id', projectId).maybeSingle()
    const transition = deliveryTransitions.prepare
    if (current && !transition.from.has(current.status)) return errorResponse(res, 409, 'Delivery cannot be prepared from its current state', 'INVALID_DELIVERY_TRANSITION')
    const payload = { project_id: projectId, status: transition.to, notes: String(req.body?.notes || current?.notes || '').slice(0, 10000), prepared_by: req.user.id, prepared_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    const { data, error } = current ? await supabase.from('project_deliveries').update(payload).eq('id', current.id).select().single() : await supabase.from('project_deliveries').insert([payload]).select().single()
    if (error) throw error
    await recordActivity({ projectId, actorId: req.user.id, eventType: 'DELIVERY_PREPARED', visibility: 'client', payload: { delivery_id: data.id } })
    await updateProjectState(projectId, { execution_state: 'ready_for_delivery', waiting_on: null })
    res.json({ data })
  } catch (error) {
    console.error('Delivery preparation failed:', error)
    errorResponse(res, 500, 'Unable to prepare delivery')
  }
})

router.post('/projects/:projectId/delivery/send', authenticate, authorize('admin', 'super_admin', 'manager', 'editor'), async (req, res) => {
  try {
    const projectId = safeId(req.params.projectId)
    if (!projectId) return errorResponse(res, 400, 'Invalid project id')
    if (!await getStaffProject(projectId, req.user)) return errorResponse(res, 404, 'Project not found')
    const { data: current } = await supabase.from('project_deliveries').select('*').eq('project_id', projectId).maybeSingle()
    if (!current || current.status !== 'prepared') return errorResponse(res, 409, 'Delivery must be prepared before sending', 'INVALID_DELIVERY_TRANSITION')
    const { data, error } = await supabase.from('project_deliveries').update({ status: 'client_review', delivered_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', current.id).select().single()
    if (error) throw error
    await recordActivity({ projectId, actorId: req.user.id, eventType: 'DELIVERY_SENT', visibility: 'client', payload: { delivery_id: data.id } })
    await notifyProjectOwner({ projectId, message: 'Your delivery is ready for review.' })
    await updateProjectState(projectId, { execution_state: 'waiting_on_review', waiting_on: 'review' })
    res.json({ data })
  } catch (error) {
    console.error('Delivery send failed:', error)
    errorResponse(res, 500, 'Unable to send delivery')
  }
})

router.post('/projects/:projectId/delivery/approve', authenticate, async (req, res) => {
  try {
    const projectId = safeId(req.params.projectId)
    if (!projectId) return errorResponse(res, 400, 'Invalid project id')
    const access = await getClientProject(projectId, req.user.id)
    if (!access) return errorResponse(res, 404, 'Project not found')
    const { data: current } = await supabase.from('project_deliveries').select('*').eq('project_id', projectId).maybeSingle()
    if (!current || !['client_review', 'delivered'].includes(current.status)) return errorResponse(res, 409, 'Delivery is not awaiting approval', 'INVALID_DELIVERY_TRANSITION')
    const { data, error } = await supabase.from('project_deliveries').update({ status: 'completed', approved_at: new Date().toISOString(), reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', current.id).select().single()
    if (error) throw error
    await recordActivity({ projectId, actorId: req.user.id, eventType: 'CLIENT_APPROVED', visibility: 'client', payload: { delivery_id: data.id } })
    await updateProjectState(projectId, { execution_state: 'completed', waiting_on: null })
    res.json({ data })
  } catch (error) {
    console.error('Delivery approval failed:', error)
    errorResponse(res, 500, 'Unable to approve delivery')
  }
})

router.post('/projects/:projectId/delivery/revision', authenticate, async (req, res) => {
  try {
    const projectId = safeId(req.params.projectId)
    if (!projectId) return errorResponse(res, 400, 'Invalid project id')
    const access = await getClientProject(projectId, req.user.id)
    if (!access) return errorResponse(res, 404, 'Project not found')
    const { data: current } = await supabase.from('project_deliveries').select('*').eq('project_id', projectId).maybeSingle()
    if (!current || !['client_review', 'delivered'].includes(current.status)) return errorResponse(res, 409, 'Delivery is not awaiting review', 'INVALID_DELIVERY_TRANSITION')
    if (current.revision_count >= 5) return errorResponse(res, 409, 'Revision limit reached', 'REVISION_LIMIT_REACHED')
    const reason = String(req.body?.reason || '').trim().slice(0, 2000)
    if (!reason) return errorResponse(res, 400, 'A revision reason is required')
    const { data, error } = await supabase.from('project_deliveries').update({ status: 'revision_requested', revision_reason: reason, revision_count: current.revision_count + 1, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', current.id).select().single()
    if (error) throw error
    await recordActivity({ projectId, actorId: req.user.id, eventType: 'REVISION_REQUESTED', visibility: 'client', payload: { delivery_id: data.id, reason } })
    await notifyProjectOwner({ projectId, message: 'A client requested changes to the delivery.' })
    await updateProjectState(projectId, { execution_state: 'in_progress', waiting_on: 'founder' })
    res.json({ data })
  } catch (error) {
    console.error('Delivery revision failed:', error)
    errorResponse(res, 500, 'Unable to request revision')
  }
})

module.exports = router
