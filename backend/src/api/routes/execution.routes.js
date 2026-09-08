const express = require('express')
const { authenticate, authorize } = require('../middleware/auth.middleware')
const supabase = require('../../config/supabase.config')

const router = express.Router()
const staffRoles = ['admin', 'super_admin', 'manager', 'editor']
const milestoneStatuses = ['not_started', 'in_progress', 'completed', 'blocked']
const taskStatuses = ['todo', 'in_progress', 'blocked', 'done', 'cancelled']
const priorities = ['low', 'medium', 'high', 'urgent']

const staffOnly = [authenticate, authorize(...staffRoles)]

const safeId = (value) => /^\d+$/.test(String(value || ''))
const textValue = (value, max = 500) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max
const isInteger = (value) => Number.isInteger(Number(value)) && Number(value) >= 0
const nullableSafeId = (value) => value === null || value === undefined || value === '' ? null : (safeId(value) ? Number(value) : undefined)

async function getProjectForUser(projectId, user) {
  if (!safeId(projectId)) return null
  let query = supabase
    .from('projects')
    .select('id, workspace_id, name, description, status, created_at, updated_at')
    .eq('id', projectId)
  if (user.role !== 'super_admin') {
    if (!user.workspace_id) return null
    query = query.eq('workspace_id', user.workspace_id)
  }
  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return data || null
}

async function recordActivity({ projectId, actorId, entityType, entityId, eventType, payload = {}, visibility = 'internal' }) {
  const { data, error } = await supabase
    .from('project_activity')
    .insert([{ project_id: projectId, actor_id: actorId, entity_type: entityType, entity_id: entityId ? String(entityId) : null, event_type: eventType, visibility, payload }])
    .select()
    .single()
  if (error) throw error
  return data
}

async function refreshProjectState(projectId) {
  const [tasksResponse, requirementsResponse, deliveryResponse] = await Promise.all([
    supabase.from('project_tasks').select('status').eq('project_id', projectId),
    supabase.from('project_requirements').select('status,is_required').eq('project_id', projectId).eq('client_visible', true),
    supabase.from('project_deliveries').select('status').eq('project_id', projectId).maybeSingle(),
  ])
  if (tasksResponse.error || requirementsResponse.error || deliveryResponse.error) throw tasksResponse.error || requirementsResponse.error || deliveryResponse.error
  const tasks = tasksResponse.data || []
  const requirements = requirementsResponse.data || []
  const delivery = deliveryResponse.data
  const pendingRequirements = requirements.some((item) => item.is_required && ['requested', 'needs_revision'].includes(item.status))
  let executionState = 'not_started'
  let waitingOn = null
  if (pendingRequirements) { executionState = 'waiting_on_client'; waitingOn = 'client' }
  else if (delivery?.status === 'client_review') { executionState = 'waiting_on_review'; waitingOn = 'review' }
  else if (delivery?.status === 'completed' || delivery?.status === 'approved') executionState = 'completed'
  else if (tasks.some((task) => task.status === 'blocked')) { executionState = 'blocked'; waitingOn = 'founder' }
  else if (tasks.length && tasks.every((task) => ['done', 'cancelled'].includes(task.status))) { executionState = 'ready_for_delivery'; waitingOn = 'founder' }
  else if (tasks.some((task) => ['in_progress', 'done'].includes(task.status))) { executionState = 'in_progress'; waitingOn = 'founder' }
  else if (tasks.length) { executionState = 'in_progress'; waitingOn = 'founder' }
  const { error } = await supabase.from('projects').update({ execution_state: executionState, waiting_on: waitingOn, state_updated_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', projectId)
  if (error) throw error
  return { execution_state: executionState, waiting_on: waitingOn }
}

async function getLatestPosition(table, projectId, column = 'project_id') {
  const { data, error } = await supabase
    .from(table)
    .select('position')
    .eq(column, projectId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data ? Number(data.position) + 1 : 0
}

function fail(res, status, message, code) {
  return res.status(status).json({ message, ...(code ? { code } : {}) })
}

// ---------------- Templates ----------------
router.get('/templates', ...staffOnly, async (req, res) => {
  try {
    let query = supabase
      .from('project_templates')
      .select('*, project_template_milestones(*, project_template_tasks(*))')
      .order('created_at', { ascending: false })
    if (String(req.query.include_archived || '').toLowerCase() !== 'true') query = query.eq('is_active', true)
    const { data, error } = await query
    if (error) throw error
    return res.json({ data: data || [] })
  } catch (error) {
    return fail(res, 500, 'Unable to load execution templates')
  }
})

router.post('/templates', ...staffOnly, async (req, res) => {
  const { name, description = '', service_id: serviceId = null, milestones = [] } = req.body || {}
  if (!textValue(name, 160) || !Array.isArray(milestones) || milestones.length > 20) {
    return fail(res, 400, 'A valid template name and up to 20 milestones are required')
  }
  if (milestones.some((milestone) => !textValue(milestone.title, 160) || !Array.isArray(milestone.tasks) || milestone.tasks.length > 50)) {
    return fail(res, 400, 'Each milestone requires a title and up to 50 tasks')
  }
  let template
  try {
    const { data, error } = await supabase
      .from('project_templates')
      .insert([{ name: name.trim(), description: String(description).slice(0, 1000), service_id: serviceId, created_by: req.user.id }])
      .select()
      .single()
    if (error) throw error
    template = data
    for (let index = 0; index < milestones.length; index += 1) {
      const milestone = milestones[index]
      const { data: createdMilestone, error: milestoneError } = await supabase
        .from('project_template_milestones')
        .insert([{ template_id: template.id, title: milestone.title.trim(), description: String(milestone.description || '').slice(0, 1000), position: index }])
        .select()
        .single()
      if (milestoneError) throw milestoneError
      const taskRows = milestone.tasks.map((task, taskIndex) => ({
        template_milestone_id: createdMilestone.id,
        title: task.title.trim(),
        description: String(task.description || '').slice(0, 1000),
        priority: priorities.includes(task.priority) ? task.priority : 'medium',
        position: taskIndex,
        client_visible: Boolean(task.client_visible),
      }))
      if (taskRows.length) {
        const { error: taskError } = await supabase.from('project_template_tasks').insert(taskRows)
        if (taskError) throw taskError
      }
    }
    return res.status(201).json({ data: template })
  } catch (error) {
    if (template?.id) await supabase.from('project_templates').delete().eq('id', template.id)
    return fail(res, 500, 'Template creation failed safely', 'TEMPLATE_CREATE_FAILED')
  }
})

router.patch('/templates/:templateId', ...staffOnly, async (req, res) => {
  const templateId = req.params.templateId
  const { name, description, service_id: serviceId, is_active: isActive } = req.body || {}
  if (!safeId(templateId)) return fail(res, 400, 'Invalid template id')
  if (name !== undefined && !textValue(name, 160)) return fail(res, 400, 'Invalid template name')
  if (serviceId !== undefined && nullableSafeId(serviceId) === undefined) return fail(res, 400, 'Invalid service id')
  if (isActive !== undefined && typeof isActive !== 'boolean') return fail(res, 400, 'is_active must be boolean')
  try {
    const { data: current, error: currentError } = await supabase.from('project_templates').select('*').eq('id', templateId).maybeSingle()
    if (currentError) throw currentError
    if (!current) return fail(res, 404, 'Template not found')
    const update = { updated_at: new Date().toISOString() }
    if (name !== undefined) update.name = name.trim()
    if (description !== undefined) update.description = String(description).slice(0, 1000)
    if (serviceId !== undefined) update.service_id = nullableSafeId(serviceId)
    if (isActive !== undefined) update.is_active = isActive
    const { data, error } = await supabase.from('project_templates').update(update).eq('id', templateId).select().single()
    if (error) throw error
    return res.json({ data })
  } catch (error) {
    return fail(res, 500, 'Template update failed', 'TEMPLATE_UPDATE_FAILED')
  }
})

router.delete('/templates/:templateId', ...staffOnly, async (req, res) => {
  if (!safeId(req.params.templateId)) return fail(res, 400, 'Invalid template id')
  try {
    const { data, error } = await supabase.from('project_templates').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', req.params.templateId).select().single()
    if (error) {
      if (error.code === 'PGRST116') return fail(res, 404, 'Template not found')
      throw error
    }
    return res.json({ data })
  } catch (error) {
    return fail(res, 500, 'Template archive failed', 'TEMPLATE_ARCHIVE_FAILED')
  }
})

router.post('/templates/:templateId/duplicate', ...staffOnly, async (req, res) => {
  if (!safeId(req.params.templateId)) return fail(res, 400, 'Invalid template id')
  let createdTemplateId = null
  try {
    const { data: source, error: sourceError } = await supabase
      .from('project_templates')
      .select('*, project_template_milestones(*, project_template_tasks(*))')
      .eq('id', req.params.templateId)
      .maybeSingle()
    if (sourceError) throw sourceError
    if (!source) return fail(res, 404, 'Template not found')
    const requestedName = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
    const duplicateName = requestedName || `${source.name} (Copy)`
    if (!textValue(duplicateName, 160)) return fail(res, 400, 'Invalid duplicate template name')
    const { data: created, error: createError } = await supabase.from('project_templates').insert([{
      name: duplicateName,
      description: source.description || '',
      service_id: source.service_id || null,
      is_active: true,
      created_by: req.user.id,
    }]).select().single()
    if (createError) throw createError
    createdTemplateId = created.id
    for (const milestone of (source.project_template_milestones || []).sort((a, b) => Number(a.position) - Number(b.position))) {
      const { data: createdMilestone, error: milestoneError } = await supabase.from('project_template_milestones').insert([{
        template_id: created.id,
        title: milestone.title,
        description: milestone.description || '',
        position: milestone.position,
      }]).select().single()
      if (milestoneError) throw milestoneError
      const tasks = (milestone.project_template_tasks || []).sort((a, b) => Number(a.position) - Number(b.position)).map((task) => ({
        template_milestone_id: createdMilestone.id,
        title: task.title,
        description: task.description || '',
        priority: priorities.includes(task.priority) ? task.priority : 'medium',
        position: task.position,
        client_visible: Boolean(task.client_visible),
      }))
      if (tasks.length) {
        const { error: taskError } = await supabase.from('project_template_tasks').insert(tasks)
        if (taskError) throw taskError
      }
    }
    const { data: result, error: resultError } = await supabase.from('project_templates').select('*, project_template_milestones(*, project_template_tasks(*))').eq('id', created.id).single()
    if (resultError) throw resultError
    return res.status(201).json({ data: result })
  } catch (error) {
    if (createdTemplateId) await supabase.from('project_templates').delete().eq('id', createdTemplateId)
    return fail(res, 500, 'Template duplication failed safely', 'TEMPLATE_DUPLICATE_FAILED')
  }
})

async function getTemplateForStaff(templateId) {
  if (!safeId(templateId)) return null
  const { data, error } = await supabase.from('project_templates').select('*').eq('id', templateId).maybeSingle()
  if (error) throw error
  return data || null
}

router.post('/templates/:templateId/milestones', ...staffOnly, async (req, res) => {
  const { title, description = '', position } = req.body || {}
  if (!textValue(title, 160)) return fail(res, 400, 'A valid milestone title is required')
  try {
    const template = await getTemplateForStaff(req.params.templateId)
    if (!template) return fail(res, 404, 'Template not found')
    const nextPosition = isInteger(position) ? Number(position) : await getLatestPosition('project_template_milestones', template.id, 'template_id')
    const { data, error } = await supabase.from('project_template_milestones').insert([{
      template_id: template.id,
      title: title.trim(),
      description: String(description).slice(0, 1000),
      position: nextPosition,
    }]).select().single()
    if (error) throw error
    return res.status(201).json({ data })
  } catch (error) {
    return fail(res, 500, 'Template milestone creation failed', 'TEMPLATE_MILESTONE_CREATE_FAILED')
  }
})

router.patch('/templates/:templateId/milestones/:milestoneId', ...staffOnly, async (req, res) => {
  const { title, description, position } = req.body || {}
  if (title !== undefined && !textValue(title, 160)) return fail(res, 400, 'Invalid milestone title')
  if (position !== undefined && !isInteger(position)) return fail(res, 400, 'Invalid milestone position')
  try {
    const template = await getTemplateForStaff(req.params.templateId)
    if (!template) return fail(res, 404, 'Template not found')
    const { data: current, error: currentError } = await supabase.from('project_template_milestones').select('*').eq('id', req.params.milestoneId).eq('template_id', template.id).maybeSingle()
    if (currentError) throw currentError
    if (!current) return fail(res, 404, 'Template milestone not found')
    const update = {}
    if (title !== undefined) update.title = title.trim()
    if (description !== undefined) update.description = String(description).slice(0, 1000)
    if (position !== undefined) update.position = Number(position)
    if (!Object.keys(update).length) return fail(res, 400, 'No milestone changes provided')
    const { data, error } = await supabase.from('project_template_milestones').update(update).eq('id', current.id).eq('template_id', template.id).select().single()
    if (error) throw error
    return res.json({ data })
  } catch (error) {
    return fail(res, 500, 'Template milestone update failed', 'TEMPLATE_MILESTONE_UPDATE_FAILED')
  }
})

router.delete('/templates/:templateId/milestones/:milestoneId', ...staffOnly, async (req, res) => {
  try {
    const template = await getTemplateForStaff(req.params.templateId)
    if (!template) return fail(res, 404, 'Template not found')
    const { data: current, error: currentError } = await supabase.from('project_template_milestones').select('id').eq('id', req.params.milestoneId).eq('template_id', template.id).maybeSingle()
    if (currentError) throw currentError
    if (!current) return fail(res, 404, 'Template milestone not found')
    const { error } = await supabase.from('project_template_milestones').delete().eq('id', current.id).eq('template_id', template.id)
    if (error) throw error
    return res.json({ data: { id: current.id, deleted: true } })
  } catch (error) {
    return fail(res, 500, 'Template milestone deletion failed', 'TEMPLATE_MILESTONE_DELETE_FAILED')
  }
})

router.post('/templates/:templateId/milestones/:milestoneId/tasks', ...staffOnly, async (req, res) => {
  const { title, description = '', priority = 'medium', position, client_visible: clientVisible = false } = req.body || {}
  if (!textValue(title, 180) || !priorities.includes(priority)) return fail(res, 400, 'A valid task title and priority are required')
  try {
    const template = await getTemplateForStaff(req.params.templateId)
    if (!template) return fail(res, 404, 'Template not found')
    const { data: milestone, error: milestoneError } = await supabase.from('project_template_milestones').select('id').eq('id', req.params.milestoneId).eq('template_id', template.id).maybeSingle()
    if (milestoneError) throw milestoneError
    if (!milestone) return fail(res, 404, 'Template milestone not found')
    const nextPosition = isInteger(position) ? Number(position) : await getLatestPosition('project_template_tasks', milestone.id, 'template_milestone_id')
    const { data, error } = await supabase.from('project_template_tasks').insert([{
      template_milestone_id: milestone.id,
      title: title.trim(),
      description: String(description).slice(0, 1000),
      priority,
      position: nextPosition,
      client_visible: Boolean(clientVisible),
    }]).select().single()
    if (error) throw error
    return res.status(201).json({ data })
  } catch (error) {
    return fail(res, 500, 'Template task creation failed', 'TEMPLATE_TASK_CREATE_FAILED')
  }
})

router.patch('/templates/:templateId/milestones/:milestoneId/tasks/:taskId', ...staffOnly, async (req, res) => {
  const { title, description, priority, position, client_visible: clientVisible } = req.body || {}
  if (title !== undefined && !textValue(title, 180)) return fail(res, 400, 'Invalid task title')
  if (priority !== undefined && !priorities.includes(priority)) return fail(res, 400, 'Invalid task priority')
  if (position !== undefined && !isInteger(position)) return fail(res, 400, 'Invalid task position')
  try {
    const template = await getTemplateForStaff(req.params.templateId)
    if (!template) return fail(res, 404, 'Template not found')
    const { data: milestone, error: milestoneError } = await supabase.from('project_template_milestones').select('id').eq('id', req.params.milestoneId).eq('template_id', template.id).maybeSingle()
    if (milestoneError) throw milestoneError
    if (!milestone) return fail(res, 404, 'Template milestone not found')
    const { data: current, error: currentError } = await supabase.from('project_template_tasks').select('*').eq('id', req.params.taskId).eq('template_milestone_id', milestone.id).maybeSingle()
    if (currentError) throw currentError
    if (!current) return fail(res, 404, 'Template task not found')
    const update = {}
    if (title !== undefined) update.title = title.trim()
    if (description !== undefined) update.description = String(description).slice(0, 1000)
    if (priority !== undefined) update.priority = priority
    if (position !== undefined) update.position = Number(position)
    if (clientVisible !== undefined) update.client_visible = Boolean(clientVisible)
    if (!Object.keys(update).length) return fail(res, 400, 'No task changes provided')
    const { data, error } = await supabase.from('project_template_tasks').update(update).eq('id', current.id).eq('template_milestone_id', milestone.id).select().single()
    if (error) throw error
    return res.json({ data })
  } catch (error) {
    return fail(res, 500, 'Template task update failed', 'TEMPLATE_TASK_UPDATE_FAILED')
  }
})

router.delete('/templates/:templateId/milestones/:milestoneId/tasks/:taskId', ...staffOnly, async (req, res) => {
  try {
    const template = await getTemplateForStaff(req.params.templateId)
    if (!template) return fail(res, 404, 'Template not found')
    const { data: milestone, error: milestoneError } = await supabase.from('project_template_milestones').select('id').eq('id', req.params.milestoneId).eq('template_id', template.id).maybeSingle()
    if (milestoneError) throw milestoneError
    if (!milestone) return fail(res, 404, 'Template milestone not found')
    const { data: current, error: currentError } = await supabase.from('project_template_tasks').select('id').eq('id', req.params.taskId).eq('template_milestone_id', milestone.id).maybeSingle()
    if (currentError) throw currentError
    if (!current) return fail(res, 404, 'Template task not found')
    const { error } = await supabase.from('project_template_tasks').delete().eq('id', current.id).eq('template_milestone_id', milestone.id)
    if (error) throw error
    return res.json({ data: { id: current.id, deleted: true } })
  } catch (error) {
    return fail(res, 500, 'Template task deletion failed', 'TEMPLATE_TASK_DELETE_FAILED')
  }
})

// ---------------- Project structure ----------------
router.get('/projects/:projectId/structure', ...staffOnly, async (req, res) => {
  try {
    const project = await getProjectForUser(req.params.projectId, req.user)
    if (!project) return fail(res, 404, 'Project not found')
    const [{ data: milestones, error: milestoneError }, { data: tasks, error: taskError }, { data: activity, error: activityError }] = await Promise.all([
      supabase.from('project_milestones').select('*').eq('project_id', project.id).order('position', { ascending: true }),
      supabase.from('project_tasks').select('*').eq('project_id', project.id).order('created_at', { ascending: false }),
      supabase.from('project_activity').select('*').eq('project_id', project.id).order('created_at', { ascending: false }).limit(50),
    ])
    if (milestoneError || taskError || activityError) throw milestoneError || taskError || activityError
    return res.json({ data: { project, milestones: milestones || [], tasks: tasks || [], activity: activity || [] } })
  } catch (error) {
    return fail(res, 500, 'Unable to load project execution data')
  }
})

router.get('/projects/:projectId/next-actions', ...staffOnly, async (req, res) => {
  try {
    const project = await getProjectForUser(req.params.projectId, req.user)
    if (!project) return fail(res, 404, 'Project not found')
    const [{ data: milestones, error: milestoneError }, { data: tasks, error: taskError }] = await Promise.all([
      supabase.from('project_milestones').select('*').eq('project_id', project.id).order('position', { ascending: true }),
      supabase.from('project_tasks').select('*').eq('project_id', project.id).order('due_at', { ascending: true, nullsFirst: false }),
    ])
    if (milestoneError || taskError) throw milestoneError || taskError
    const openTasks = (tasks || []).filter((task) => !['done', 'cancelled'].includes(task.status))
    const overdue = openTasks.filter((task) => task.due_at && new Date(task.due_at).getTime() < Date.now())
    const activeMilestone = (milestones || []).find((milestone) => ['in_progress', 'blocked'].includes(milestone.status))
    const actions = []
    if (!milestones?.length) actions.push({ type: 'initialize_structure', priority: 'high', title: 'Initialize project structure' })
    if (overdue.length) actions.push({ type: 'review_overdue_tasks', priority: 'urgent', title: 'Review overdue tasks', entity_id: overdue[0].id })
    if (activeMilestone && openTasks.length) actions.push({ type: activeMilestone.status === 'blocked' ? 'resolve_blocker' : 'continue_milestone', priority: 'high', title: activeMilestone.status === 'blocked' ? 'Resolve milestone blocker' : 'Continue active milestone', entity_id: activeMilestone.id })
    if (!actions.length && milestones?.length && milestones.every((milestone) => milestone.status === 'completed')) actions.push({ type: 'review_delivery', priority: 'medium', title: 'Review project delivery' })
    if (!actions.length) actions.push({ type: 'monitor', priority: 'low', title: 'Monitor project progress' })
    return res.json({ data: actions })
  } catch (error) {
    return fail(res, 500, 'Unable to calculate next actions')
  }
})

router.post('/projects/:projectId/apply-template', ...staffOnly, async (req, res) => {
  const templateId = req.body?.template_id
  if (!safeId(templateId)) return fail(res, 400, 'template_id is required')
  let insertedMilestoneIds = []
  let insertedTaskIds = []
  try {
    const project = await getProjectForUser(req.params.projectId, req.user)
    if (!project) return fail(res, 404, 'Project not found')
    const [{ data: existingMilestone }, { data: existingTask }, { data: template, error: templateError }] = await Promise.all([
      supabase.from('project_milestones').select('id').eq('project_id', project.id).limit(1).maybeSingle(),
      supabase.from('project_tasks').select('id').eq('project_id', project.id).limit(1).maybeSingle(),
      supabase.from('project_templates').select('id, name').eq('id', templateId).eq('is_active', true).maybeSingle(),
    ])
    if (templateError) throw templateError
    if (!template) return fail(res, 404, 'Template not found')
    if (existingMilestone || existingTask) return fail(res, 409, 'Project structure already exists', 'PROJECT_STRUCTURE_EXISTS')
    const { data: templateMilestones, error: milestoneError } = await supabase.from('project_template_milestones').select('*').eq('template_id', template.id).order('position', { ascending: true })
    if (milestoneError) throw milestoneError
    const templateMilestoneIds = (templateMilestones || []).map((item) => item.id)
    const { data: templateTasks, error: taskError } = templateMilestoneIds.length
      ? await supabase.from('project_template_tasks').select('*').in('template_milestone_id', templateMilestoneIds).order('position', { ascending: true })
      : { data: [], error: null }
    if (taskError) throw taskError
    const milestoneRows = (templateMilestones || []).map((milestone) => ({ project_id: project.id, title: milestone.title, description: milestone.description, position: milestone.position, created_by: req.user.id }))
    const { data: createdMilestones, error: createMilestoneError } = milestoneRows.length
      ? await supabase.from('project_milestones').insert(milestoneRows).select()
      : { data: [], error: null }
    if (createMilestoneError) throw createMilestoneError
    insertedMilestoneIds = (createdMilestones || []).map((milestone) => milestone.id)
    const milestoneMap = new Map((createdMilestones || []).map((milestone) => [milestone.position, milestone.id]))
    const taskRows = (templateTasks || []).map((task) => {
      const templateMilestone = templateMilestones.find((milestone) => milestone.id === task.template_milestone_id)
      return { project_id: project.id, milestone_id: milestoneMap.get(templateMilestone?.position), title: task.title, description: task.description, priority: task.priority, client_visible: task.client_visible, created_by: req.user.id }
    })
    const { data: createdTasks, error: createTaskError } = taskRows.length
      ? await supabase.from('project_tasks').insert(taskRows).select()
      : { data: [], error: null }
    if (createTaskError) throw createTaskError
    insertedTaskIds = (createdTasks || []).map((task) => task.id)
    await recordActivity({ projectId: project.id, actorId: req.user.id, entityType: 'project', entityId: project.id, eventType: 'PROJECT_STRUCTURE_INITIALIZED', payload: { template_id: template.id, milestone_count: insertedMilestoneIds.length, task_count: insertedTaskIds.length } })
    return res.status(201).json({ data: { project_id: project.id, template_id: template.id, milestones: createdMilestones || [], tasks: createdTasks || [] } })
  } catch (error) {
    if (insertedTaskIds.length) await supabase.from('project_tasks').delete().in('id', insertedTaskIds)
    if (insertedMilestoneIds.length) await supabase.from('project_milestones').delete().in('id', insertedMilestoneIds)
    return fail(res, 500, 'Template application failed safely', 'TEMPLATE_APPLY_FAILED')
  }
})

// ---------------- Milestones ----------------
router.post('/projects/:projectId/milestones', ...staffOnly, async (req, res) => {
  const { title, description = '', position, status = 'not_started', due_date: dueDate = null } = req.body || {}
  if (!textValue(title, 160) || !milestoneStatuses.includes(status)) return fail(res, 400, 'Valid milestone title and status are required')
  try {
    const project = await getProjectForUser(req.params.projectId, req.user)
    if (!project) return fail(res, 404, 'Project not found')
    const nextPosition = isInteger(position) ? Number(position) : await getLatestPosition('project_milestones', project.id)
    const { data, error } = await supabase.from('project_milestones').insert([{ project_id: project.id, title: title.trim(), description: String(description).slice(0, 1000), position: nextPosition, status, due_date: dueDate, created_by: req.user.id }]).select().single()
    if (error) throw error
    await recordActivity({ projectId: project.id, actorId: req.user.id, entityType: 'milestone', entityId: data.id, eventType: 'MILESTONE_CREATED', payload: { title: data.title } })
    await refreshProjectState(project.id)
    return res.status(201).json({ data })
  } catch (error) {
    return fail(res, 500, 'Milestone creation failed')
  }
})

router.patch('/projects/:projectId/milestones/:milestoneId', ...staffOnly, async (req, res) => {
  const { status, title, description, position, due_date: dueDate } = req.body || {}
  if (status !== undefined && !milestoneStatuses.includes(status)) return fail(res, 400, 'Invalid milestone status')
  try {
    const project = await getProjectForUser(req.params.projectId, req.user)
    if (!project) return fail(res, 404, 'Project not found')
    const { data: current, error: currentError } = await supabase.from('project_milestones').select('*').eq('id', req.params.milestoneId).eq('project_id', project.id).maybeSingle()
    if (currentError) throw currentError
    if (!current) return fail(res, 404, 'Milestone not found')
    const update = {}
    if (title !== undefined) { if (!textValue(title, 160)) return fail(res, 400, 'Invalid milestone title'); update.title = title.trim() }
    if (description !== undefined) update.description = String(description).slice(0, 1000)
    if (position !== undefined) { if (!isInteger(position)) return fail(res, 400, 'Invalid milestone position'); update.position = Number(position) }
    if (dueDate !== undefined) update.due_date = dueDate
    if (status !== undefined) update.status = status
    if (status === 'completed' && current.status !== 'completed') update.completed_at = new Date().toISOString()
    if (status && status !== 'completed' && current.status === 'completed') update.completed_at = null
    update.updated_at = new Date().toISOString()
    const { data, error } = await supabase.from('project_milestones').update(update).eq('id', current.id).eq('project_id', project.id).select().single()
    if (error) throw error
    if (current.status !== data.status) await recordActivity({ projectId: project.id, actorId: req.user.id, entityType: 'milestone', entityId: data.id, eventType: data.status === 'completed' ? 'MILESTONE_COMPLETED' : 'MILESTONE_STATUS_CHANGED', payload: { from: current.status, to: data.status } })
    await refreshProjectState(project.id)
    return res.json({ data })
  } catch (error) {
    return fail(res, 500, 'Milestone update failed')
  }
})

// ---------------- Tasks ----------------
router.post('/projects/:projectId/tasks', ...staffOnly, async (req, res) => {
  const { title, description = '', milestone_id: milestoneId = null, order_id: orderId = null, status = 'todo', priority = 'medium', assignee_id: assigneeId = null, due_at: dueAt = null, client_visible: clientVisible = false } = req.body || {}
  if (!textValue(title, 180) || !taskStatuses.includes(status) || !priorities.includes(priority)) return fail(res, 400, 'Valid task title, status, and priority are required')
  try {
    const project = await getProjectForUser(req.params.projectId, req.user)
    if (!project) return fail(res, 404, 'Project not found')
    if (milestoneId) {
      const { data: milestone } = await supabase.from('project_milestones').select('id').eq('id', milestoneId).eq('project_id', project.id).maybeSingle()
      if (!milestone) return fail(res, 400, 'Milestone does not belong to project')
    }
    const { data, error } = await supabase.from('project_tasks').insert([{ project_id: project.id, milestone_id: milestoneId, order_id: orderId, title: title.trim(), description: String(description).slice(0, 1500), status, priority, assignee_id: assigneeId, due_at: dueAt, client_visible: Boolean(clientVisible), created_by: req.user.id }]).select().single()
    if (error) throw error
    await recordActivity({ projectId: project.id, actorId: req.user.id, entityType: 'task', entityId: data.id, eventType: 'TASK_CREATED', payload: { title: data.title, priority: data.priority } })
    await refreshProjectState(project.id)
    return res.status(201).json({ data })
  } catch (error) {
    return fail(res, 500, 'Task creation failed')
  }
})

router.patch('/projects/:projectId/tasks/:taskId', ...staffOnly, async (req, res) => {
  const { status, title, description, priority, assignee_id: assigneeId, due_at: dueAt, milestone_id: milestoneId, client_visible: clientVisible } = req.body || {}
  if (status !== undefined && !taskStatuses.includes(status)) return fail(res, 400, 'Invalid task status')
  if (priority !== undefined && !priorities.includes(priority)) return fail(res, 400, 'Invalid task priority')
  try {
    const project = await getProjectForUser(req.params.projectId, req.user)
    if (!project) return fail(res, 404, 'Project not found')
    const { data: current, error: currentError } = await supabase.from('project_tasks').select('*').eq('id', req.params.taskId).eq('project_id', project.id).maybeSingle()
    if (currentError) throw currentError
    if (!current) return fail(res, 404, 'Task not found')
    if (milestoneId) {
      const { data: milestone } = await supabase.from('project_milestones').select('id').eq('id', milestoneId).eq('project_id', project.id).maybeSingle()
      if (!milestone) return fail(res, 400, 'Milestone does not belong to project')
    }
    const update = { updated_at: new Date().toISOString() }
    if (title !== undefined) { if (!textValue(title, 180)) return fail(res, 400, 'Invalid task title'); update.title = title.trim() }
    if (description !== undefined) update.description = String(description).slice(0, 1500)
    if (status !== undefined) update.status = status
    if (priority !== undefined) update.priority = priority
    if (assigneeId !== undefined) update.assignee_id = assigneeId
    if (dueAt !== undefined) update.due_at = dueAt
    if (milestoneId !== undefined) update.milestone_id = milestoneId
    if (clientVisible !== undefined) update.client_visible = Boolean(clientVisible)
    if (status === 'done' && current.status !== 'done') update.completed_at = new Date().toISOString()
    if (status && status !== 'done' && current.status === 'done') update.completed_at = null
    const { data, error } = await supabase.from('project_tasks').update(update).eq('id', current.id).eq('project_id', project.id).select().single()
    if (error) throw error
    if (current.status !== data.status) await recordActivity({ projectId: project.id, actorId: req.user.id, entityType: 'task', entityId: data.id, eventType: data.status === 'done' ? 'TASK_COMPLETED' : 'TASK_STATUS_CHANGED', payload: { from: current.status, to: data.status } })
    await refreshProjectState(project.id)
    return res.json({ data })
  } catch (error) {
    return fail(res, 500, 'Task update failed')
  }
})

router.get('/projects/:projectId/activity', ...staffOnly, async (req, res) => {
  try {
    const project = await getProjectForUser(req.params.projectId, req.user)
    if (!project) return fail(res, 404, 'Project not found')
    const { data, error } = await supabase.from('project_activity').select('*').eq('project_id', project.id).order('created_at', { ascending: false }).limit(100)
    if (error) throw error
    return res.json({ data: data || [] })
  } catch (error) {
    return fail(res, 500, 'Unable to load project activity')
  }
})

module.exports = router
