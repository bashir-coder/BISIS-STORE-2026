const path = require('path')
const crypto = require('crypto')
const dotenv = require('dotenv')
const request = require('supertest')
const { createClient } = require('@supabase/supabase-js')

dotenv.config({ path: path.resolve(__dirname, '../../.env') })
const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.SUPABASE_ANON_KEY || serviceRoleKey
if (!supabaseUrl || !serviceRoleKey || !anonKey) throw new Error('Supabase test configuration is unavailable')
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
const app = require('../server')
const label = `__SERVICE_DELIVERY_FIXTURE_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`
const fixture = { label, authUserIds: [], publicUserIds: [], workspaceId: null, extraWorkspaceIds: [], orderIds: [], projectIds: [], extraProjectIds: [], templateIds: [], ticketIds: [], filePaths: [] }
const result = { label, status: 'running', checks: {}, cleanup: { attempted: false, errors: [] } }

const redact = (error) => {
  const value = error?.message || error?.details || error?.code || String(error)
  return String(value).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email-redacted]').replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '[uuid-redacted]')
}
const check = (name, pass, details = {}) => { result.checks[name] = { pass, ...details }; if (!pass) throw new Error(`CHECK_FAILED:${name}:${JSON.stringify(details)}`) }
const createClientSession = async (roleName) => {
  const email = `delivery-${roleName}-${Date.now()}-${crypto.randomBytes(2).toString('hex')}@example.test`
  const password = `D!elivery-${crypto.randomBytes(18).toString('base64url')}`
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `${label} ${roleName}` } })
  if (created.error) throw created.error
  fixture.authUserIds.push(created.data.user.id)
  const profile = await admin.from('users').select('id,email,role').eq('id', created.data.user.id).single()
  if (profile.error) throw profile.error
  fixture.publicUserIds.push(profile.data.id)
  check(`auth_profile_${roleName}`, profile.data.id === created.data.user.id && profile.data.email === email && profile.data.role === 'client', { id_match: profile.data.id === created.data.user.id, role: profile.data.role })
  const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
  const signedIn = await client.auth.signInWithPassword({ email, password })
  if (signedIn.error) throw signedIn.error
  return { id: created.data.user.id, email, client, token: signedIn.data.session.access_token }
}
const api = async (method, url, token, body, status) => {
  const response = await request(app)[method](url).set('Authorization', `Bearer ${token}`).send(body || {})
  if (response.status !== status) throw new Error(`API_${method}_${url}_EXPECTED_${status}_GOT_${response.status}:${JSON.stringify(response.body)}`)
  return response
}
const uploadOrderFile = async ({ orderId, token, fileKind, filename, contents }) => {
  const response = await request(app)
    .post(`/api/orders/${orderId}/upload`)
    .set('Authorization', `Bearer ${token}`)
    .field('file_kind', fileKind)
    .attach('file', Buffer.from(contents), { filename, contentType: 'application/pdf' })
  if (response.status !== 200) throw new Error(`UPLOAD_EXPECTED_200_GOT_${response.status}:${JSON.stringify(response.body)}`)
  if (!response.body.file?.id || !response.body.filePath) throw new Error(`UPLOAD_METADATA_MISSING:${JSON.stringify(response.body)}`)
  fixture.filePaths.push(response.body.filePath)
  return response.body.file
}
const cleanup = async () => {
  result.cleanup.attempted = true
  const run = async (name, operation) => { try { const response = await operation(); if (response?.error) throw response.error } catch (error) { result.cleanup.errors.push({ name, error: redact(error) }) } }
  if (fixture.projectIds.length) {
    await run('project_deliveries', () => admin.from('project_deliveries').delete().in('project_id', fixture.projectIds))
    await run('project_requirements', () => admin.from('project_requirements').delete().in('project_id', fixture.projectIds))
    await run('project_activity', () => admin.from('project_activity').delete().in('project_id', fixture.projectIds))
    await run('project_tasks', () => admin.from('project_tasks').delete().in('project_id', fixture.projectIds))
    await run('project_milestones', () => admin.from('project_milestones').delete().in('project_id', fixture.projectIds))
    await run('projects', () => admin.from('projects').delete().in('id', fixture.projectIds))
  }
  if (fixture.filePaths.length) await run('storage_files', () => admin.storage.from('order-files').remove(fixture.filePaths))
  if (fixture.orderIds.length) {
    await run('order_files', () => admin.from('order_files').delete().in('order_id', fixture.orderIds))
    await run('notifications', () => admin.from('notifications').delete().in('order_id', fixture.orderIds))
    await run('orders', () => admin.from('orders').delete().in('id', fixture.orderIds))
  }
  if (fixture.ticketIds.length) await run('tickets', () => admin.from('tickets').delete().in('id', fixture.ticketIds))
  for (const templateId of fixture.templateIds) {
    const milestoneRows = await admin.from('project_template_milestones').select('id').eq('template_id', templateId)
    if (milestoneRows.error) result.cleanup.errors.push({ name: 'template_milestone_lookup', error: redact(milestoneRows.error) })
    const milestoneIds = (milestoneRows.data || []).map((row) => row.id)
    if (milestoneIds.length) await run('template_tasks', () => admin.from('project_template_tasks').delete().in('template_milestone_id', milestoneIds))
    await run('template_milestones', () => admin.from('project_template_milestones').delete().eq('template_id', templateId))
    await run('template', () => admin.from('project_templates').delete().eq('id', templateId))
  }
  if (fixture.extraProjectIds.length) await run('extra_projects', () => admin.from('projects').delete().in('id', fixture.extraProjectIds))
  if (fixture.extraWorkspaceIds.length) await run('extra_workspaces', () => admin.from('workspaces').delete().in('id', fixture.extraWorkspaceIds))
  if (fixture.workspaceId) {
    await run('workspace_members', () => admin.from('workspace_members').delete().eq('workspace_id', fixture.workspaceId))
    await run('workspace', () => admin.from('workspaces').delete().eq('id', fixture.workspaceId))
  }
  if (fixture.publicUserIds.length) await run('profiles', () => admin.from('users').delete().in('id', fixture.publicUserIds))
  for (const id of fixture.authUserIds) await run(`auth_${id}`, async () => { const response = await admin.auth.admin.deleteUser(id); if (response.error) throw response.error })
}

async function run() {
  const staff = await createClientSession('staff')
  const clientA = await createClientSession('client-a')
  const clientB = await createClientSession('client-b')
  const promote = await admin.from('users').update({ role: 'admin' }).eq('id', staff.id).select('id,role').single()
  if (promote.error) throw promote.error
  check('staff_promotion', promote.data.role === 'admin', { role: promote.data.role })

  const workspace = await admin.from('workspaces').insert([{ name: label, description: 'Disposable service delivery smoke fixture' }]).select('id').single()
  if (workspace.error) throw workspace.error
  fixture.workspaceId = workspace.data.id
  const members = await admin.from('workspace_members').insert([
    { workspace_id: fixture.workspaceId, user_id: staff.id, role: 'admin' },
    { workspace_id: fixture.workspaceId, user_id: clientA.id, role: 'client' },
    { workspace_id: fixture.workspaceId, user_id: clientB.id, role: 'client' },
  ])
  if (members.error) throw members.error
  const usersWorkspace = await admin.from('users').update({ workspace_id: fixture.workspaceId }).in('id', [staff.id, clientA.id, clientB.id])
  if (usersWorkspace.error) throw usersWorkspace.error

  const clientTemplateList = await request(app).get('/api/execution/templates').set('Authorization', `Bearer ${clientA.token}`)
  check('client_template_admin_denied', clientTemplateList.status === 403, { status: clientTemplateList.status })
  await api('post', '/api/execution/templates', staff.token, { name: '', milestones: [] }, 400)
  const template = await api('post', '/api/execution/templates', staff.token, {
    name: `${label} Template`, description: 'Disposable delivery template', service_id: null,
    milestones: [{ title: `${label} Intake`, description: 'Client intake', tasks: [{ title: `${label} Execution`, description: 'Visible execution step', priority: 'high', client_visible: true }] }],
  }, 201)
  const sourceTemplateId = template.body.data.id
  fixture.templateIds.push(sourceTemplateId)
  const listedTemplates = await api('get', '/api/execution/templates?include_archived=true', staff.token, null, 200)
  const listedSource = listedTemplates.body.data.find((item) => item.id === sourceTemplateId)
  check('template_list_with_structure', listedSource?.project_template_milestones?.length === 1 && listedSource.project_template_milestones[0].project_template_tasks?.length === 1, { milestones: listedSource?.project_template_milestones?.length || 0, tasks: listedSource?.project_template_milestones?.[0]?.project_template_tasks?.length || 0 })
  const updatedTemplate = await api('patch', `/api/execution/templates/${sourceTemplateId}`, staff.token, { description: 'Updated template metadata.' }, 200)
  check('template_edit', updatedTemplate.body.data.description === 'Updated template metadata.', { description: updatedTemplate.body.data.description })
  const duplicatedTemplate = await api('post', `/api/execution/templates/${sourceTemplateId}/duplicate`, staff.token, { name: `${label} Duplicate` }, 201)
  const duplicateTemplateId = duplicatedTemplate.body.data.id
  fixture.templateIds.push(duplicateTemplateId)
  check('template_duplicate_structure', duplicatedTemplate.body.data.project_template_milestones?.length === 1 && duplicatedTemplate.body.data.project_template_milestones[0].project_template_tasks?.length === 1, { milestones: duplicatedTemplate.body.data.project_template_milestones?.length || 0, tasks: duplicatedTemplate.body.data.project_template_milestones?.[0]?.project_template_tasks?.length || 0 })
  const duplicateMilestone = await api('post', `/api/execution/templates/${duplicateTemplateId}/milestones`, staff.token, { title: `${label} Second milestone`, description: 'Second milestone' }, 201)
  const duplicateTask = await api('post', `/api/execution/templates/${duplicateTemplateId}/milestones/${duplicateMilestone.body.data.id}/tasks`, staff.token, { title: `${label} Second task`, priority: 'low', client_visible: true }, 201)
  const editedMilestone = await api('patch', `/api/execution/templates/${duplicateTemplateId}/milestones/${duplicateMilestone.body.data.id}`, staff.token, { title: `${label} Edited milestone` }, 200)
  const editedTask = await api('patch', `/api/execution/templates/${duplicateTemplateId}/milestones/${duplicateMilestone.body.data.id}/tasks/${duplicateTask.body.data.id}`, staff.token, { title: `${label} Edited task`, priority: 'urgent' }, 200)
  check('template_nested_crud', editedMilestone.body.data.title.endsWith('Edited milestone') && editedTask.body.data.priority === 'urgent', { milestone: editedMilestone.body.data.title, priority: editedTask.body.data.priority })
  await api('delete', `/api/execution/templates/${duplicateTemplateId}/milestones/${duplicateMilestone.body.data.id}/tasks/${duplicateTask.body.data.id}`, staff.token, null, 200)
  await api('delete', `/api/execution/templates/${duplicateTemplateId}/milestones/${duplicateMilestone.body.data.id}`, staff.token, null, 200)
  const archived = await api('delete', `/api/execution/templates/${duplicateTemplateId}`, staff.token, null, 200)
  check('template_archive', archived.body.data.is_active === false, { is_active: archived.body.data.is_active })
  const restored = await api('patch', `/api/execution/templates/${duplicateTemplateId}`, staff.token, { is_active: true }, 200)
  check('template_restore', restored.body.data.is_active === true, { is_active: restored.body.data.is_active })

  const orders = await admin.from('orders').insert([
    { full_name: `${label} A`, email: clientA.email, service: 'Smoke Service', package: 'Smoke Package', status: 'processing', payment_status: 'verified', amount: 10, price: 10, user_id: clientA.id, workspace_id: fixture.workspaceId },
    { full_name: `${label} B`, email: clientB.email, service: 'Smoke Service', package: 'Smoke Package', status: 'processing', payment_status: 'verified', amount: 10, price: 10, user_id: clientB.id, workspace_id: fixture.workspaceId },
  ]).select('id,user_id')
  if (orders.error) throw orders.error
  fixture.orderIds.push(...orders.data.map((order) => order.id))

  const requirements = [{ title: `${label} Brand brief`, description: 'Provide the brief for the service.', requirement_type: 'text', is_required: true, client_visible: true }, { title: `${label} Brand file`, description: 'Upload a file for the service.', requirement_type: 'file', is_required: true, client_visible: true }]
  const initializedA = await api('post', `/api/service-delivery/orders/${fixture.orderIds[0]}/initialize`, staff.token, { template_id: sourceTemplateId, requirements }, 201)
  const initializedB = await api('post', `/api/service-delivery/orders/${fixture.orderIds[1]}/initialize`, staff.token, { template_id: sourceTemplateId, requirements }, 201)
  const projectA = initializedA.body.data.project.id
  const projectB = initializedB.body.data.project.id
  fixture.projectIds.push(projectA, projectB)
  check('project_initialization_contract', initializedA.body.data.initialization_status === 'initialized' && initializedA.body.data.idempotency_key === `order:${fixture.orderIds[0]}:project-init`, { status: initializedA.body.data.initialization_status })
  const initializedAgain = await api('post', `/api/service-delivery/orders/${fixture.orderIds[0]}/initialize`, staff.token, { template_id: sourceTemplateId }, 200)
  check('project_initialization_idempotent', initializedAgain.body.data.idempotent === true && initializedAgain.body.data.project_id === projectA && initializedAgain.body.data.idempotency_key === `order:${fixture.orderIds[0]}:project-init`, { idempotent: initializedAgain.body.data.idempotent })
  const client360Denied = await api('get', `/api/service-delivery/clients/${clientA.id}/overview`, clientA.token, null, 403)
  check('client360_client_denied', client360Denied.status === 403, { status: client360Denied.status })
  const projectTicket = await api('post', '/api/tickets', clientA.token, { title: `${label} project support`, description: 'Support context fixture.', project_id: projectA }, 201)
  fixture.ticketIds.push(projectTicket.body.id)
  check('project_ticket_create', projectTicket.body.project_id === projectA && projectTicket.body.user_id === clientA.id, { project_id: projectTicket.body.project_id })
  const clientATickets = await api('get', `/api/tickets/my?project_id=${projectA}`, clientA.token, null, 200)
  check('project_ticket_client_read', clientATickets.body.some((ticket) => ticket.id === projectTicket.body.id && ticket.project_id === projectA), { tickets: clientATickets.body.length })
  const staffTickets = await api('get', `/api/tickets?project_id=${projectA}`, staff.token, null, 200)
  check('project_ticket_staff_read', staffTickets.body.some((ticket) => ticket.id === projectTicket.body.id), { tickets: staffTickets.body.length })
  const client360Overview = await api('get', `/api/service-delivery/clients/${clientA.id}/overview`, staff.token, null, 200)
  const overviewProjectIds = (client360Overview.body.data?.projects || []).map((project) => project.id)
  check('client360_batched_overview', Boolean(overviewProjectIds.includes(projectA) && !overviewProjectIds.includes(projectB) && client360Overview.body.data?.projects?.[0]?.requirements && client360Overview.body.data?.projects?.[0]?.files && client360Overview.body.data?.projects?.[0]?.activity), { projects: overviewProjectIds.length, includes_own_project: overviewProjectIds.includes(projectA), excludes_other_client: !overviewProjectIds.includes(projectB), includes_files: Boolean(client360Overview.body.data?.projects?.[0]?.files), includes_activity: Boolean(client360Overview.body.data?.projects?.[0]?.activity) })
  const staffTicketUpdate = await api('patch', `/api/tickets/${projectTicket.body.id}`, staff.token, { status: 'in_progress', admin_response: 'Acknowledged in smoke.' }, 200)
  check('project_ticket_staff_update', staffTicketUpdate.body.status === 'in_progress' && staffTicketUpdate.body.admin_response === 'Acknowledged in smoke.', { status: staffTicketUpdate.body.status })
  const crossProjectTicket = await request(app).post('/api/tickets').set('Authorization', `Bearer ${clientB.token}`).send({ title: `${label} invalid cross ticket`, description: 'Should be rejected.', project_id: projectA })
  check('project_ticket_cross_create_denied', crossProjectTicket.status === 404, { status: crossProjectTicket.status })
  const clientBCrossRead = await clientB.client.from('tickets').select('id').eq('id', projectTicket.body.id)
  check('project_ticket_cross_rls_isolation', !clientBCrossRead.error && clientBCrossRead.data.length === 0, { rows: clientBCrossRead.data?.length || 0 })
  const externalWorkspace = await admin.from('workspaces').insert([{ name: `${label} External Workspace`, description: 'Disposable unauthorized workspace fixture' }]).select('id').single()
  if (externalWorkspace.error) throw externalWorkspace.error
  fixture.extraWorkspaceIds.push(externalWorkspace.data.id)
  const externalProject = await admin.from('projects').insert([{ workspace_id: externalWorkspace.data.id, created_by: staff.id, name: `${label} External Project`, description: 'Disposable unauthorized project fixture', status: 'active' }]).select('id').single()
  if (externalProject.error) throw externalProject.error
  fixture.extraProjectIds.push(externalProject.data.id)
  const externalTicket = await admin.from('tickets').insert([{ user_id: clientB.id, workspace_id: externalWorkspace.data.id, project_id: externalProject.data.id, title: `${label} external ticket`, description: 'External workspace ticket fixture.', status: 'open' }]).select('id').single()
  if (externalTicket.error) throw externalTicket.error
  fixture.ticketIds.push(externalTicket.data.id)
  const staffExternalTickets = await api('get', `/api/tickets?project_id=${externalProject.data.id}`, staff.token, null, 200)
  const staffDirectExternalTickets = await staff.client.from('tickets').select('id').eq('id', externalTicket.data.id)
  check('ticket_external_workspace_isolation', staffExternalTickets.body.length === 0 && !staffDirectExternalTickets.error && staffDirectExternalTickets.data.length === 0, { api_rows: staffExternalTickets.body.length, direct_rows: staffDirectExternalTickets.data?.length || 0 })
  check('project_initialization', initializedA.body.data.milestones.length === 1 && initializedA.body.data.tasks.length === 1 && initializedA.body.data.requirements.length === 2, { milestones: initializedA.body.data.milestones.length, tasks: initializedA.body.data.tasks.length, requirements: initializedA.body.data.requirements.length })
  const queue = await api('get', '/api/service-delivery/operations/queue', staff.token, null, 200)
  const queuedProject = queue.body.data.find((project) => project.id === projectA)
  check('operations_queue_state', queuedProject?.execution_state === 'waiting_on_client' && queuedProject.pending_requirements === 2, { state: queuedProject?.execution_state, pending_requirements: queuedProject?.pending_requirements })
  const staffOwnProject = await staff.client.from('projects').select('id').eq('id', projectA)
  const staffOwnTasks = await staff.client.from('project_tasks').select('id').eq('project_id', projectA)
  const staffExternalProject = await staff.client.from('projects').select('id').eq('id', fixture.extraProjectIds[0])
  check('staff_authorized_project_access', !staffOwnProject.error && staffOwnProject.data.length === 1 && !staffOwnTasks.error && staffOwnTasks.data.length === 1, { project_rows: staffOwnProject.data?.length || 0, task_rows: staffOwnTasks.data?.length || 0 })
  check('staff_unauthorized_workspace_denied', !staffExternalProject.error && staffExternalProject.data.length === 0, { rows: staffExternalProject.data?.length || 0 })

  const idempotent = await api('post', `/api/service-delivery/orders/${fixture.orderIds[0]}/initialize`, staff.token, { template_id: sourceTemplateId }, 200)
  check('project_initialization_idempotency', idempotent.body.data.idempotent === true && idempotent.body.data.project_id === projectA, { idempotent: idempotent.body.data.idempotent })

  const clientView = await api('get', `/api/service-delivery/projects/${projectA}/client-view`, clientA.token, null, 200)
  check('client_project_projection', clientView.body.data.id === projectA && clientView.body.data.requirements.length === 2 && clientView.body.data.tasks.length === 1, { requirements: clientView.body.data.requirements.length, tasks: clientView.body.data.tasks.length })
  const ownProject = await clientA.client.from('projects').select('id').eq('id', projectA)
  const ownMilestones = await clientA.client.from('project_milestones').select('id').eq('project_id', projectA)
  const ownTasks = await clientA.client.from('project_tasks').select('id,client_visible').eq('project_id', projectA)
  check('client_own_rls_visible', !ownProject.error && ownProject.data.length === 1 && !ownMilestones.error && ownMilestones.data.length === 1 && !ownTasks.error && ownTasks.data.length === 1 && ownTasks.data[0].client_visible === true, { project_rows: ownProject.data?.length || 0, milestone_rows: ownMilestones.data?.length || 0, task_rows: ownTasks.data?.length || 0 })
  const clientHome = await api('get', '/api/service-delivery/client/home', clientA.token, null, 200)
  check('client_home_projection', clientHome.body.data.projects.some((project) => project.id === projectA), { projects: clientHome.body.data.projects.length, actions: clientHome.body.data.actions.length })

  const idorView = await request(app).get(`/api/service-delivery/projects/${projectB}/client-view`).set('Authorization', `Bearer ${clientA.token}`)
  check('client_project_idor_denied', idorView.status === 404, { status: idorView.status })
  const clientBOwnedProjects = await clientA.client.from('projects').select('id').eq('id', projectB)
  const clientBMilestones = await clientA.client.from('project_milestones').select('id').eq('project_id', projectB)
  const clientBRequirements = await clientA.client.from('project_requirements').select('id').eq('project_id', projectB)
  const clientBTasks = await clientA.client.from('project_tasks').select('id').eq('project_id', projectB)
  const clientBActivity = await clientA.client.from('project_activity').select('id').eq('project_id', projectB)
  check('client_cross_project_rls_isolation', !clientBOwnedProjects.error && !clientBMilestones.error && !clientBRequirements.error && !clientBTasks.error && !clientBActivity.error && clientBOwnedProjects.data.length === 0 && clientBMilestones.data.length === 0 && clientBRequirements.data.length === 0 && clientBTasks.data.length === 0 && clientBActivity.data.length === 0, { projects: clientBOwnedProjects.data?.length || 0, milestones: clientBMilestones.data?.length || 0, requirements: clientBRequirements.data?.length || 0, tasks: clientBTasks.data?.length || 0, activity: clientBActivity.data?.length || 0 })
  const inverseProjects = await clientB.client.from('projects').select('id').eq('id', projectA)
  const inverseMilestones = await clientB.client.from('project_milestones').select('id').eq('project_id', projectA)
  const inverseRequirements = await clientB.client.from('project_requirements').select('id').eq('project_id', projectA)
  const inverseTasks = await clientB.client.from('project_tasks').select('id').eq('project_id', projectA)
  const inverseActivity = await clientB.client.from('project_activity').select('id').eq('project_id', projectA)
  check('client_inverse_project_rls_isolation', !inverseProjects.error && !inverseMilestones.error && !inverseRequirements.error && !inverseTasks.error && !inverseActivity.error && inverseProjects.data.length === 0 && inverseMilestones.data.length === 0 && inverseRequirements.data.length === 0 && inverseTasks.data.length === 0 && inverseActivity.data.length === 0, { projects: inverseProjects.data?.length || 0, milestones: inverseMilestones.data?.length || 0, requirements: inverseRequirements.data?.length || 0, tasks: inverseTasks.data?.length || 0, activity: inverseActivity.data?.length || 0 })
  check('client_tasks_activity_rls_isolation', !clientBTasks.error && !clientBActivity.error && clientBTasks.data.length === 0 && clientBActivity.data.length === 0, { tasks: clientBTasks.data?.length || 0, activity: clientBActivity.data?.length || 0 })

  const requirementId = initializedA.body.data.requirements[0].id
  const submitted = await api('patch', `/api/service-delivery/projects/${projectA}/requirements/${requirementId}`, clientA.token, { response_value: 'Real client brief submitted for smoke test.' }, 200)
  check('client_requirement_submit', submitted.body.data.status === 'submitted', { status: submitted.body.data.status })
  const ownActivity = await clientA.client.from('project_activity').select('id,visibility').eq('project_id', projectA)
  check('client_own_activity_visibility', !ownActivity.error && ownActivity.data.length > 0 && ownActivity.data.every((item) => item.visibility === 'client'), { rows: ownActivity.data?.length || 0, all_client_visible: ownActivity.data?.every((item) => item.visibility === 'client') })
  const clientInputFile = await uploadOrderFile({ orderId: fixture.orderIds[0], token: clientA.token, fileKind: 'internal', filename: `${label}-client-input.pdf`, contents: 'client input fixture' })
  check('client_file_kind_forced_safe', clientInputFile.file_kind === 'customer_input', { file_kind: clientInputFile.file_kind })
  const fileRequirement = await api('patch', `/api/service-delivery/projects/${projectA}/requirements/${initializedA.body.data.requirements[1].id}`, clientA.token, { response_value: 'client-input.txt', file_id: clientInputFile.id }, 200)
  check('file_requirement_submit', fileRequirement.body.data.status === 'submitted' && fileRequirement.body.data.file_id === clientInputFile.id, { status: fileRequirement.body.data.status, file_id: fileRequirement.body.data.file_id })
  const afterRequirement = await api('get', `/api/service-delivery/projects/${projectA}/client-view`, clientA.token, null, 200)
  check('state_after_requirement', afterRequirement.body.data.execution_state !== 'waiting_on_client', { state: afterRequirement.body.data.execution_state })

  const taskId = initializedA.body.data.tasks[0].id
  const milestoneId = initializedA.body.data.milestones[0].id
  const clientTaskInsert = await clientA.client.from('project_tasks').insert([{ project_id: projectA, milestone_id: milestoneId, title: `${label} unauthorized task`, description: '', status: 'todo', priority: 'low', client_visible: true, created_by: clientA.id }]).select('id')
  const clientTaskUpdate = await clientA.client.from('project_tasks').update({ title: `${label} unauthorized update` }).eq('id', taskId).select('id')
  const clientTaskDelete = await clientA.client.from('project_tasks').delete().eq('id', taskId).select('id')
  const clientMilestoneUpdate = await clientA.client.from('project_milestones').update({ status: 'completed' }).eq('id', milestoneId).select('id')
  const clientActivityInsert = await clientA.client.from('project_activity').insert([{ project_id: projectA, actor_id: clientA.id, entity_type: 'project', event_type: 'CLIENT_UNAUTHORIZED_ACTIVITY', visibility: 'internal', payload: {} }]).select('id')
  const unchangedTask = await admin.from('project_tasks').select('id,title,status').eq('id', taskId).single()
  const unchangedMilestone = await admin.from('project_milestones').select('id,status').eq('id', milestoneId).single()
  check('client_write_denied', Boolean(clientTaskInsert.error) && (Boolean(clientTaskUpdate.error) || (clientTaskUpdate.data || []).length === 0) && (Boolean(clientTaskDelete.error) || (clientTaskDelete.data || []).length === 0) && (Boolean(clientMilestoneUpdate.error) || (clientMilestoneUpdate.data || []).length === 0) && Boolean(clientActivityInsert.error) && !unchangedTask.error && !unchangedMilestone.error && unchangedTask.data.status === 'todo' && unchangedMilestone.data.status === 'not_started', { insert_denied: Boolean(clientTaskInsert.error), update_rows: clientTaskUpdate.data?.length || 0, delete_rows: clientTaskDelete.data?.length || 0, milestone_update_rows: clientMilestoneUpdate.data?.length || 0, activity_denied: Boolean(clientActivityInsert.error), task_unchanged: unchangedTask.data?.status === 'todo', milestone_unchanged: unchangedMilestone.data?.status === 'not_started' })
  const doneTask = await api('patch', `/api/execution/projects/${projectA}/tasks/${taskId}`, staff.token, { status: 'done' }, 200)
  check('task_completion_state', doneTask.body.data.status === 'done', { status: doneTask.body.data.status })

  const prepared = await api('post', `/api/service-delivery/projects/${projectA}/delivery/prepare`, staff.token, { notes: 'Smoke delivery notes.' }, 200)
  check('delivery_prepare', prepared.body.data.status === 'prepared', { status: prepared.body.data.status })
  const deliveryFile = await uploadOrderFile({ orderId: fixture.orderIds[0], token: staff.token, fileKind: 'delivery', filename: `${label}-delivery.pdf`, contents: 'delivery fixture' })
  check('staff_delivery_file_kind', deliveryFile.file_kind === 'delivery', { file_kind: deliveryFile.file_kind })
  const sent = await api('post', `/api/service-delivery/projects/${projectA}/delivery/send`, staff.token, {}, 200)
  check('delivery_send', sent.body.data.status === 'client_review', { status: sent.body.data.status })
  const review = await api('get', `/api/service-delivery/projects/${projectA}/client-view`, clientA.token, null, 200)
  check('client_review_visible', review.body.data.delivery.status === 'client_review' && review.body.data.execution_state === 'waiting_on_review' && review.body.data.delivery_files.length === 1, { delivery: review.body.data.delivery.status, state: review.body.data.execution_state, files: review.body.data.delivery_files.length })
  const approved = await api('post', `/api/service-delivery/projects/${projectA}/delivery/approve`, clientA.token, {}, 200)
  check('client_approval_completion', approved.body.data.status === 'completed', { status: approved.body.data.status })
  const completed = await api('get', `/api/service-delivery/projects/${projectA}/client-view`, clientA.token, null, 200)
  check('project_completed_state', completed.body.data.execution_state === 'completed', { state: completed.body.data.execution_state })
  const clientDeliveryB = await clientA.client.from('project_deliveries').select('id').eq('project_id', projectB)
  check('client_delivery_rls_isolation', !clientDeliveryB.error && clientDeliveryB.data.length === 0, { rows: clientDeliveryB.data?.length || 0 })
  const clientHomeAfterDelivery = await api('get', '/api/service-delivery/client/home', clientA.token, null, 200)
  check('client_delivery_notification', clientHomeAfterDelivery.body.data.notifications.length > 0, { notifications: clientHomeAfterDelivery.body.data.notifications.length })
  const notificationList = await api('get', '/api/orders/notifications', clientA.token, null, 200)
  check('notification_project_context', notificationList.body.some((notification) => notification.project_id === projectA), { notifications: notificationList.body.length, project_context: notificationList.body.filter((notification) => notification.project_id === projectA).length })
  const markedAll = await api('patch', '/api/orders/notifications/read-all', clientA.token, null, 200)
  check('notification_mark_all_read', Number(markedAll.body.updated) >= 1, { updated: markedAll.body.updated })

  const requirementB = initializedB.body.data.requirements[0].id
  await api('patch', `/api/service-delivery/projects/${projectB}/requirements/${requirementB}`, clientB.token, { response_value: 'Client B brief.' }, 200)
  const clientBFile = await uploadOrderFile({ orderId: fixture.orderIds[1], token: clientB.token, fileKind: 'delivery', filename: `${label}-client-b.pdf`, contents: 'client B fixture' })
  check('client_file_kind_forced_safe_b', clientBFile.file_kind === 'customer_input', { file_kind: clientBFile.file_kind })
  await api('patch', `/api/service-delivery/projects/${projectB}/requirements/${initializedB.body.data.requirements[1].id}`, clientB.token, { response_value: 'client-b.txt', file_id: clientBFile.id }, 200)
  await api('patch', `/api/execution/projects/${projectB}/tasks/${initializedB.body.data.tasks[0].id}`, staff.token, { status: 'done' }, 200)
  await api('post', `/api/service-delivery/projects/${projectB}/delivery/prepare`, staff.token, { notes: 'Revision fixture delivery.' }, 200)
  await api('post', `/api/service-delivery/projects/${projectB}/delivery/send`, staff.token, {}, 200)
  const revision = await api('post', `/api/service-delivery/projects/${projectB}/delivery/revision`, clientB.token, { reason: 'Please adjust the fixture delivery.' }, 200)
  check('delivery_revision_request', revision.body.data.status === 'revision_requested' && revision.body.data.revision_count === 1, { status: revision.body.data.status, revision_count: revision.body.data.revision_count })
  await api('post', `/api/service-delivery/projects/${projectB}/delivery/prepare`, staff.token, { notes: 'Revised fixture delivery.' }, 200)
  await api('post', `/api/service-delivery/projects/${projectB}/delivery/send`, staff.token, {}, 200)
  const revisionApproved = await api('post', `/api/service-delivery/projects/${projectB}/delivery/approve`, clientB.token, {}, 200)
  check('delivery_revision_completion', revisionApproved.body.data.status === 'completed', { status: revisionApproved.body.data.status })
  result.status = 'PASS'
}

run().catch((error) => { result.status = 'FAIL'; result.failure = redact(error) }).finally(async () => {
  await cleanup()
  result.cleanup.ok = result.cleanup.errors.length === 0
  const fs = require('fs')
  fs.writeFileSync(path.resolve(__dirname, '../../docs/service-delivery-live-smoke-result.json'), `${JSON.stringify(result, null, 2)}\n`)
  if (result.status === 'PASS' && result.cleanup.ok) process.stdout.write('SERVICE_DELIVERY_LIVE_SMOKE_PASS\n')
  else { process.stderr.write(`SERVICE_DELIVERY_LIVE_SMOKE_${result.status}\n${JSON.stringify(result.failure || result.cleanup.errors)}\n`); process.exitCode = 1 }
})
