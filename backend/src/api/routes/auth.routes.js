/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         full_name:
 *           type: string
 *         email:
 *           type: string
 *         role:
 *           type: string
 *         is_verified:
 *           type: boolean
 *         is_active:
 *           type: boolean
 *     Order:
 *       type: object
 *       properties:
 *         id:
 *           type: number
 *         submission_id:
 *           type: string
 *         package_id:
 *           type: number
 *         amount:
 *           type: number
 *         status:
 *           type: string
 *         created_at:
 *           type: string
 */

/**
 * @swagger
 * /auth/google:
 *   post:
 *     summary: تسجيل الدخول عبر Google
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: نجاح
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: خطأ في الطلب
 *       500:
 *         description: خطأ في الخادم
 */

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: جلب بيانات المستخدم الحالي
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: بيانات المستخدم
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: غير مصرح
 */

/**
 * @swagger
 * /auth/workspaces:
 *   get:
 *     summary: جلب جميع مساحات العمل
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة مساحات العمل
 *       401:
 *         description: غير مصرح
 */

/**
 * @swagger
 * /auth/switch-workspace:
 *   post:
 *     summary: تبديل مساحة العمل
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               workspace_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: تم التبديل بنجاح
 *       400:
 *         description: معرف مساحة العمل مطلوب
 *       404:
 *         description: مساحة العمل غير موجودة
 */
const express = require('express')
const supabase = require('../../config/supabase.config')
const { authenticate } = require('../middleware/auth.middleware')
const { canAccessWorkspace } = require('../utils/workspace-access')
const router = express.Router()

// ============================================================
// 1. GET ME
// ============================================================
router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user })
})

// ============================================================
// 3. GET WORKSPACES
// ============================================================
router.get('/workspaces', authenticate, async (req, res) => {
  try {
    let query = supabase.from('workspaces').select('*').order('name', { ascending: true })
    if (req.user.role !== 'super_admin') {
      const { data: memberships, error: membershipError } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', req.user.id)
      if (membershipError) throw membershipError
      query = query.in('id', (memberships || []).map((membership) => membership.workspace_id))
    }
    const { data, error } = await query

    if (error) throw error
    res.json(data || [])
  } catch (err) {
    res.status(400).json({ message: 'Invalid request' })
  }
})

// ============================================================
// 4. SWITCH WORKSPACE
// ============================================================
router.post('/switch-workspace', authenticate, async (req, res) => {
  try {
    const { workspace_id } = req.body
    if (!workspace_id) {
      return res.status(400).json({ message: 'Workspace ID required' })
    }

    const { data: workspace, error: findError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', workspace_id)
      .single()

    if (findError || !workspace) {
      return res.status(404).json({ message: 'Workspace not found' })
    }

    if (!(await canAccessWorkspace(req.user, workspace_id))) {
      return res.status(403).json({ message: 'You are not a member of this workspace' })
    }

    const { data: user, error: updateError } = await supabase
      .from('users')
      .update({ workspace_id })
      .eq('id', req.user.id)
      .select()
      .single()

    if (updateError) throw updateError

    res.json({
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        workspace_id: user.workspace_id,
        avatar: user.avatar,
        is_verified: user.is_verified,
        is_active: user.is_active,
      },
    })
  } catch (err) {
    res.status(400).json({ message: 'Invalid request' })
  }
})

module.exports = router
