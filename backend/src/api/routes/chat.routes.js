const express = require('express')
const { authenticate } = require('../middleware/auth.middleware')
const supabase = require('../../config/supabase.config')
const { authorizeConversationAccess } = require('../utils/conversation-access')
const { canAccessWorkspace } = require('../utils/workspace-access')
const router = express.Router()

// ===============================
// GET conversation by order or project
// ===============================
router.get('/', authenticate, async (req, res) => {
  try {
    const { order_id, project_id } = req.query
    
    if (!order_id && !project_id) {
      return res.status(400).json({ message: 'order_id or project_id required' })
    }

    // Authorize the parent object before looking up or creating a conversation.
    // Otherwise a user could create a conversation against another user's order.
    const staff = ['admin', 'manager', 'super_admin'].includes(req.user.role)
    let parentWorkspaceId = null
    if (order_id) {
      const { data: order } = await supabase.from('orders').select('user_id, workspace_id').eq('id', order_id).maybeSingle()
      const workspaceAccess = staff && order?.workspace_id && req.user.workspace_id === order.workspace_id && await canAccessWorkspace(req.user, order.workspace_id)
      if (!order || (order.user_id !== req.user.id && !(req.user.role === 'super_admin' || workspaceAccess))) {
        return res.status(403).json({ message: 'Conversation access denied' })
      }
      parentWorkspaceId = order.workspace_id
    } else if (project_id) {
      const { data: project } = await supabase.from('projects').select('created_by, workspace_id').eq('id', project_id).maybeSingle()
      const workspaceAccess = staff && project?.workspace_id && req.user.workspace_id === project.workspace_id && await canAccessWorkspace(req.user, project.workspace_id)
      if (!project || (project.created_by !== req.user.id && !(req.user.role === 'super_admin' || workspaceAccess))) {
        return res.status(403).json({ message: 'Conversation access denied' })
      }
      parentWorkspaceId = project.workspace_id
    }

    let query = supabase.from('conversations').select('*')
    
    if (order_id) {
      query = query.eq('order_id', order_id)
    } else if (project_id) {
      query = query.eq('project_id', project_id)
    }
    
    const { data, error } = await query.maybeSingle()
    
    if (error) {
      console.error('❌ Error fetching conversation:', error)
      throw error
    }
    
    if (!data) {
      // إنشاء محادثة جديدة
      const newConv = {
        order_id: order_id || null,
        project_id: project_id || null,
        user_id: req.user.id,
        workspace_id: parentWorkspaceId,
        title: `Chat for ${order_id ? 'Order #' + order_id : 'Project #' + project_id}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      const { data: newData, error: insertError } = await supabase
        .from('conversations')
        .insert([newConv])
        .select()
        .single()
      
      if (insertError) {
        console.error('❌ Error creating conversation:', insertError)
        throw insertError
      }
      return res.json(newData)
    }
    
    // ✅ التحقق من الصلاحية
    const accessCheck = await authorizeConversationAccess(data.id, req.user)
    if (accessCheck.error) {
      return res.status(403).json({ message: accessCheck.error })
    }

    res.json(data)
  } catch (err) {
    console.error('❌ Chat error:', err)
    res.status(500).json({ message: 'Unable to process chat request' })
  }
})

// ===============================
// GET messages by conversation
// ===============================
router.get('/:conversationId/messages', authenticate, async (req, res) => {
  try {
    const { conversationId } = req.params

    // ✅ التحقق من الصلاحية
    const accessCheck = await authorizeConversationAccess(conversationId, req.user)
    if (accessCheck.error) {
      return res.status(403).json({ message: accessCheck.error })
    }

    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:sender_id(id, full_name, email, role, avatar)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    
    if (error) {
      console.error('❌ Error fetching messages:', error)
      throw error
    }
    
    res.json(data || [])
  } catch (err) {
    console.error('❌ Chat messages error:', err)
    res.status(500).json({ message: 'Unable to process chat request' })
  }
})

// ===============================
// POST new message
// ===============================
router.post('/:conversationId/messages', authenticate, async (req, res) => {
  try {
    const { conversationId } = req.params
    const { content } = req.body
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ message: 'Message content is required' })
    }

    // ✅ التحقق من الصلاحية
    const accessCheck = await authorizeConversationAccess(conversationId, req.user)
    if (accessCheck.error) {
      return res.status(403).json({ message: accessCheck.error })
    }

    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)
    
    const { data, error } = await supabase
      .from('messages')
      .insert([{
        conversation_id: conversationId,
        sender_id: req.user.id,
        content: content.trim(),
        read: false,
        created_at: new Date().toISOString()
      }])
      .select('*, sender:sender_id(id, full_name, email, role, avatar)')
      .single()
    
    if (error) {
      console.error('❌ Error inserting message:', error)
      throw error
    }
    
    res.status(201).json(data)
  } catch (err) {
    console.error('❌ Chat send error:', err)
    res.status(500).json({ message: 'Unable to process chat request' })
  }
})

// ===============================
// MARK messages as read
// ===============================
router.patch('/:conversationId/read', authenticate, async (req, res) => {
  try {
    const { conversationId } = req.params

    // ✅ التحقق من الصلاحية
    const accessCheck = await authorizeConversationAccess(conversationId, req.user)
    if (accessCheck.error) {
      return res.status(403).json({ message: accessCheck.error })
    }

    const { data, error } = await supabase
      .from('messages')
      .update({ read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', req.user.id)
      .select()
    
    if (error) {
      console.error('❌ Error marking messages as read:', error)
      throw error
    }
    
    res.json({ updated: data?.length || 0 })
  } catch (err) {
    console.error('❌ Chat read error:', err)
    res.status(500).json({ message: 'Unable to process chat request' })
  }
})

// ===============================
// GET unread count
// ===============================
router.get('/unread', authenticate, async (req, res) => {
  try {
    // جلب جميع المحادثات التي يملكها المستخدم أو مشارك فيها
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', req.user.id)

    if (convError) throw convError

    if (!conversations || conversations.length === 0) {
      return res.json({ unread: 0 })
    }

    const conversationIds = conversations.map(c => c.id)

    const { count, error } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .neq('sender_id', req.user.id)
      .eq('read', false)
      .in('conversation_id', conversationIds)
    
    if (error) {
      console.error('❌ Error fetching unread count:', error)
      throw error
    }
    
    res.json({ unread: count || 0 })
  } catch (err) {
    console.error('❌ Chat unread error:', err)
    res.status(500).json({ message: 'Unable to process chat request' })
  }
})

module.exports = router
