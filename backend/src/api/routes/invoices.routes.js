const express = require('express')
const crypto = require('crypto')
const { authenticate, authorize } = require('../middleware/auth.middleware')
const supabase = require('../../config/supabase.config')
const router = express.Router()

const staffRoles = new Set(['admin', 'super_admin', 'manager'])
const canAccessOrder = (user, order) => order && (order.user_id === user.id || (staffRoles.has(user.role) && (user.role === 'super_admin' || Boolean(user.workspace_id && user.workspace_id === order.workspace_id))))

const findAccessibleInvoice = async (invoiceId, user) => {
  const { data: invoice, error } = await supabase.from('invoices').select('*').eq('id', invoiceId).maybeSingle()
  if (error || !invoice) return null
  const { data: order, error: orderError } = await supabase.from('orders').select('id, user_id, workspace_id, full_name, email, submission_id, package_id').eq('id', invoice.order_id).maybeSingle()
  if (orderError || !canAccessOrder(user, order)) return null
  return { ...invoice, order }
}

router.get('/', authenticate, authorize('admin', 'super_admin', 'manager'), async (req, res) => {
  try {
    if (req.user.role !== 'super_admin' && !req.user.workspace_id) return res.status(403).json({ message: 'An active workspace is required' })
    let query = supabase.from('invoices').select('*, orders(full_name, email, submission_id, workspace_id)')
    if (req.user.role !== 'super_admin') query = query.eq('orders.workspace_id', req.user.workspace_id)
    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw error
    res.json(data || [])
  } catch (err) { res.status(400).json({ message: 'Invalid request' }) }
})

// This is before /:id so Express cannot shadow it with the parameter route.
router.get('/order/:orderId', authenticate, async (req, res) => {
  try {
    const { data: order, error } = await supabase.from('orders').select('id, user_id, workspace_id').eq('id', req.params.orderId).maybeSingle()
    if (error || !canAccessOrder(req.user, order)) return res.status(404).json({ message: 'Invoice not found' })
    const { data: invoice, error: invoiceError } = await supabase.from('invoices').select('*').eq('order_id', order.id).maybeSingle()
    if (invoiceError || !invoice) return res.status(404).json({ message: 'Invoice not found' })
    res.json(invoice)
  } catch (err) { res.status(400).json({ message: 'Invalid request' }) }
})

router.get('/:id', authenticate, async (req, res) => {
  try {
    const invoice = await findAccessibleInvoice(req.params.id, req.user)
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' })
    res.json(invoice)
  } catch (err) { res.status(500).json({ message: 'Unable to complete request' }) }
})

router.post('/', authenticate, authorize('admin', 'super_admin', 'manager'), async (req, res) => {
  try {
    const { order_id } = req.body
    if (!order_id) return res.status(400).json({ message: 'Order ID is required' })
    const { data: order, error: orderError } = await supabase.from('orders').select('id, user_id, workspace_id, amount, price').eq('id', order_id).maybeSingle()
    if (orderError || !canAccessOrder(req.user, order)) return res.status(404).json({ message: 'Order not found' })
    const { data: existingInvoice } = await supabase.from('invoices').select('id').eq('order_id', order.id).maybeSingle()
    if (existingInvoice) return res.status(409).json({ message: 'An invoice already exists for this order' })
    const amount = Number(order.amount ?? order.price)
    if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ message: 'Order has an invalid amount' })
    const tax = Number((amount * 0.15).toFixed(2))
    const total = Number((amount + tax).toFixed(2))
    const { data, error } = await supabase.from('invoices').insert([{
      order_id: order.id, amount, tax, total,
      invoice_number: `INV-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      status: 'issued',
    }]).select().single()
    if (error) throw error
    res.status(201).json(data)
  } catch (err) { res.status(400).json({ message: 'Invalid request' }) }
})

router.patch('/:id', authenticate, authorize('admin', 'super_admin', 'manager'), async (req, res) => {
  try {
    const { status } = req.body
    if (!['issued', 'void', 'refunded'].includes(status)) return res.status(400).json({ message: 'Invalid invoice status' })
    const invoice = await findAccessibleInvoice(req.params.id, req.user)
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' })
    const { data, error } = await supabase.from('invoices').update({ status, updated_at: new Date().toISOString() }).eq('id', invoice.id).select().single()
    if (error) throw error
    res.json(data)
  } catch (err) { res.status(400).json({ message: 'Invalid request' }) }
})

module.exports = router
