const supabase = require('../config/supabase.config')

async function grantDigitalProductAccess({ orderId, productId, userId, price }) {
  try {
    // Check if purchase already exists
    const { data: existing } = await supabase
      .from('digital_product_purchases')
      .select('*')
      .eq('order_id', orderId)
      .eq('product_id', productId)
      .maybeSingle()

    if (existing) {
      if (existing.status === 'confirmed' || existing.payment_confirmed) {
        return { granted: true, alreadyExists: true, purchase: existing }
      }
      if (existing.status === 'refunded' || existing.status === 'revoked') {
        return { granted: false, reason: 'refunded_or_revoked' }
      }
    }

    const { data: purchase, error } = await supabase
      .from('digital_product_purchases')
      .upsert({
        order_id: orderId,
        product_id: productId,
        user_id: userId,
        price: price,
        payment_confirmed: true,
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        purchased_at: new Date().toISOString()
      }, {
        onConflict: 'order_id,product_id'
      })
      .select()
      .single()

    if (error) throw error
    return { granted: true, purchase }
  } catch (err) {
    console.error('Grant digital product access error:', err)
    throw err
  }
}

module.exports = { grantDigitalProductAccess }
