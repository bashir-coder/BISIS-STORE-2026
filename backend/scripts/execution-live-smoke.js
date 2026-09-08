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

const label = `__EXECUTION_FIXTURE_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`
const fixture = { label, authUserIds: [], publicUserIds: [], workspaceIds: [], projectIds: [], templateId: null, templateMilestoneIds: [], templateTaskIds: [], milestoneIds: [], taskIds: [], activityIds: [] }
const result = { label, status: 'running', checks: {}, cleanup: { attempted: false, errors: [] } }

function redactedError(error) {
  if (!error) return null
  const raw = typeof error === 'string' ? error : JSON.stringify({ message: error.message, code: error.code, details: error.details, hint: error.hint, status: error.status })
  return raw.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email-redacted]').replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '[uuid-redacted]')
}

function record(name, pass, details = {}) {
  result.checks[name] = { pass, ...details }
  if (!pass) throw new Error(`CHECK_FAILED:${name}:${JSON.stringify(details)}`)
}

async function must(promise, step) {
  const response = await promise
  if (response.error) throw new Error(`${step}:${redactedError(response.error)}`)
  return response.data
}

async function api(method, url, token, body, expectedStatus) {
  const response = await request(app)[method](url).set('Authorization', `Bearer ${token}`).send(body || {})
  if (response.status !== expectedStatus) throw new Error(`API_${method.toUpperCase()}_${url}_EXPECTED_${expectedStatus}_GOT_${response.status}:${JSON.stringify(response.body)}`)
  return response
}

async function createAuthFixture(roleLabel) {
  const email = `execution-${roleLabel}-${Date.now()}-${crypto.randomBytes(2).toString('hex')}@example.test`
  const password = `E!xecution-${crypto.randomBytes(18).toString('base64url')}`
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `${label} ${roleLabel}` } })
  if (created.error) throw new Error(`AUTH_CREATE_${roleLabel}:${redactedError(created.error)}`)
  fixture.authUserIds.push(created.data.user.id)
  const profile = await admin.from('users').select('id,email,role,is_active').eq('id', created.data.user.id).single()
  if (profile.error) throw new Error(`PROFILE_READ_${roleLabel}:${redactedError(profile.error)}`)
  fixture.publicUserIds.push(profile.data.id)
  if (profile.data.id !== created.data.user.id || profile.data.email !== email || profile.data.role !== 'client') throw new Error(`PROFILE_VERIFY_${roleLabel}:trigger profile mismatch`)
  const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
  const signedIn = await client.auth.signInWithPassword({ email, password })
  if (signedIn.error) throw new Error(`AUTH_SIGN_IN_${roleLabel}:${redactedError(signedIn.error)}`)
  return { id: created.data.user.id, email, password, client, token: signedIn.data.session.access_token }
}

async function cleanup() {
  result.cleanup.attempted = true
  const pushCleanup = async (name, operation) => {
    try { await operation() } catch (error) { result.cleanup.errors.push({ name, error: redactedError(error) }) }
  }
  if (fixture.projectIds.length) {
    await pushCleanup('project_activity', () => admin.from('project_activity').delete().in('project_id', fixture.projectIds))
    await pushCleanup('project_tasks', () => admin.from('project_tasks').delete().in('project_id', fixture.projectIds))
    await pushCleanup('project_milestones', () => admin.from('project_milestones').delete().in('project_id', fixture.projectIds))
    await pushCleanup('projects', () => admin.from('projects').delete().in('id', fixture.projectIds))
  }
  if (fixture.templateId) {
    await pushCleanup('template_tasks', () => admin.from('project_template_tasks').delete().in('template_milestone_id', fixture.templateMilestoneIds))
    await pushCleanup('template_milestones', () => admin.from('project_template_milestones').delete().eq('template_id', fixture.templateId))
    await pushCleanup('template', () => admin.from('project_templates').delete().eq('id', fixture.templateId))
  }
  if (fixture.workspaceIds.length) {
    await pushCleanup('workspace_members', () => admin.from('workspace_members').delete().in('workspace_id', fixture.workspaceIds))
    await pushCleanup('workspaces', () => admin.from('workspaces').delete().in('id', fixture.workspaceIds))
  }
  if (fixture.publicUserIds.length) await pushCleanup('fixture_profiles', () => admin.from('users').delete().in('id', fixture.publicUserIds))
  for (const userId of fixture.authUserIds) await pushCleanup(`auth_user_${userId}`, async () => { const response = await admin.auth.admin.deleteUser(userId); if (response.error) throw response.error })
}

async function run() {
  const staff = await createAuthFixture('staff')
  const client = await createAuthFixture('client')
  result.checks.auth_trigger_profiles = { pass: true, staff: true, client: true, role: 'client', email_match: true, id_match: true }

  const staffProfile = await must(admin.from('users').update({ role: 'admin' }).eq('id', staff.id).select('id,role').single(), 'PROMOTE_STAFF')
  record('staff_role_promotion', staffProfile.role === 'admin', { role: staffProfile.role })

  const workspaceA = await must(admin.from('workspaces').insert([{ name: `${label} A`, description: 'Disposable execution fixture A' }]).select('id').single(), 'CREATE_WORKSPACE_A')
  const workspaceB = await must(admin.from('workspaces').insert([{ name: `${label} B`, description: 'Disposable execution isolation fixture B' }]).select('id').single(), 'CREATE_WORKSPACE_B')
  fixture.workspaceIds.push(workspaceA.id, workspaceB.id)
  await must(admin.from('workspace_members').insert([
    { workspace_id: workspaceA.id, user_id: staff.id, role: 'admin' },
    { workspace_id: workspaceA.id, user_id: client.id, role: 'client' },
  ]), 'CREATE_WORKSPACE_MEMBERS')
  await must(admin.from('users').update({ workspace_id: workspaceA.id }).in('id', [staff.id, client.id]), 'ASSIGN_ACTIVE_WORKSPACE')

  const projectA = await must(admin.from('projects').insert([{ workspace_id: workspaceA.id, created_by: staff.id, name: `${label} Project A`, description: 'Disposable execution fixture A', status: 'active' }]).select('id').single(), 'CREATE_PROJECT_A')
  const projectB = await must(admin.from('projects').insert([{ workspace_id: workspaceB.id, created_by: staff.id, name: `${label} Project B`, description: 'Disposable execution isolation fixture B', status: 'active' }]).select('id').single(), 'CREATE_PROJECT_B')
  fixture.projectIds.push(projectA.id, projectB.id)

  const templateResponse = await api('post', '/api/execution/templates', staff.token, {
    name: `${label} Template`, description: 'Disposable execution template', milestones: [{ title: `${label} Milestone`, description: 'Fixture milestone', tasks: [{ title: `${label} Client Task`, description: 'Fixture client-visible task', priority: 'high', client_visible: true }] }],
  }, 201)
  fixture.templateId = templateResponse.body.data.id
  record('staff_template_create', Boolean(fixture.templateId), { created: true })

  const templatesResponse = await api('get', '/api/execution/templates', staff.token, null, 200)
  record('staff_template_read', templatesResponse.body.data.some((item) => item.id === fixture.templateId), { visible: true })

  const applied = await api('post', `/api/execution/projects/${projectA.id}/apply-template`, staff.token, { template_id: fixture.templateId }, 201)
  fixture.milestoneIds.push(...applied.body.data.milestones.map((item) => item.id))
  fixture.taskIds.push(...applied.body.data.tasks.map((item) => item.id))
  record('apply_template', applied.body.data.milestones.length === 1 && applied.body.data.tasks.length === 1, { milestones: applied.body.data.milestones.length, tasks: applied.body.data.tasks.length })

  const conflict = await request(app).post(`/api/execution/projects/${projectA.id}/apply-template`).set('Authorization', `Bearer ${staff.token}`).send({ template_id: fixture.templateId })
  record('apply_template_idempotency_conflict', conflict.status === 409 && conflict.body.code === 'PROJECT_STRUCTURE_EXISTS', { status: conflict.status, code: conflict.body.code })

  const structure = await api('get', `/api/execution/projects/${projectA.id}/structure`, staff.token, null, 200)
  record('structure_read', structure.body.data.milestones.length === 1 && structure.body.data.tasks.length === 1 && structure.body.data.activity.length >= 1, { milestones: structure.body.data.milestones.length, tasks: structure.body.data.tasks.length, activity: structure.body.data.activity.length })

  const milestoneId = fixture.milestoneIds[0]
  const taskId = fixture.taskIds[0]
  const completedMilestone = await api('patch', `/api/execution/projects/${projectA.id}/milestones/${milestoneId}`, staff.token, { status: 'completed' }, 200)
  record('milestone_completion', completedMilestone.body.data.status === 'completed' && Boolean(completedMilestone.body.data.completed_at), { status: completedMilestone.body.data.status, completed_at: Boolean(completedMilestone.body.data.completed_at) })
  const completedTask = await api('patch', `/api/execution/projects/${projectA.id}/tasks/${taskId}`, staff.token, { status: 'done' }, 200)
  record('task_completion', completedTask.body.data.status === 'done' && Boolean(completedTask.body.data.completed_at), { status: completedTask.body.data.status, completed_at: Boolean(completedTask.body.data.completed_at) })

  const invalidMilestone = await request(app).post(`/api/execution/projects/${projectA.id}/tasks`).set('Authorization', `Bearer ${staff.token}`).send({ title: `${label} Invalid Link`, milestone_id: 999999999, priority: 'medium', status: 'todo' })
  record('invalid_milestone_rejection', invalidMilestone.status === 400, { status: invalidMilestone.status, message: invalidMilestone.body.message })

  const isolatedProjectResponse = await request(app).get(`/api/execution/projects/${projectB.id}/structure`).set('Authorization', `Bearer ${staff.token}`)
  record('staff_workspace_isolation_api', isolatedProjectResponse.status === 404, { status: isolatedProjectResponse.status })

  const clientExecutionResponse = await request(app).get(`/api/execution/projects/${projectA.id}/structure`).set('Authorization', `Bearer ${client.token}`)
  record('client_execution_route_denied', clientExecutionResponse.status === 403, { status: clientExecutionResponse.status })

  const clientTemplates = await must(client.client.from('project_templates').select('id').eq('id', fixture.templateId), 'CLIENT_TEMPLATE_RLS_READ')
  record('client_template_rls_denial', clientTemplates.length === 0, { rows: clientTemplates.length })

  const clientTasks = await must(client.client.from('project_tasks').select('id,project_id,client_visible').eq('project_id', projectA.id), 'CLIENT_TASK_RLS_READ')
  record('client_visible_task_rls', clientTasks.length === 1 && clientTasks[0].client_visible === true, { rows: clientTasks.length, visible_rows: clientTasks.filter((row) => row.client_visible).length })

  const clientMilestones = await must(client.client.from('project_milestones').select('id,project_id').eq('project_id', projectA.id), 'CLIENT_MILESTONE_RLS_READ')
  record('client_visible_milestone_rls', clientMilestones.length === 1, { rows: clientMilestones.length })

  const clientProjectBTasks = await must(client.client.from('project_tasks').select('id').eq('project_id', projectB.id), 'CLIENT_PROJECT_B_RLS_READ')
  record('client_project_isolation_rls', clientProjectBTasks.length === 0, { rows: clientProjectBTasks.length })

  const staffProjectBTasks = await must(staff.client.from('project_tasks').select('id').eq('project_id', projectB.id), 'STAFF_PROJECT_B_RLS_READ')
  record('staff_workspace_isolation_rls', staffProjectBTasks.length === 0, { rows: staffProjectBTasks.length })

  const clientInsert = await client.client.from('project_tasks').insert([{ project_id: projectA.id, title: `${label} Client Forbidden`, description: '', status: 'todo', priority: 'low', client_visible: false, created_by: client.id }]).select('id')
  record('client_task_insert_denied_rls', Boolean(clientInsert.error) && clientInsert.data === null, { denied: Boolean(clientInsert.error), code: clientInsert.error?.code || null })

  const visibleActivity = await must(staff.client.from('project_activity').insert([{ project_id: projectA.id, actor_id: staff.id, entity_type: 'project', entity_id: String(projectA.id), event_type: 'EXECUTION_CLIENT_VISIBLE_FIXTURE', visibility: 'client', payload: { fixture: label } }]).select('id').single(), 'STAFF_ACTIVITY_INSERT_RLS')
  fixture.activityIds.push(visibleActivity.id)
  const clientActivity = await must(client.client.from('project_activity').select('id,visibility').eq('project_id', projectA.id), 'CLIENT_ACTIVITY_RLS_READ')
  record('client_activity_visibility_rls', clientActivity.length === 1 && clientActivity[0].visibility === 'client', { rows: clientActivity.length, client_visible_rows: clientActivity.filter((row) => row.visibility === 'client').length })

  result.status = 'PASS'
}

run().catch((error) => {
  result.status = 'FAIL'
  result.failure = redactedError(error)
}).finally(async () => {
  await cleanup()
  result.cleanup.ok = result.cleanup.errors.length === 0
  const fs = require('fs')
  fs.writeFileSync(path.resolve(__dirname, '../../docs/execution-live-smoke-result.json'), `${JSON.stringify(result, null, 2)}\n`)
  if (result.status === 'PASS' && result.cleanup.ok) process.stdout.write('EXECUTION_LIVE_SMOKE_PASS\n')
  else { process.stderr.write(`EXECUTION_LIVE_SMOKE_${result.status}\n`); process.stderr.write(`${JSON.stringify(result.failure || result.cleanup.errors)}\n`); process.exitCode = 1 }
})
