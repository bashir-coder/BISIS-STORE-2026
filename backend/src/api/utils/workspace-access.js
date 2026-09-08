const supabase = require('../../config/supabase.config')

const canAccessWorkspace = async (user, workspaceId) => {
  if (!user?.id || !workspaceId) return false
  if (user.role === 'super_admin') return true

  const { data, error } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle()

  return !error && Boolean(data)
}

module.exports = { canAccessWorkspace }
