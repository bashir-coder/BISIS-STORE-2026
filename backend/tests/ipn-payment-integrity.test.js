/**
 * BİŞİŞ V1 — NOWPayments IPN payment-integrity tests.
 *
 * Adversarial coverage for:
 *  - amount verification (expected vs provider-reported vs actually paid)
 *  - atomic state transitions (no verified downgrade, idempotent replay)
 *  - concurrent IPN races
 *
 * Uses an in-memory Supabase client that implements guarded
 * (CAS) update semantics so the atomicity of the route is
 * exercised without a live database.
 */

process.env.NOWPAYMENTS_IPN_SECRET_KEY = 'unit-test-ipn-secret-key'

const crypto = require('crypto')
const express = require('express')
const request = require('supertest')

jest.mock('../src/config/supabase.config', () => {
  const state = {
    order: null,
    events: [],
    notifications: [],
    updateOperations: [],
    hooks: {},
  }

  const resetState = (orderOverrides = {}) => {
    state.order = {
      id: '42',
      user_id: 'user-1',
      workspace_id: null,
      amount: '149.00',
      price: '149.00',
      payment_status: 'pending',
      status: 'new',
      payment_provider: 'nowpayments',
      network: 'bsc',
      currency: 'USDC',
      nowpayments_last_ipn_at: null,
      ...orderOverrides,
    }
    state.events = []
    state.notifications = []
    state.updateOperations = []
    state.hooks = {}
  }

  const evaluateQuery = (query) => {
    const { table, kind, filters, guards, updates, rows, gte } = query

    if (table === 'orders') {
      if (kind === 'select') {
        if (
          filters.id !== undefined &&
          String(state.order.id) === String(filters.id)
        ) {
          const data = { ...state.order }
          if (state.hooks.afterOrderRead) {
            const hook = state.hooks.afterOrderRead
            state.hooks.afterOrderRead = null
            hook()
          }
          return { data, error: null }
        }
        return { data: null, error: null }
      }

      if (kind === 'update') {
        if (
          filters.id === undefined ||
          String(state.order.id) !== String(filters.id)
        ) {
          state.updateOperations.push({ matched: false, guards })
          return { data: null, error: null }
        }

        for (const [column, excludedValue] of guards) {
          if (state.order[column] === excludedValue) {
            // Guarded CAS update matched zero rows.
            state.updateOperations.push({ matched: false, guards })
            return { data: null, error: null }
          }
        }

        Object.assign(state.order, updates)
        state.updateOperations.push({ matched: true, guards, updates })
        return { data: { ...state.order }, error: null }
      }
    }

    if (table === 'order_events') {
      if (kind === 'select') {
        const windowStart = gte.created_at
        const match = state.events.find(
          (event) =>
            String(event.order_id) === String(filters.order_id) &&
            event.event_type === filters.event_type &&
            (!windowStart || event.created_at >= windowStart),
        )
        return { data: match ? { id: match.id } : null, error: null }
      }

      if (kind === 'insert') {
        for (const row of rows) state.events.push(row)
        return { data: rows, error: null }
      }
    }

    if (table === 'notifications' && kind === 'insert') {
      for (const row of rows) state.notifications.push(row)
      return { data: rows, error: null }
    }

    return { data: null, error: null }
  }

  const createQuery = (table) => {
    const query = {
      table,
      kind: null,
      filters: {},
      guards: [],
      updates: null,
      rows: null,
      gte: {},
    }

    const builder = {
      select() {
        // In Supabase, select() after update()/insert()
        // is a RETURNING clause, not a new query kind.
        if (query.kind === null) {
          query.kind = 'select'
        }
        return builder
      },
      update(updates) {
        query.kind = 'update'
        query.updates = updates
        return builder
      },
      insert(insertRows) {
        query.kind = 'insert'
        query.rows = insertRows
        return builder
      },
      eq(column, value) {
        query.filters[column] = value
        return builder
      },
      neq(column, value) {
        query.guards.push([column, value])
        return builder
      },
      is() {
        return builder
      },
      or() {
        return builder
      },
      gte(column, value) {
        query.gte[column] = value
        return builder
      },
      maybeSingle() {
        return Promise.resolve(evaluateQuery(query))
      },
      single() {
        return Promise.resolve(evaluateQuery(query))
      },
      // Supabase query builders are thenable: awaiting
      // a chain without a terminal call executes it.
      then(onFulfilled, onRejected) {
        return Promise.resolve(
          evaluateQuery(query),
        ).then(onFulfilled, onRejected)
      },
    }

    return builder
  }

  return {
    from(table) {
      return createQuery(table)
    },
    __state: state,
    __reset: resetState,
  }
})

const mockSupabase = require('../src/config/supabase.config')
const router = require('../src/api/routes/nowpayments.routes')

const TEST_SECRET = process.env.NOWPAYMENTS_IPN_SECRET_KEY

const app = express()
app.use(express.json())
app.use('/ipn', router)

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject)
  if (value !== null && typeof value === 'object') {
    return Object.keys(value).sort().reduce((sorted, key) => {
      sorted[key] = sortObject(value[key])
      return sorted
    }, {})
  }
  return value
}

function createSignature(payload) {
  return crypto
    .createHmac('sha512', TEST_SECRET)
    .update(JSON.stringify(sortObject(payload)))
    .digest('hex')
}

function basePayload(overrides = {}) {
  return {
    order_id: '42',
    payment_id: 'np-pay-1',
    purchase_id: 'np-purch-1',
    payment_status: 'finished',
    price_amount: 149.0,
    price_currency: 'usd',
    pay_amount: 149.0,
    pay_currency: 'usdcbsc',
    pay_address: '0xABC123',
    payin_hash: '0xHASH123',
    actually_paid: 149.0,
    created_at: '2026-09-17T12:00:00.000Z',
    ...overrides,
  }
}

const postIPN = (payload, signature) =>
  request(app)
    .post('/ipn')
    .set('x-nowpayments-sig', signature || createSignature(payload))
    .send(payload)

beforeEach(() => {
  mockSupabase.__reset()
})

describe('NOWPayments IPN payment integrity', () => {
  // --------------------------------------------------------
  // Signature verification
  // --------------------------------------------------------

  test('rejects a missing IPN signature with 401', async () => {
    const payload = basePayload()
    const res = await request(app).post('/ipn').send(payload)
    expect(res.statusCode).toBe(401)
    expect(mockSupabase.__state.order.payment_status).toBe('pending')
  })

  test('rejects an invalid IPN signature with 401', async () => {
    const payload = basePayload()
    const res = await postIPN(payload, 'a'.repeat(128))
    expect(res.statusCode).toBe(401)
    expect(mockSupabase.__state.order.payment_status).toBe('pending')
  })

  // --------------------------------------------------------
  // Amount attacks
  // --------------------------------------------------------

  test('accepts a valid signature with the correct amount and verifies the order', async () => {
    const payload = basePayload()
    const res = await postIPN(payload)
    expect(res.statusCode).toBe(200)
    expect(res.body.success).toBe(true)
    expect(mockSupabase.__state.order.payment_status).toBe('verified')
    expect(mockSupabase.__state.order.txid).toBe('0xHASH123')
    expect(mockSupabase.__state.events).toHaveLength(1)
    expect(mockSupabase.__state.notifications).toHaveLength(1)
  })

  test('rejects a valid signature with a lower price_amount', async () => {
    const payload = basePayload({ price_amount: 1.0, actually_paid: 1.0 })
    const res = await postIPN(payload)
    expect(res.statusCode).toBe(400)
    expect(res.body.code).toBe('IPN_AMOUNT_MISMATCH')
    expect(mockSupabase.__state.order.payment_status).toBe('pending')
    expect(mockSupabase.__state.events).toHaveLength(0)
    expect(mockSupabase.__state.notifications).toHaveLength(0)
  })

  test('rejects a valid signature with a higher price_amount', async () => {
    const payload = basePayload({ price_amount: 9999.0, actually_paid: 9999.0 })
    const res = await postIPN(payload)
    expect(res.statusCode).toBe(400)
    expect(res.body.code).toBe('IPN_AMOUNT_MISMATCH')
    expect(mockSupabase.__state.order.payment_status).toBe('pending')
  })

  test('rejects a valid signature with a missing price_amount', async () => {
    const payload = basePayload()
    delete payload.price_amount
    const res = await postIPN(payload)
    expect(res.statusCode).toBe(400)
    expect(res.body.code).toBe('IPN_AMOUNT_MISMATCH')
    expect(mockSupabase.__state.order.payment_status).toBe('pending')
  })

  test('rejects a valid signature with a zero price_amount', async () => {
    const payload = basePayload({ price_amount: 0, actually_paid: 0 })
    const res = await postIPN(payload)
    expect(res.statusCode).toBe(400)
    expect(res.body.code).toBe('IPN_AMOUNT_MISMATCH')
    expect(mockSupabase.__state.order.payment_status).toBe('pending')
  })

  test('rejects a valid signature with a non-numeric price_amount', async () => {
    const payload = basePayload({ price_amount: 'not-a-number' })
    const res = await postIPN(payload)
    expect(res.statusCode).toBe(400)
    expect(res.body.code).toBe('IPN_AMOUNT_MISMATCH')
    expect(mockSupabase.__state.order.payment_status).toBe('pending')
  })

  test('rejects a valid signature with a missing actually_paid on a finished payment', async () => {
    const payload = basePayload()
    delete payload.actually_paid
    const res = await postIPN(payload)
    expect(res.statusCode).toBe(400)
    expect(res.body.code).toBe('IPN_PAID_AMOUNT_MISSING')
    expect(mockSupabase.__state.order.payment_status).toBe('pending')
  })

  test('rejects a valid signature with a zero actually_paid on a finished payment', async () => {
    const payload = basePayload({ actually_paid: 0 })
    const res = await postIPN(payload)
    expect(res.statusCode).toBe(400)
    expect(res.body.code).toBe('IPN_PAID_AMOUNT_MISSING')
    expect(mockSupabase.__state.order.payment_status).toBe('pending')
  })

  test('rejects a valid signature with the wrong price_currency', async () => {
    const payload = basePayload({ price_currency: 'eur' })
    const res = await postIPN(payload)
    expect(res.statusCode).toBe(400)
    expect(mockSupabase.__state.order.payment_status).toBe('pending')
  })

  test('rejects a valid signature with the wrong pay_currency', async () => {
    const payload = basePayload({ pay_currency: 'usd' })
    const res = await postIPN(payload)
    expect(res.statusCode).toBe(400)
    expect(mockSupabase.__state.order.payment_status).toBe('pending')
  })

  test('accepts an expired IPN without actually_paid and marks the order failed', async () => {
    const payload = basePayload({
      payment_status: 'expired',
      payment_id: 'np-pay-2',
      purchase_id: 'np-purch-2',
    })
    delete payload.actually_paid
    const res = await postIPN(payload)
    expect(res.statusCode).toBe(200)
    expect(mockSupabase.__state.order.payment_status).toBe('failed')
  })

  test('accepts a partially paid IPN with a positive actually_paid as submitted', async () => {
    const payload = basePayload({
      payment_status: 'partially_paid',
      actually_paid: 50.0,
    })
    const res = await postIPN(payload)
    expect(res.statusCode).toBe(200)
    expect(mockSupabase.__state.order.payment_status).toBe('submitted')
  })

  // --------------------------------------------------------
  // State attacks
  // --------------------------------------------------------

  test('allows pending to verified', async () => {
    const payload = basePayload()
    const res = await postIPN(payload)
    expect(res.statusCode).toBe(200)
    expect(mockSupabase.__state.order.payment_status).toBe('verified')
  })

  test('rejects a verified to pending downgrade', async () => {
    mockSupabase.__reset({ payment_status: 'verified' })
    const payload = basePayload({ payment_status: 'waiting' })
    delete payload.actually_paid
    const res = await postIPN(payload)
    expect(res.statusCode).toBe(200)
    expect(res.body.ignored).toBe(true)
    expect(mockSupabase.__state.order.payment_status).toBe('verified')
  })

  test('rejects a verified to confirming downgrade', async () => {
    mockSupabase.__reset({ payment_status: 'verified' })
    const payload = basePayload({
      payment_status: 'confirming',
      actually_paid: 149.0,
    })
    const res = await postIPN(payload)
    expect(res.statusCode).toBe(200)
    expect(res.body.ignored).toBe(true)
    expect(mockSupabase.__state.order.payment_status).toBe('verified')
  })

  test('treats a repeated identical finished IPN as idempotent', async () => {
    const payload = basePayload()
    const first = await postIPN(payload)
    expect(first.statusCode).toBe(200)

    const replay = await postIPN(payload)
    expect(replay.statusCode).toBe(200)
    expect(replay.body.ignored).toBe(true)

    expect(mockSupabase.__state.order.payment_status).toBe('verified')
    expect(mockSupabase.__state.events).toHaveLength(1)
    expect(mockSupabase.__state.notifications).toHaveLength(1)
  })

  test('concurrent finished and expired IPNs leave the order verified', async () => {
    const finishedPayload = basePayload()
    const expiredPayload = basePayload({
      payment_status: 'expired',
      payment_id: 'np-pay-2',
      purchase_id: 'np-purch-2',
    })
    delete expiredPayload.actually_paid

    const [finishedRes, expiredRes] = await Promise.all([
      postIPN(finishedPayload),
      postIPN(expiredPayload),
    ])

    expect(finishedRes.statusCode).toBe(200)
    expect(expiredRes.statusCode).toBe(200)
    expect(mockSupabase.__state.order.payment_status).toBe('verified')
  })

  test('applies the verified CAS guard to non-refund updates', async () => {
    const payload = basePayload()
    await postIPN(payload)

    const lastUpdate =
      mockSupabase.__state.updateOperations[
        mockSupabase.__state.updateOperations.length - 1
      ]
    expect(lastUpdate.matched).toBe(true)
    expect(lastUpdate.guards).toContainEqual(['payment_status', 'verified'])
  })

  test('allows a refund to supersede a verified order', async () => {
    mockSupabase.__reset({ payment_status: 'verified' })
    const payload = basePayload({
      payment_status: 'refunded',
      payment_id: 'np-pay-2',
      purchase_id: 'np-purch-2',
    })
    const res = await postIPN(payload)
    expect(res.statusCode).toBe(200)
    expect(mockSupabase.__state.order.payment_status).toBe('refunded')

    const lastUpdate =
      mockSupabase.__state.updateOperations[
        mockSupabase.__state.updateOperations.length - 1
      ]
    expect(lastUpdate.matched).toBe(true)
    expect(lastUpdate.guards).toHaveLength(0)
  })

  test('deduplicates the payment order event within the replay window', async () => {
    const first = basePayload({
      payment_status: 'confirming',
      actually_paid: 149.0,
    })
    const resFirst = await postIPN(first)
    expect(resFirst.statusCode).toBe(200)
    expect(mockSupabase.__state.order.payment_status).toBe('submitted')
    expect(mockSupabase.__state.events).toHaveLength(1)

    const second = basePayload({
      payment_status: 'confirming',
      payment_id: 'np-pay-2',
      purchase_id: 'np-purch-2',
      actually_paid: 149.0,
    })
    const resSecond = await postIPN(second)
    expect(resSecond.statusCode).toBe(200)
    expect(mockSupabase.__state.order.payment_status).toBe('submitted')
    expect(mockSupabase.__state.events).toHaveLength(1)
  })

  test('responds idempotently when the CAS guard blocks a lost race', async () => {
    // Simulate another request having already verified the order
    // between the route read and its guarded update.
    mockSupabase.__reset({ payment_status: 'verified' })
    const payload = basePayload()
    const res = await postIPN(payload)
    expect(res.statusCode).toBe(200)
    expect(res.body.ignored).toBe(true)
    expect(mockSupabase.__state.order.payment_status).toBe('verified')
  })

  test('acknowledges a lost CAS race without downgrading the order', async () => {
    // Simulate a concurrent IPN committing "verified"
    // between this request's read and its guarded update.
    mockSupabase.__state.hooks.afterOrderRead = () => {
      mockSupabase.__state.order.payment_status = 'verified'
    }
    const payload = basePayload()
    const res = await postIPN(payload)
    expect(res.statusCode).toBe(200)
    expect(res.body.updated).toBe(false)
    expect(res.body.reason).toBe('Order is already verified')
    expect(res.body.current_payment_status).toBe('verified')
    expect(mockSupabase.__state.order.payment_status).toBe('verified')
    // The losing request must not insert events or notifications.
    expect(mockSupabase.__state.events).toHaveLength(0)
    expect(mockSupabase.__state.notifications).toHaveLength(0)
  })
})
