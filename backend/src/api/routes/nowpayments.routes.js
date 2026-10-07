const express = require('express')
const crypto = require('crypto')

const supabase = require('../../config/supabase.config')

const router = express.Router()

// ============================================================
// Configuration
// ============================================================

const IPN_SECRET = String(
  process.env.NOWPAYMENTS_IPN_SECRET_KEY || '',
).trim()

// ============================================================
// Helpers
// ============================================================

function sortObject(value) {
  if (Array.isArray(value)) {
    return value.map(sortObject)
  }

  if (
    value !== null &&
    typeof value === 'object'
  ) {
    return Object.keys(value)
      .sort()
      .reduce((sorted, key) => {
        sorted[key] = sortObject(value[key])
        return sorted
      }, {})
  }

  return value
}

function createSignature(payload) {
  if (!IPN_SECRET) {
    const error = new Error(
      'NOWPAYMENTS_IPN_SECRET_KEY is not configured',
    )

    error.status = 503
    error.code = 'NOWPAYMENTS_IPN_SECRET_KEY_MISSING'

    throw error
  }

  const sortedPayload = sortObject(payload)

  const payloadString = JSON.stringify(
    sortedPayload,
  )

  return crypto
    .createHmac('sha512', IPN_SECRET)
    .update(payloadString)
    .digest('hex')
}

function timingSafeEqualHex(
  expectedSignature,
  receivedSignature,
) {
  const expected = Buffer.from(
    String(expectedSignature || ''),
    'utf8',
  )

  const received = Buffer.from(
    String(receivedSignature || ''),
    'utf8',
  )

  if (
    expected.length === 0 ||
    received.length === 0
  ) {
    return false
  }

  if (
    expected.length !==
    received.length
  ) {
    return false
  }

  return crypto.timingSafeEqual(
    expected,
    received,
  )
}

function normalizeStatus(
  paymentStatus,
) {
  const status = String(
    paymentStatus || '',
  )
    .trim()
    .toLowerCase()

  switch (status) {
    case 'waiting':
      return 'pending'

    case 'confirming':
    case 'confirmed':
    case 'sending':
      return 'submitted'

    case 'finished':
      return 'verified'

    case 'partially_paid':
      return 'submitted'

    case 'failed':
      return 'failed'

    case 'expired':
      return 'failed'

    case 'refunded':
      return 'refunded'

    default:
      return null
  }
}

function normalizeOrderId(orderId) {
  const value = String(
    orderId ?? '',
  ).trim()

  if (!value) {
    return null
  }

  const numericId = Number(value)

  if (
    Number.isInteger(numericId) &&
    numericId > 0
  ) {
    return numericId
  }

  return null
}

// ============================================================
// POST /
// NOWPayments IPN callback
// ============================================================

router.post(
  '/',
  async (req, res) => {
    try {
      if (!IPN_SECRET) {
        return res.status(503).json({
          success: false,
          message:
            'NOWPayments IPN secret is not configured',
        })
      }

      const receivedSignature = String(
        req.get('x-nowpayments-sig') || '',
      ).trim()

      if (!receivedSignature) {
        return res.status(401).json({
          success: false,
          message:
            'Missing NOWPayments IPN signature',
        })
      }

      const payload = req.body

      if (
        !payload ||
        typeof payload !== 'object' ||
        Array.isArray(payload)
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Invalid NOWPayments IPN payload',
        })
      }

      const expectedSignature =
        createSignature(payload)

      if (
        !timingSafeEqualHex(
          expectedSignature,
          receivedSignature,
        )
      ) {
        return res.status(401).json({
          success: false,
          message:
            'Invalid NOWPayments IPN signature',
        })
      }

      // ========================================================
      // Validate payment currency
      // ========================================================

      const payCurrency = String(
        payload.pay_currency || '',
      )
        .trim()
        .toLowerCase()

      const priceCurrency = String(
        payload.price_currency || '',
      )
        .trim()
        .toLowerCase()

      if (
        payCurrency &&
        payCurrency !== 'usdcbsc'
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Unsupported payment currency',
        })
      }

      if (
        priceCurrency &&
        priceCurrency !== 'usd'
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Unsupported price currency',
        })
      }

      // ========================================================
      // Resolve order
      // ========================================================

      const orderId = normalizeOrderId(
        payload.order_id,
      )

      if (!orderId) {
        return res.status(400).json({
          success: false,
          message:
            'Invalid or missing order_id',
        })
      }

      const {
        data: order,
        error: orderError,
      } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle()

      if (orderError) {
        throw orderError
      }

      if (!order) {
        return res.status(404).json({
          success: false,
          message:
            'Order not found',
        })
      }

      // ========================================================
      // Map NOWPayments status
      // ========================================================

      const paymentStatus =
        normalizeStatus(
          payload.payment_status,
        )

      if (!paymentStatus) {
        // Unknown status:
        // acknowledge it so NOWPayments does not keep
        // retrying forever, but do not alter the order.
        // Still record the IPN receipt timestamp for audit.
        const nowIso =
          new Date().toISOString()

        await supabase
          .from('orders')
          .update({
            nowpayments_last_ipn_at:
              nowIso,
          })
          .eq('id', orderId)

        return res.status(200).json({
          success: true,
          ignored: true,
          reason:
            'Unsupported payment status',
        })
      }

      // ========================================================
      // Verify the provider-reported invoice amount against
      // the server-side order amount.
      //
      // Invoices are always created server-side with
      // Number(order.amount ?? order.price) in USD, so a
      // legitimate IPN must report the same price_amount.
      // A validly-signed IPN with a different amount must
      // never transition the order to a paid state.
      //
      // expected amount   = order.amount ?? order.price
      // provider-reported = payload.price_amount
      // actual paid       = payload.actually_paid
      // ========================================================

      const expectedAmount = Number(
        order.amount ?? order.price,
      )

      const reportedPriceAmount = Number(
        payload.price_amount,
      )

      if (
        !Number.isFinite(expectedAmount) ||
        expectedAmount <= 0 ||
        !Number.isFinite(reportedPriceAmount) ||
        reportedPriceAmount <= 0 ||
        Math.round(reportedPriceAmount * 100) !==
          Math.round(expectedAmount * 100)
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Payment amount does not match the order',
          code: 'IPN_AMOUNT_MISMATCH',
        })
      }

      // A payment in progress must report a positive paid
      // amount. Waiting, failure and expiry states
      // legitimately report zero or no paid amount.
      if (
        paymentStatus === 'verified' ||
        paymentStatus === 'submitted'
      ) {
        const actualPaidAmount = Number(
          payload.actually_paid,
        )

        if (
          !Number.isFinite(actualPaidAmount) ||
          actualPaidAmount <= 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              'Payment is missing a positive paid amount',
            code: 'IPN_PAID_AMOUNT_MISSING',
          })
        }
      }

      // ========================================================
      // Extract useful payment data
      // ========================================================

      const payAddress =
        payload.pay_address
          ? String(
              payload.pay_address,
            ).trim()
          : null

      const payinHash =
        payload.payin_hash
          ? String(
              payload.payin_hash,
            ).trim()
          : null

      const paymentId =
        payload.payment_id !==
        undefined &&
        payload.payment_id !== null
          ? String(
              payload.payment_id,
            ).trim()
          : null

      const purchaseId =
        payload.purchase_id !==
        undefined &&
        payload.purchase_id !== null
          ? String(
              payload.purchase_id,
            ).trim()
          : null

      // ========================================================
      // Prevent unnecessary downgrade
      // ========================================================

      if (
        order.payment_status ===
          'verified' &&
        paymentStatus !== 'refunded'
      ) {
        const nowIso =
          new Date().toISOString()

        await supabase
          .from('orders')
          .update({
            nowpayments_last_ipn_at:
              nowIso,
          })
          .eq('id', orderId)

        return res.status(200).json({
          success: true,
          ignored: true,
          reason:
            'Order is already verified',
        })
      }

      // ========================================================
      // Update order
      // ========================================================

      const nowIso =
        new Date().toISOString()

      const updatePayload = {
        payment_status:
          paymentStatus,

        network: 'bsc',

        currency: 'USDC',

        updated_at:
          nowIso,

        nowpayments_last_ipn_at:
          nowIso,
      }

      if (payinHash) {
        updatePayload.txid =
          payinHash
      }

      // ========================================================
      // Atomic state transition
      //
      // The update is guarded so a concurrent or later IPN
      // can never downgrade an order that another request
      // already moved to "verified". Refunds are exempt
      // because a refund must be able to supersede a
      // verified state.
      // ========================================================

      const updateQuery = supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', orderId)

      if (
        paymentStatus !== 'refunded'
      ) {
        updateQuery.neq('payment_status', 'verified')
      }

      const {
        data: updatedOrder,
        error: updateError,
      } = await updateQuery
        .select()
        .maybeSingle()

      if (updateError) {
        throw updateError
      }

      if (!updatedOrder) {
        // Another IPN already transitioned this order to a
        // protected state. Re-read the authoritative state
        // and acknowledge the notification idempotently
        // instead of overwriting it.
        const {
          data: currentOrder,
        } = await supabase
          .from('orders')
          .select('payment_status')
          .eq('id', orderId)
          .maybeSingle()

        const alreadyVerified = Boolean(
          currentOrder?.payment_status === 'verified' &&
            paymentStatus !== 'refunded',
        )

        return res.status(200).json({
          success: true,

          order_id:
            orderId,

          payment_id:
            paymentId,

          payment_status:
            payload.payment_status ||
            null,

          internal_status:
            paymentStatus,

          updated:
            false,

          reason:
            alreadyVerified
              ? 'Order is already verified'
              : 'Payment state changed concurrently',

          current_payment_status:
            currentOrder?.payment_status ||
            null,
        })
      }

      // ========================================================
      // Record payment event
      // Guard against duplicate events from NOWPayments retries
      // ========================================================

      const eventPayload = {
        provider: 'nowpayments',

        payment_id:
          paymentId,

        purchase_id:
          purchaseId,

        payment_status:
          payload.payment_status ||
          null,

        price_amount:
          payload.price_amount ??
          null,

        price_currency:
          payload.price_currency ??
          null,

        pay_amount:
          payload.pay_amount ??
          null,

        actually_paid:
          payload.actually_paid ??
          payload.amount_received ??
          null,

        pay_currency:
          payload.pay_currency ??
          null,

        pay_address:
          payAddress,

        payin_hash:
          payinHash,

        network:
          'bsc',

        raw:
          payload,
      }

      const normalizedRawStatus = String(
        payload.payment_status || '',
      )
        .trim()
        .toLowerCase()

      const eventAlreadyExists =
        paymentId || purchaseId
          ? Boolean(
              (
                await supabase
                  .from('order_events')
                  .select('id')
                  .eq('order_id', orderId)
                  .eq(
                    'event_type',
                    `payment.nowpayments.${normalizedRawStatus}`,
                  )
                  .or(
                    [
                      paymentId
                        ? `payload->payment_id.eq.${paymentId}`
                        : null,
                      purchaseId
                        ? `payload->purchase_id.eq.${purchaseId}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(','),
                  )
                  .gte(
                    'created_at',
                    new Date(
                      Date.now() -
                        5 * 60 * 1000,
                    ).toISOString(),
                  )
                  .maybeSingle()
              ).data
            )
          : false

      if (!eventAlreadyExists) {
        const {
          error: eventError,
        } = await supabase
          .from('order_events')
          .insert([
            {
              order_id:
                orderId,

              actor_id:
                null,

              event_type:
                `payment.nowpayments.${normalizedRawStatus}`,

              payload:
                eventPayload,

              created_at:
                nowIso,
            },
          ])

        if (eventError) {
          // Do not fail the IPN after the actual order
          // update succeeded.
          console.error(
            'NOWPayments order event error:',
            eventError,
          )
        }
      }

      // ========================================================
      // Notifications
      // ========================================================

      if (
        paymentStatus ===
        'verified'
      ) {
        try {
          await supabase
            .from('notifications')
            .insert([
              {
                user_id:
                  order.user_id,

                type:
                  'payment',

                message:
                  `Payment for order #${orderId} has been confirmed.`,

                read:
                  false,

                created_at:
                  new Date().toISOString(),
              },
            ])
        } catch (notificationError) {
          console.error(
            'NOWPayments notification error:',
            notificationError,
          )
        }
      }

      if (
        paymentStatus === 'failed'
      ) {
        try {
          await supabase
            .from('notifications')
            .insert([
              {
                user_id:
                  order.user_id,

                type:
                  'payment',

                message:
                  `Payment for order #${orderId} failed or expired.`,

                read:
                  false,

                created_at:
                  new Date().toISOString(),
              },
            ])
        } catch (notificationError) {
          console.error(
            'NOWPayments notification error:',
            notificationError,
          )
        }
      }

      if (
        paymentStatus ===
        'refunded'
      ) {
        try {
          await supabase
            .from('notifications')
            .insert([
              {
                user_id:
                  order.user_id,

                type:
                  'payment',

                message:
                  `Payment for order #${orderId} has been refunded.`,

                read:
                  false,

                created_at:
                  new Date().toISOString(),
              },
            ])
        } catch (notificationError) {
          console.error(
            'NOWPayments notification error:',
            notificationError,
          )
        }
      }

      // ========================================================
      // Success
      // ========================================================

      return res.status(200).json({
        success: true,

        order_id:
          orderId,

        payment_id:
          paymentId,

        payment_status:
          payload.payment_status ||
          null,

        internal_status:
          paymentStatus,

        updated:
          true,

        order:
          updatedOrder,
      })
    } catch (error) {
      console.error(
        'NOWPayments IPN error:',
        error,
      )

      return res.status(
        Number(error?.status) >= 400
          ? Number(error.status)
          : 500,
      ).json({
        success: false,
        message:
          error?.message ||
          'NOWPayments IPN processing failed',
      })
    }
  },
)

// ============================================================
// Export
// ============================================================

module.exports = router