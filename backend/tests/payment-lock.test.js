process.env.NOWPAYMENTS_IPN_SECRET_KEY = 'unit-test-ipn-secret-key'

const express = require('express')
const request = require('supertest')

jest.mock('../src/config/supabase.config', () => {
  const state = {
    order: {
      id: 'order-1',
      user_id: 'user-1',
      workspace_id: null,
      amount: '149.00',
      price: '149.00',
      payment_status: 'pending',
      status: 'new',
      payment_provider: 'nowpayments',
      network: 'bsc',
      currency: 'USDC',
      nowpayments_creating_lock: false,
      nowpayments_last_ipn_at: null,
      payment_url: null,
      nowpayments_invoice_id: null,
      nowpayments_payment_id: null,
      nowpayments_purchase_id: null,
      nowpayments_pay_address: null,
      nowpayments_pay_currency: null,
      nowpayments_pay_amount: null,
      nowpayments_price_amount: null,
      nowpayments_price_currency: null,
      nowpayments_status: null,
    },
    lockResult: { data: null, error: null },
    releaseError: null,
    throwOnLock: false,
    events: [],
    notifications: [],
    updateOperations: [],
    serviceCatalog: [],
    createdOrders: [],
  }

  const resetState = (overrides = {}) => {
    state.order = {
      id: 'order-1',
      user_id: 'user-1',
      workspace_id: null,
      amount: '149.00',
      price: '149.00',
      payment_status: 'pending',
      status: 'new',
      payment_provider: 'nowpayments',
      network: 'bsc',
      currency: 'USDC',
      nowpayments_creating_lock: false,
      nowpayments_last_ipn_at: null,
      payment_url: null,
      nowpayments_invoice_id: null,
      nowpayments_payment_id: null,
      nowpayments_purchase_id: null,
      nowpayments_pay_address: null,
      nowpayments_pay_currency: null,
      nowpayments_pay_amount: null,
      nowpayments_price_amount: null,
      nowpayments_price_currency: null,
      nowpayments_status: null,
      ...overrides,
    }
    state.lockResult = { data: null, error: null }
    state.releaseError = null
    state.throwOnLock = false
    state.throwOnRelease = false
    state.persistError = null
    state.events = []
    state.notifications = []
    state.updateOperations = []
    state.serviceCatalog = []
    state.createdOrders = []
  }

  const evaluateQuery = (query) => {
    const { table, kind, filters, guards, updates, rows } = query

    if (table === 'orders') {
      if (kind === 'insert') {
        const insertedOrder = {
          id: 'created-order-1',
          ...rows[0],
        }
        state.createdOrders.push(insertedOrder)
        return { data: insertedOrder, error: null }
      }

      if (kind === 'select') {
        if (
          filters.id !== undefined &&
          String(state.order.id) === String(filters.id)
        ) {
          return { data: { ...state.order }, error: null }
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

        if (state.throwOnLock && updates.nowpayments_creating_lock === true) {
          throw new Error('connection failure')
        }

        const isLockAcquire =
          updates.nowpayments_creating_lock === true &&
          guards.some(([column]) => column === 'nowpayments_creating_lock')

        if (isLockAcquire) {
          if (state.lockResult.error) {
            const result = { ...state.lockResult }
            state.lockResult = { data: null, error: null }
            state.updateOperations.push({ matched: false, guards })
            return result
          }
          if (state.order.nowpayments_creating_lock !== false) {
            state.updateOperations.push({ matched: false, guards })
            return {
              data: null,
              error: { code: 'PGRST116', message: 'multiple (or no) rows' },
            }
          }
          Object.assign(state.order, updates)
          state.updateOperations.push({ matched: true, guards, updates })
          return { data: { ...state.order }, error: null }
        }

        if (
          updates.nowpayments_creating_lock === false &&
          guards.length === 0
        ) {
          if (state.throwOnRelease) {
            const err = new Error('release exception')
            state.throwOnRelease = false
            throw err
          }
          if (state.releaseError) {
            const err = state.releaseError
            state.releaseError = null
            return { data: null, error: err }
          }
          Object.assign(state.order, updates)
          state.updateOperations.push({ matched: true, guards, updates })
          return { data: { ...state.order }, error: null }
        }

        if (updates.payment_provider !== undefined) {
          if (state.persistError) {
            const err = state.persistError
            state.persistError = null
            return { data: null, error: err }
          }
          Object.assign(state.order, updates)
          state.updateOperations.push({ matched: true, guards, updates })
          return { data: { ...state.order }, error: null }
        }

        Object.assign(state.order, updates)
        state.updateOperations.push({ matched: true, guards, updates })
        return { data: { ...state.order }, error: null }
      }
    }

    if (table === 'services' && kind === 'select') {
      const matchingServices = state.serviceCatalog.filter(
        (item) =>
          (filters.id === undefined ||
            String(item.id) === String(filters.id)) &&
          (filters.name === undefined ||
            item.name === filters.name) &&
          item.is_active === true,
      )
      return {
        data: filters.id === undefined
          ? matchingServices
          : matchingServices[0] || null,
        error: null,
      }
    }

    if (table === 'order_events' && kind === 'insert') {
      for (const row of rows) state.events.push(row)
      return { data: rows, error: null }
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
    }

    const builder = {
      select() {
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
      is(column, value) {
        query.guards.push([column, value])
        return builder
      },
      or() {
        return builder
      },
      gte(column, value) {
        query.gte = { ...query.gte, [column]: value }
        return builder
      },
      maybeSingle() {
        return Promise.resolve(evaluateQuery(query))
      },
      single() {
        return Promise.resolve(evaluateQuery(query))
      },
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
    __setLockResult: (result) => {
      state.lockResult = result
    },
    __setReleaseError: (err) => {
      state.releaseError = err
    },
    __setThrowOnLock: (val) => {
      state.throwOnLock = val
    },
    __setThrowOnRelease: (val) => {
      state.throwOnRelease = val
    },
    __setPersistError: (err) => {
      state.persistError = err
    },
  }
})

jest.mock('../src/api/middleware/auth.middleware', () => ({
  authenticate: (req, res, next) => {
    req.user = {
      id: 'user-1',
      email: 'user@example.com',
      role: 'client',
      workspace_id: null,
    }
    next()
  },
  authorize: () => (req, res, next) => next(),
}))

jest.mock('../src/services/nowpayments.service', () => ({
  createInvoice: jest.fn(),
}))

const mockSupabase = require('../src/config/supabase.config')
const mockNowPayments = require('../src/services/nowpayments.service')
const router = require('../src/api/routes/orders.routes')

const app = express()
app.use(express.json())
app.use('/api/orders', router)

const postCreatePayment = (orderId, body = {}) =>
  request(app)
    .post(`/api/orders/${orderId}/create-payment`)
    .send(body)

const postCreateOrder = (body) =>
  request(app)
    .post('/api/orders')
    .send(body)

const mockInvoice = {
  id: 'np-inv-1',
  invoice_id: 'inv-1',
  payment_id: 'pay-1',
  purchase_id: 'purch-1',
  invoice_url: 'https://np.example/invoice/inv-1',
  pay_address: '0xADDR',
  pay_amount: '149.00',
  pay_currency: 'usdcbsc',
  price_amount: '149.00',
  price_currency: 'usd',
  payment_status: 'waiting',
  created_at: new Date().toISOString(),
}

beforeEach(() => {
  mockSupabase.__reset()
  mockNowPayments.createInvoice.mockReset()
  mockSupabase.__setThrowOnLock(false)
})

describe('Payment creation lock — fail-closed behavior', () => {
  test('does not create a one-time order for a recurring subscription service', async () => {
    mockSupabase.__state.serviceCatalog = [{
      id: 7,
      name: 'Life Plan',
      price: 49,
      is_active: true,
      metadata: { service_type: 'signature_subscription' },
    }]

    const response = await postCreateOrder({ service_id: 7 })

    expect(response.statusCode).toBe(409)
    expect(response.body.code).toBe('SUBSCRIPTION_CHECKOUT_UNAVAILABLE')
    expect(mockSupabase.__state.createdOrders).toHaveLength(0)
    expect(mockNowPayments.createInvoice).not.toHaveBeenCalled()
  })

  test('does not create or reuse payment for an existing subscription service order', async () => {
    mockSupabase.__state.order = {
      ...mockSupabase.__state.order,
      service: 'Life Plan',
      package_id: null,
    }
    mockSupabase.__state.serviceCatalog = [{
      name: 'Life Plan',
      is_active: true,
      metadata: { service_type: 'signature_subscription' },
    }]

    const response = await postCreatePayment('order-1')

    expect(response.statusCode).toBe(409)
    expect(response.body.code).toBe('SUBSCRIPTION_CHECKOUT_UNAVAILABLE')
    expect(mockSupabase.__state.updateOperations).toHaveLength(0)
    expect(mockNowPayments.createInvoice).not.toHaveBeenCalled()
  })

  test('lock acquired: invoice creation proceeds, lock released on success', async () => {
    mockNowPayments.createInvoice.mockResolvedValue(mockInvoice)

    const res = await postCreatePayment('order-1')

    expect(res.statusCode).toBe(201)
    expect(mockNowPayments.createInvoice).toHaveBeenCalledTimes(1)
    expect(mockSupabase.__state.order.nowpayments_creating_lock).toBe(false)
    expect(mockSupabase.__state.order.payment_url).toBe(
      mockInvoice.invoice_url,
    )
  })

  test('normal contention with existing invoice: existing invoice reused, no new creation', async () => {
    mockSupabase.__reset({
      payment_url: 'https://existing.invoice',
      nowpayments_status: 'new',
    })
    mockSupabase.__setLockResult({
      data: null,
      error: { code: 'PGRST116', message: 'multiple (or no) rows' },
    })

    const res = await postCreatePayment('order-1')

    expect(res.statusCode).toBe(200)
    expect(mockNowPayments.createInvoice).not.toHaveBeenCalled()
    expect(res.body.invoice_url).toBe('https://existing.invoice')
  })

  test('normal contention without existing invoice: returns 423', async () => {
    mockSupabase.__setLockResult({
      data: null,
      error: { code: 'PGRST116', message: 'multiple (or no) rows' },
    })

    const res = await postCreatePayment('order-1')

    expect(res.statusCode).toBe(423)
    expect(res.body.code).toBe('PAYMENT_CREATION_IN_PROGRESS')
    expect(mockNowPayments.createInvoice).not.toHaveBeenCalled()
  })

  test('non-contention lock error: returns 500 PAYMENT_LOCK_UNAVAILABLE, invoice never created', async () => {
    mockSupabase.__setLockResult({
      data: null,
      error: {
        code: '42P01',
        message: 'column "nowpayments_creating_lock" does not exist',
      },
    })

    const res = await postCreatePayment('order-1')

    expect(res.statusCode).toBe(500)
    expect(res.body.code).toBe('PAYMENT_LOCK_UNAVAILABLE')
    expect(mockNowPayments.createInvoice).not.toHaveBeenCalled()
  })

  test('non-contention lock error: does not expose raw database error to client', async () => {
    mockSupabase.__setLockResult({
      data: null,
      error: {
        code: '42501',
        message: 'permission denied for table orders',
        details: 'internal schema info',
      },
    })

    const res = await postCreatePayment('order-1')

    expect(res.statusCode).toBe(500)
    expect(res.body.code).toBe('PAYMENT_LOCK_UNAVAILABLE')
    expect(res.body.message).not.toContain('permission denied')
    expect(res.body.message).not.toContain('schema')
    expect(mockNowPayments.createInvoice).not.toHaveBeenCalled()
  })

  test('thrown connection exception: fails closed, invoice never created', async () => {
    mockSupabase.__setThrowOnLock(true)

    const res = await postCreatePayment('order-1')

    expect(res.statusCode).toBe(500)
    expect(mockNowPayments.createInvoice).not.toHaveBeenCalled()
  })

  test('lock release failure: still reports 201, lock not released', async () => {
    mockNowPayments.createInvoice.mockResolvedValue(mockInvoice)
    mockSupabase.__setReleaseError({ message: 'release failed' })

    const res = await postCreatePayment('order-1')

    expect(res.statusCode).toBe(201)
    expect(mockNowPayments.createInvoice).toHaveBeenCalledTimes(1)
    expect(mockSupabase.__state.order.nowpayments_creating_lock).toBe(true)
  })

  test('release succeeds after successful invoice persistence: lock released, lockReleaseFailed false', async () => {
    mockNowPayments.createInvoice.mockResolvedValue(mockInvoice)

    const res = await postCreatePayment('order-1')

    expect(res.statusCode).toBe(201)
    expect(mockNowPayments.createInvoice).toHaveBeenCalledTimes(1)
    expect(mockSupabase.__state.order.nowpayments_creating_lock).toBe(false)
    expect(res.body.lockReleaseFailed).toBe(false)
  })

  test('release returns database error after successful invoice persistence: 201, lockReleaseFailed true, lock stuck', async () => {
    mockNowPayments.createInvoice.mockResolvedValue(mockInvoice)
    mockSupabase.__setReleaseError({ message: 'release failed' })

    const res = await postCreatePayment('order-1')

    expect(res.statusCode).toBe(201)
    expect(mockNowPayments.createInvoice).toHaveBeenCalledTimes(1)
    expect(res.body.lockReleaseFailed).toBe(true)
    expect(mockSupabase.__state.order.nowpayments_creating_lock).toBe(true)
  })

  test('release throws exception after successful invoice persistence: 201, lockReleaseFailed true, no duplicate invoice', async () => {
    mockNowPayments.createInvoice.mockResolvedValue(mockInvoice)
    mockSupabase.__setThrowOnRelease(true)

    const res = await postCreatePayment('order-1')

    expect(res.statusCode).toBe(201)
    expect(mockNowPayments.createInvoice).toHaveBeenCalledTimes(1)
    expect(res.body.lockReleaseFailed).toBe(true)
    expect(mockSupabase.__state.order.nowpayments_creating_lock).toBe(true)
  })

  test('release fails in catch/error path: error response, lockReleaseFailed true, lock stuck, no duplicate invoice', async () => {
    mockNowPayments.createInvoice.mockRejectedValue(new Error('provider timeout'))
    mockSupabase.__setReleaseError({ message: 'release failed' })

    const res = await postCreatePayment('order-1')

    expect(res.statusCode).toBe(500)
    expect(mockNowPayments.createInvoice).toHaveBeenCalledTimes(1)
    expect(res.body.lockReleaseFailed).toBe(true)
    expect(mockSupabase.__state.order.nowpayments_creating_lock).toBe(true)
  })

  test('invoice persistence fails after provider invoice creation: error response, createInvoice called once, lock released', async () => {
    mockNowPayments.createInvoice.mockResolvedValue(mockInvoice)
    mockSupabase.__setPersistError({ message: 'persist failed' })

    const res = await postCreatePayment('order-1')

    expect(res.statusCode).toBe(500)
    expect(mockNowPayments.createInvoice).toHaveBeenCalledTimes(1)
    expect(mockSupabase.__state.order.nowpayments_creating_lock).toBe(false)
    expect(res.body.lockReleaseFailed).toBe(false)
  })

  test('subsequent request after release failure reuses persisted invoice without duplicate creation', async () => {
    mockNowPayments.createInvoice.mockResolvedValue(mockInvoice)
    mockSupabase.__setReleaseError({ message: 'release failed' })

    const first = await postCreatePayment('order-1')

    expect(first.statusCode).toBe(201)
    expect(mockSupabase.__state.order.nowpayments_creating_lock).toBe(true)
    expect(first.body.invoice_url).toBe(mockInvoice.invoice_url)

    const second = await postCreatePayment('order-1')

    expect(second.statusCode).toBe(200)
    expect(mockNowPayments.createInvoice).toHaveBeenCalledTimes(1)
    expect(second.body.invoice_url).toBe(mockInvoice.invoice_url)
  })

  test('release DB error log includes order id (success path)', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockNowPayments.createInvoice.mockResolvedValue(mockInvoice)
    mockSupabase.__setReleaseError({ message: 'release failed' })

    const res = await postCreatePayment('order-1')

    expect(res.statusCode).toBe(201)
    expect(res.body.lockReleaseFailed).toBe(true)
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('order-1'),
      expect.anything(),
    )
    errorSpy.mockRestore()
  })

  test('release exception log includes order id (success path)', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockNowPayments.createInvoice.mockResolvedValue(mockInvoice)
    mockSupabase.__setThrowOnRelease(true)

    const res = await postCreatePayment('order-1')

    expect(res.statusCode).toBe(201)
    expect(res.body.lockReleaseFailed).toBe(true)
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('order-1'),
      expect.anything(),
    )
    errorSpy.mockRestore()
  })

  test('release DB error log includes order id (catch path)', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockNowPayments.createInvoice.mockRejectedValue(new Error('provider timeout'))
    mockSupabase.__setReleaseError({ message: 'release failed' })

    const res = await postCreatePayment('order-1')

    expect(res.statusCode).toBe(500)
    expect(res.body.lockReleaseFailed).toBe(true)
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('order-1'),
      expect.anything(),
    )
    errorSpy.mockRestore()
  })

  test('release exception log includes order id (catch path)', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockNowPayments.createInvoice.mockRejectedValue(new Error('provider timeout'))
    mockSupabase.__setThrowOnRelease(true)

    const res = await postCreatePayment('order-1')

    expect(res.statusCode).toBe(500)
    expect(res.body.lockReleaseFailed).toBe(true)
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('order-1'),
      expect.anything(),
    )
    errorSpy.mockRestore()
  })
})
