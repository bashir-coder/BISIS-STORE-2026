const path = require('path')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })

const marker = '__BROWSER_WORKFLOW_%'
const dryRun = process.env.BROWSER_FIXTURE_CLEANUP_DRY_RUN !== 'false'
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const fail = (response, label) => { if (response.error) throw new Error(`${label}: ${response.error.message}`); return response.data || [] }

async function run() {
  const users = fail(await admin.from('users').select('id,full_name').ilike('full_name', marker), 'users')
  const workspaces = fail(await admin.from('workspaces').select('id,name').ilike('name', marker), 'workspaces')
  const orders = fail(await admin.from('orders').select('id,full_name').ilike('full_name', marker), 'orders')
  const projects = fail(await admin.from('projects').select('id,name').ilike('name', marker), 'projects')
  const templates = fail(await admin.from('project_templates').select('id,name').ilike('name', marker), 'project_templates')
  const orderIds = orders.map((row) => row.id)
  const projectIds = projects.map((row) => row.id)
  const templateIds = templates.map((row) => row.id)
  const workspaceIds = workspaces.map((row) => row.id)
  const publicUserIds = users.map((row) => row.id)
  const orderFiles = orderIds.length ? fail(await admin.from('order_files').select('*').in('order_id', orderIds), 'order_files') : []
  const filePaths = orderFiles.map((row) => row.file_path || row.filePath || row.storage_path || row.path).filter(Boolean)
  const summary = { dry_run: dryRun, counts: { users: users.length, workspaces: workspaces.length, orders: orders.length, projects: projects.length, project_templates: templates.length, order_files: orderFiles.length, storage_paths: filePaths.length }, order_file_keys: orderFiles[0] ? Object.keys(orderFiles[0]).sort() : [] }
  if (dryRun) { console.log(JSON.stringify(summary, null, 2)); return }
  const remove = async (label, operation) => { const response = await operation(); if (response?.error) throw new Error(`${label}: ${response.error.message}`) }
  if (projectIds.length) {
    await remove('project_deliveries', () => admin.from('project_deliveries').delete().in('project_id', projectIds))
    await remove('project_requirements', () => admin.from('project_requirements').delete().in('project_id', projectIds))
    await remove('project_activity', () => admin.from('project_activity').delete().in('project_id', projectIds))
    await remove('project_tasks', () => admin.from('project_tasks').delete().in('project_id', projectIds))
    await remove('project_milestones', () => admin.from('project_milestones').delete().in('project_id', projectIds))
    await remove('projects', () => admin.from('projects').delete().in('id', projectIds))
  }
  if (filePaths.length) await remove('storage_files', () => admin.storage.from('order-files').remove(filePaths))
  if (orderIds.length) {
    await remove('order_files', () => admin.from('order_files').delete().in('order_id', orderIds))
    await remove('notifications', () => admin.from('notifications').delete().in('order_id', orderIds))
    await remove('orders', () => admin.from('orders').delete().in('id', orderIds))
  }
  for (const templateId of templateIds) {
    const milestones = fail(await admin.from('project_template_milestones').select('id').eq('template_id', templateId), 'template milestones')
    const milestoneIds = milestones.map((row) => row.id)
    if (milestoneIds.length) await remove('template_tasks', () => admin.from('project_template_tasks').delete().in('template_milestone_id', milestoneIds))
    await remove('template_milestones', () => admin.from('project_template_milestones').delete().eq('template_id', templateId))
    await remove('project_templates', () => admin.from('project_templates').delete().eq('id', templateId))
  }
  if (workspaceIds.length) {
    await remove('workspace_members', () => admin.from('workspace_members').delete().in('workspace_id', workspaceIds))
    await remove('workspaces', () => admin.from('workspaces').delete().in('id', workspaceIds))
  }
  if (publicUserIds.length) {
    await remove('users', () => admin.from('users').delete().in('id', publicUserIds))
    for (const id of publicUserIds) {
      const response = await admin.auth.admin.deleteUser(id)
      if (response.error) throw new Error(`auth user cleanup: ${response.error.message}`)
    }
  }
  console.log(JSON.stringify({ ...summary, cleaned: true }, null, 2))
}
run().catch((error) => { console.error(error.message); process.exitCode = 1 })
