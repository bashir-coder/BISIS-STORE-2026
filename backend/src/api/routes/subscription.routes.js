const express = require('express')
const { authenticate } = require('../middleware/auth.middleware')
const supabase = require('../../config/supabase.config')
const router = express.Router()

router.get('/', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data || [])
  } catch (err) {
    res.status(500).json({ message: 'Unable to complete request' })
  }
})

router.post('/', authenticate, async (req, res) => {
  try {
    const body = req.body || {}

    if (body.status === 'active' && body.user_id && body.user_id !== req.user.id) {
      return res.status(409).json({ code: 'SUBSCRIPTION_CHECKOUT_UNAVAILABLE' })
    }

    if (body.status === 'active') {
      return res.status(409).json({ code: 'SUBSCRIPTION_CHECKOUT_UNAVAILABLE' })
    }

    const { plan_type = 'life_plan' } = body


    const { data: existing, error: checkError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (!checkError && existing) {
      return res.status(400).json({ message: 'You already have an active subscription' })
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .insert([{
        user_id: req.user.id,
        plan_type,
        status: 'active',
        price: 49.00,
        started_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      }])
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    res.status(400).json({ message: 'Invalid request' })
  }
})

router.patch('/:id/cancel', authenticate, async (req, res) => {
  try {
    const { id } = req.params
    const { data, error } = await supabase
      .from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single()

    if (error) throw error
    if (!data) return res.status(404).json({ message: 'Subscription not found' })
    res.json(data)
  } catch (err) {
    res.status(400).json({ message: 'Invalid request' })
  }
})

module.exports = router
