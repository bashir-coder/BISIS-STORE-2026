const fs = require('fs')
const path = require('path')
const http = require('http')
const crypto = require('crypto')
const WebSocket = require('ws')
const request = require('supertest')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })

const baseUrl = process.env.BROWSER_QA_BASE_URL || 'http://localhost:3000'
const cdpUrl = process.env.BROWSER_QA_CDP_URL || 'http://127.0.0.1:9224'
const screenshotDir = path.resolve(__dirname, '../../docs/evidence/browser-e2e-2026-08-25')
const viewportWidth = Number(process.env.BROWSER_QA_WIDTH || 1280)
const viewportHeight = Number(process.env.BROWSER_QA_HEIGHT || 941)
const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.SUPABASE_ANON_KEY || serviceRoleKey
if (!supabaseUrl || !serviceRoleKey || !anonKey) throw new Error('Supabase test configuration is unavailable')

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
const app = require('../server')
const label = `__BROWSER_WORKFLOW_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`
const fixture = { authUserIds: [], publicUserIds: [], workspaceId: null, externalWorkspaceId: null, projectIds: [], externalProjectIds: [], orderIds: [], templateIds: [], filePaths: [] }
const result = { status: 'running', label: '[redacted]', checks: {}, screenshots: [], cleanup: { attempted: false, errors: [] } }

const redact = (value) => String(value?.message || value?.details || value?.code || value).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email-redacted]').replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '[uuid-redacted]')
const check = (name, pass, details = {}) => { result.checks[name] = { pass: Boolean(pass), ...details }; if (!pass) throw new Error(`CHECK_FAILED:${name}:${JSON.stringify(details)}`) }
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function requestJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let body = ''
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => { try { resolve({ statusCode: res.statusCode, body: JSON.parse(body) }) } catch { reject(new Error(`Invalid JSON from ${url}`)) } })
    })
    req.on('error', reject)
    req.end()
  })
}

async function cdpWs() {
  const targets = await requestJson(`${cdpUrl}/json/list`)
  const target = targets.body.find((item) => item.type === 'page') || targets.body[0]
  if (!target?.webSocketDebuggerUrl) throw new Error('No Chromium CDP page target available')
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject) })
  let nextId = 1
  const pending = new Map()
  socket.on('message', (raw) => {
    const message = JSON.parse(raw.toString())
    if (!message.id || !pending.has(message.id)) return
    const entry = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) entry.reject(new Error(message.error.message))
    else entry.resolve(message.result)
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
  return { socket, send }
}

async function evaluate(send, expression, awaitPromise = true) {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise })
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text || 'Browser evaluation failed')
  return response.result?.value
}

async function waitFor(send, expression, timeoutMs = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const value = await evaluate(send, expression)
    if (value) return value
    await sleep(250)
  }
  throw new Error(`Timed out waiting for browser condition: ${expression}`)
}

async function screenshot(send, name) {
  fs.mkdirSync(screenshotDir, { recursive: true })
  const captured = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  fs.writeFileSync(path.join(screenshotDir, name), Buffer.from(captured.data, 'base64'))
  result.screenshots.push(`docs/evidence/browser-e2e-2026-08-25/${name}`)
}

async function navigate(send, pathname, condition, checkName) {
  await send('Page.navigate', { url: `${baseUrl}${pathname}` })
  await waitFor(send, `document.readyState === 'complete'`, 20000)
  const value = await waitFor(send, condition, 25000)
  check(checkName, Boolean(value), { path: pathname })
}

async function resetBrowserSession(send) {
  await send('Network.clearBrowserCookies')
  await send('Storage.clearDataForOrigin', { origin: baseUrl, storageTypes: 'all' }).catch(() => {})
  await send('Page.navigate', { url: `${baseUrl}/login` })
  await waitFor(send, `document.readyState === 'complete'`, 15000)
}

async function browserLogin(send, email, password, name) {
  await resetBrowserSession(send)
  await waitFor(send, `Boolean(document.querySelector('input[type="email"]') && document.querySelector('input[type="password"]'))`, 15000)
  const filled = await evaluate(send, `(() => { const emailInput = document.querySelector('input[type="email"]'); const passwordInput = document.querySelector('input[type="password"]'); const form = document.querySelector('form'); if (!emailInput || !passwordInput || !form) return false; const setValue = (element, value) => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true })); }; setValue(emailInput, ${JSON.stringify(email)}); setValue(passwordInput, ${JSON.stringify(password)}); form.querySelector('button[type="submit"]')?.click(); return true })()`)
  check(`${name}_login_form_submitted`, filled === true)
  await waitFor(send, `location.pathname === '/dashboard'`, 25000)
  await waitFor(send, `document.documentElement.getAttribute('dir') === 'rtl' && !document.querySelector('input[type="email"]')`, 20000)
  check(`${name}_authenticated_redirect`, true, { path: '/dashboard', direction: await evaluate(send, `document.documentElement.getAttribute('dir')`) })
}

async function createUser(kind, role = 'client') {
  const email = `browser-workflow-${kind}-${Date.now()}-${crypto.randomBytes(2).toString('hex')}@example.invalid`
  const password = `B!${crypto.randomBytes(24).toString('base64url')}`
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `${label} ${kind}` } })
  if (created.error || !created.data?.user) throw created.error || new Error(`Unable to create ${kind}`)
  const id = created.data.user.id
  fixture.authUserIds.push(id)
  const persona = await admin.from('personas').select('id').limit(1).single()
  if (persona.error || !persona.data?.id) throw persona.error || new Error('No persona available')
  const profile = await admin.from('users').update({ role, persona_id: persona.data.id }).eq('id', id).select('id,email,role').single()
  if (profile.error) throw profile.error
  fixture.publicUserIds.push(id)
  if (profile.data.id !== id || profile.data.email !== email || profile.data.role !== role) throw new Error(`Profile provisioning mismatch for ${kind}`)
  const client = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const signedIn = await client.auth.signInWithPassword({ email, password })
  if (signedIn.error || !signedIn.data.session) throw signedIn.error || new Error(`Unable to sign in ${kind}`)
  return { id, email, password, token: signedIn.data.session.access_token }
}

async function api(method, url, token, body, expectedStatus) {
  const response = await request(app)[method](url).set('Authorization', `Bearer ${token}`).send(body || {})
  if (response.status !== expectedStatus) throw new Error(`API ${method.toUpperCase()} ${url}: expected ${expectedStatus}, got ${response.status}: ${JSON.stringify(response.body)}`)
  return response
}

async function uploadDelivery(orderId, token, filename) {
  const response = await request(app).post(`/api/orders/${orderId}/upload`).set('Authorization', `Bearer ${token}`).field('file_kind', 'delivery').attach('file', Buffer.from(`${label} delivery evidence`), { filename, contentType: 'application/pdf' })
  if (response.status !== 200 || !response.body.filePath || !response.body.file?.id) throw new Error(`Delivery upload failed: ${response.status}:${JSON.stringify(response.body)}`)
  fixture.filePaths.push(response.body.filePath)
}

async function prepareDelivery(staff, orderId, projectId, filename) {
  await api('patch', `/api/execution/projects/${projectId}/tasks/${fixture.taskId}`, staff.token, { status: 'done' }, 200)
  await api('post', `/api/service-delivery/projects/${projectId}/delivery/prepare`, staff.token, { notes: 'Browser workflow delivery evidence.' }, 200)
  await uploadDelivery(orderId, staff.token, filename)
  await api('post', `/api/service-delivery/projects/${projectId}/delivery/send`, staff.token, {}, 200)
}

async function cleanup() {
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
  if (fixture.externalProjectIds.length) await run('external_projects', () => admin.from('projects').delete().in('id', fixture.externalProjectIds))
  if (fixture.filePaths.length) await run('storage_files', () => admin.storage.from('order-files').remove(fixture.filePaths))
  if (fixture.orderIds.length) {
    await run('order_files', () => admin.from('order_files').delete().in('order_id', fixture.orderIds))
    await run('notifications', () => admin.from('notifications').delete().in('order_id', fixture.orderIds))
    await run('orders', () => admin.from('orders').delete().in('id', fixture.orderIds))
  }
  for (const templateId of fixture.templateIds) {
    const milestones = await admin.from('project_template_milestones').select('id').eq('template_id', templateId)
    const milestoneIds = (milestones.data || []).map((row) => row.id)
    if (milestoneIds.length) await run('template_tasks', () => admin.from('project_template_tasks').delete().in('template_milestone_id', milestoneIds))
    await run('template_milestones', () => admin.from('project_template_milestones').delete().eq('template_id', templateId))
    await run('templates', () => admin.from('project_templates').delete().eq('id', templateId))
  }
  if (fixture.workspaceId) {
    await run('workspace_members', () => admin.from('workspace_members').delete().eq('workspace_id', fixture.workspaceId))
    await run('workspace', () => admin.from('workspaces').delete().eq('id', fixture.workspaceId))
  }
  if (fixture.externalWorkspaceId) await run('external_workspace', () => admin.from('workspaces').delete().eq('id', fixture.externalWorkspaceId))
  if (fixture.publicUserIds.length) await run('profiles', () => admin.from('users').delete().in('id', fixture.publicUserIds))
  for (const id of fixture.authUserIds) await run(`auth_${id}`, () => admin.auth.admin.deleteUser(id))
}

async function run() {
  fs.mkdirSync(screenshotDir, { recursive: true })
  const staff = await createUser('staff', 'admin')
  const clientA = await createUser('client-a', 'client')
  const clientB = await createUser('client-b', 'client')
  const workspace = await admin.from('workspaces').insert([{ name: label, description: 'Disposable browser E2E workspace' }]).select('id').single()
  if (workspace.error) throw workspace.error
  fixture.workspaceId = workspace.data.id
  const members = await admin.from('workspace_members').insert([{ workspace_id: fixture.workspaceId, user_id: staff.id, role: 'admin' }, { workspace_id: fixture.workspaceId, user_id: clientA.id, role: 'client' }, { workspace_id: fixture.workspaceId, user_id: clientB.id, role: 'client' }])
  if (members.error) throw members.error
  const workspaceUsers = await admin.from('users').update({ workspace_id: fixture.workspaceId }).in('id', [staff.id, clientA.id, clientB.id])
  if (workspaceUsers.error) throw workspaceUsers.error

  const externalWorkspace = await admin.from('workspaces').insert([{ name: `${label} external`, description: 'Disposable external workspace' }]).select('id').single()
  if (externalWorkspace.error) throw externalWorkspace.error
  fixture.externalWorkspaceId = externalWorkspace.data.id
  const externalProject = await admin.from('projects').insert([{ workspace_id: fixture.externalWorkspaceId, created_by: staff.id, name: `${label} external project`, description: 'Must be invisible to staff outside workspace', status: 'active' }]).select('id').single()
  if (externalProject.error) throw externalProject.error
  fixture.externalProjectIds.push(externalProject.data.id)

  const template = await api('post', '/api/execution/templates', staff.token, { name: `${label} Browser Template`, description: 'Disposable browser workflow template', service_id: null, milestones: [{ title: `${label} Intake`, description: 'Browser intake', tasks: [{ title: `${label} Visible Task`, description: 'Browser-visible execution task', priority: 'high', client_visible: true }] }] }, 201)
  const templateId = template.body.data.id
  fixture.templateIds.push(templateId)
  const orders = await admin.from('orders').insert([{ full_name: `${label} Client A`, email: clientA.email, service: 'Browser Service', package: 'Browser Package', status: 'processing', payment_status: 'verified', amount: 10, price: 10, user_id: clientA.id, workspace_id: fixture.workspaceId }, { full_name: `${label} Client B`, email: clientB.email, service: 'Browser Service', package: 'Browser Package', status: 'processing', payment_status: 'verified', amount: 10, price: 10, user_id: clientB.id, workspace_id: fixture.workspaceId }]).select('id,user_id')
  if (orders.error) throw orders.error
  fixture.orderIds.push(...orders.data.map((row) => row.id))
  const requirementTitle = `${label} Client brief`
  const initialized = await api('post', `/api/service-delivery/orders/${fixture.orderIds[0]}/initialize`, staff.token, { template_id: templateId, requirements: [{ title: requirementTitle, description: 'Submit a short brief from the browser.', requirement_type: 'text', is_required: true, client_visible: true }] }, 201)
  const projectA = initialized.body.data.project.id
  fixture.projectIds.push(projectA)
  fixture.taskId = initialized.body.data.tasks[0].id
  const initializedB = await api('post', `/api/service-delivery/orders/${fixture.orderIds[1]}/initialize`, staff.token, { template_id: templateId, requirements: [{ title: `${label} Client B brief`, description: 'Client B private brief.', requirement_type: 'text', is_required: true, client_visible: true }] }, 201)
  fixture.projectIds.push(initializedB.body.data.project.id)

  const browser = await cdpWs()
  const { send } = browser
  try {
    await send('Page.enable')
    await send('Runtime.enable')
    await send('Network.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: viewportWidth, height: viewportHeight, deviceScaleFactor: 1, mobile: viewportWidth < 600 })

    await browserLogin(send, staff.email, staff.password, 'staff')
    await navigate(send, '/admin', `document.body.innerText.includes('لوحة الإدارة') || document.body.innerText.includes('Admin panel')`, 'staff_command_center_loaded')
    await waitFor(send, `document.body.innerText.includes('قوالب المشاريع') || document.body.innerText.includes('Project templates')`, 20000)
    check('staff_template_manager_visible_in_command_center', true)
    await screenshot(send, 'staff-command-center.png')

    await navigate(send, '/clients', `document.body.innerText.includes('ملف العميل 360') || document.body.innerText.includes('Client 360')`, 'staff_client360_loaded')
    await waitFor(send, `document.body.innerText.includes(${JSON.stringify(clientA.email)})`, 25000)
    const selectedClient = await evaluate(send, `(() => { const buttons = [...document.querySelectorAll('button')]; const target = buttons.find((button) => button.innerText.includes(${JSON.stringify(clientA.email)}) || button.innerText.includes(${JSON.stringify(`${label} client-a`)})); if (!target) return false; target.click(); return true })()`)
    check('staff_client360_selects_client', selectedClient === true)
    await waitFor(send, `document.body.innerText.includes(${JSON.stringify('Browser Service')}) && document.body.innerText.includes(${JSON.stringify(`${label} client-a`)})`, 20000)
    check('staff_client_overview_loaded', true, { client: '[redacted]' })
    await screenshot(send, 'staff-client360-overview.png')

    await navigate(send, `/projects/${projectA}`, `!document.querySelector('[role="alert"]') && document.body.innerText.includes(${JSON.stringify('Browser Service')}) && (document.body.innerText.includes('هيكل التنفيذ') || document.body.innerText.includes('Execution structure'))`, 'staff_project_workspace_loaded')
    check('staff_project_workspace_loaded_with_project_data', true)
    await screenshot(send, 'staff-project-workspace.png')

    await navigate(send, '/admin', `document.body.innerText.includes('قوالب المشاريع') || document.body.innerText.includes('Project templates')`, 'staff_template_administration_loaded')
    check('staff_template_administration_loaded', true)
    await screenshot(send, 'staff-template-administration.png')

    await navigate(send, `/projects/${fixture.externalProjectIds[0]}`, `document.querySelector('[role="alert"]') && (document.body.innerText.includes('تعذر تحميل مساحة العمل') || document.body.innerText.includes('Project not found') || document.body.innerText.includes('لم يتم العثور') || document.body.innerText.includes('Request failed with status code 404'))`, 'staff_external_workspace_denied')
    check('staff_external_workspace_denied', true)
    await screenshot(send, 'staff-external-project-denied.png')

    await browserLogin(send, clientA.email, clientA.password, 'client_a')
    await navigate(send, '/dashboard', `document.body.innerText.includes(${JSON.stringify('Browser Service')}) || document.body.innerText.includes('لا توجد إجراءات معلقة') || document.body.innerText.includes('No pending actions')`, 'client_a_dashboard_loaded')
    await navigate(send, `/projects/${projectA}`, `document.body.innerText.includes(${JSON.stringify(requirementTitle)}) && document.body.innerText.includes('ما نحتاجه منك')`, 'client_a_project_loaded')
    const submitted = await evaluate(send, `(() => { const input = [...document.querySelectorAll('input[aria-label]')].find((node) => node.getAttribute('aria-label')?.includes(${JSON.stringify(requirementTitle)})); if (!input) return false; const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, 'Browser brief submitted by Client A'); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); const button = [...document.querySelectorAll('button')].find((node) => ['إرسال', 'Submit', 'Gönder'].includes(node.innerText.trim()) && !node.disabled); if (!button) return false; button.click(); return true })()`)
    check('client_a_submits_requirement_in_browser', submitted === true)
    await waitFor(send, `document.body.innerText.includes('تم الإرسال') || document.body.innerText.includes('Submitted') || document.body.innerText.includes('Gönderildi')`, 20000)
    check('client_a_requirement_submitted_visible', true)
    await screenshot(send, 'client-a-requirement-submitted.png')

    await prepareDelivery(staff, fixture.orderIds[0], projectA, `${label}-delivery-1.pdf`)
    await navigate(send, `/projects/${projectA}`, `document.body.innerText.includes('جاهز لمراجعتك') || document.body.innerText.includes('Ready for your review') || document.body.innerText.includes('İncelemeniz için hazır')`, 'client_a_delivery_review_loaded')
    check('client_a_delivery_review_visible', true)
    const revisionOpened = await evaluate(send, `(() => { const button = [...document.querySelectorAll('button')].find((node) => ['طلب تعديل', 'Request changes', 'Değişiklik iste'].includes(node.innerText.trim())); if (!button) return false; button.click(); return true })()`)
    check('client_a_revision_form_opened', revisionOpened === true)
    const revisionSent = await evaluate(send, `(() => { const textarea = [...document.querySelectorAll('textarea')].find((node) => node.placeholder.includes('اشرح') || node.placeholder.includes('Briefly') || node.placeholder.includes('Nelerin')); if (!textarea) return false; const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; setter.call(textarea, 'Please adjust the delivery evidence.'); textarea.dispatchEvent(new Event('input', { bubbles: true })); textarea.dispatchEvent(new Event('change', { bubbles: true })); const button = [...document.querySelectorAll('button')].find((node) => ['إرسال طلب التعديل', 'Send change request', 'Değişiklik isteğini gönder'].includes(node.innerText.trim()) && !node.disabled); if (!button) return false; button.click(); return true })()`)
    check('client_a_revision_sent_in_browser', revisionSent === true)
    await sleep(1200)
    await screenshot(send, 'client-a-revision-sent.png')

    await prepareDelivery(staff, fixture.orderIds[0], projectA, `${label}-delivery-2.pdf`)
    await navigate(send, `/projects/${projectA}`, `document.body.innerText.includes('جاهز لمراجعتك') || document.body.innerText.includes('Ready for your review') || document.body.innerText.includes('İncelemeniz için hazır')`, 'client_a_delivery_review_after_revision_loaded')
    const approved = await evaluate(send, `(() => { const button = [...document.querySelectorAll('button')].find((node) => ['اعتماد التسليم', 'Approve delivery', 'Teslimatı onayla'].includes(node.innerText.trim()) && !node.disabled); if (!button) return false; button.click(); return true })()`)
    check('client_a_approves_delivery_in_browser', approved === true)
    await waitFor(send, `document.body.innerText.includes('اكتمل المشروع') || document.body.innerText.includes('Project completed') || document.body.innerText.includes('Proje tamamlandı')`, 20000)
    check('client_a_completed_state_visible', true)
    await screenshot(send, 'client-a-completed.png')

    await browserLogin(send, clientB.email, clientB.password, 'client_b')
    await navigate(send, `/projects/${projectA}`, `document.querySelector('[role="alert"]') && (document.body.innerText.includes('تعذر تحميل مساحة العمل') || document.body.innerText.includes('Project not found') || document.body.innerText.includes('لم يتم العثور') || document.body.innerText.includes('Request failed with status code 404'))`, 'client_b_cross_project_denied')
    check('client_b_cross_project_denied_in_browser', true)
    await screenshot(send, 'client-b-cross-project-denied.png')

    result.status = 'PASS'
  } catch (error) {
    result.status = 'FAIL'
    result.error = redact(error)
    try { await screenshot(send, 'browser-workflow-failure.png') } catch {}
    throw error
  } finally {
    browser.socket.close()
    await cleanup()
    result.cleanup.ok = result.cleanup.errors.length === 0
    const output = JSON.stringify(result, null, 2)
    if (result.status === 'PASS') console.log(output)
    else console.error(output)
  }
}

run().catch((error) => { console.error(redact(error)); process.exitCode = 1 })
