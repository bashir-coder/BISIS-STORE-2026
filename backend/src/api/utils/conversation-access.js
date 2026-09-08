const supabase = require('../../config/supabase.config')
const { canAccessWorkspace } = require('./workspace-access')

const isStaff = (user) => ['admin', 'super_admin', 'manager'].includes(user?.role)

const authorizeConversationAccess = async (conversationId, user) => {
  if (!conversationId || !user?.id) return { error: 'Unauthorized' }

  const { data: conversation, error } = await supabase
    .from('conversations')
    .select('id, user_id, order_id, project_id, workspace_id')
    .eq('id', conversationId)
    .single()

  if (error || !conversation) return { error: 'Conversation not found' }
  if (user.role === 'super_admin' || conversation.user_id === user.id) return { conversation, authorized: true }
  if (isStaff(user) && conversation.workspace_id && user.workspace_id === conversation.workspace_id && await canAccessWorkspace(user, conversation.workspace_id)) {
    return { conversation, authorized: true }
  }

  if (conversation.order_id) {
    const { data: order } = await supabase.from('orders').select('user_id, workspace_id').eq('id', conversation.order_id).maybeSingle()
    if (order?.user_id === user.id) return { conversation, authorized: true }
    if (isStaff(user) && user.workspace_id && order?.workspace_id === user.workspace_id && await canAccessWorkspace(user, order.workspace_id)) return { conversation, authorized: true }
  }
  if (conversation.project_id) {
    const { data: project } = await supabase.from('projects').select('created_by, workspace_id').eq('id', conversation.project_id).maybeSingle()
    if (project?.created_by === user.id) return { conversation, authorized: true }
    if (isStaff(user) && user.workspace_id && project?.workspace_id === user.workspace_id && await canAccessWorkspace(user, project.workspace_id)) return { conversation, authorized: true }
  }
  return { error: 'Unauthorized' }
}

module.exports = { authorizeConversationAccess, isStaff }
