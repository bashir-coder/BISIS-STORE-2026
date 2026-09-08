const NOWPAYMENTS_API_URL = 'https://api.nowpayments.io'

function getApiKey() {
  const apiKey = String(
    process.env.NOWPAYMENTS_API_KEY || '',
  ).trim()

  if (!apiKey) {
    const error = new Error(
      'NOWPAYMENTS_API_KEY is not configured',
    )
    error.status = 503
    error.code = 'NOWPAYMENTS_API_KEY_MISSING'
    throw error
  }

  return apiKey
}

async function requestNowPayments(endpoint, options = {}) {
  const apiKey = getApiKey()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(
      `${NOWPAYMENTS_API_URL}${endpoint}`,
      {
        ...options,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          ...(options.headers || {}),
        },
        signal: controller.signal,
      },
    )

    const text = await response.text()

    let data = null

    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        data = {
          message: text,
        }
      }
    }

    if (!response.ok) {
      const error = new Error(
        data?.message ||
          data?.error ||
          `NOWPayments request failed with HTTP ${response.status}`,
      )

      error.status = response.status
      error.code = data?.code || null
      error.nowPaymentsResponse = data

      throw error
    }

    return data
  } finally {
    clearTimeout(timeout)
  }
}

function normalizeAmount(value) {
  const amount = Number(value)

  if (!Number.isFinite(amount) || amount <= 0) {
    const error = new Error('Invalid payment amount')
    error.status = 422
    error.code = 'INVALID_PAYMENT_AMOUNT'
    throw error
  }

  return Number(amount.toFixed(2))
}

function normalizeOrderId(value) {
  const orderId = String(value ?? '').trim()

  if (!orderId || orderId.length > 64) {
    const error = new Error('A valid orderId is required')
    error.status = 422
    error.code = 'INVALID_ORDER_ID'
    throw error
  }

  return orderId
}

async function createPayment({
  priceAmount,
  orderId,
  orderDescription,
  ipnCallbackUrl,
  customerEmail,
}) {
  const amount = normalizeAmount(priceAmount)
  const normalizedOrderId = normalizeOrderId(orderId)

  const payload = {
    price_amount: amount,
    price_currency: 'usd',
    pay_currency: 'usdcbsc',
    order_id: normalizedOrderId,
    order_description:
      orderDescription ||
      `BISIS Order ${normalizedOrderId}`,
  }

  if (
    ipnCallbackUrl &&
    typeof ipnCallbackUrl === 'string'
  ) {
    payload.ipn_callback_url = ipnCallbackUrl
  }

  if (
    customerEmail &&
    typeof customerEmail === 'string'
  ) {
    payload.customer_email = customerEmail
  }

  return requestNowPayments(
    '/v1/payment',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
}

async function createInvoice({
  priceAmount,
  orderId,
  orderDescription,
  ipnCallbackUrl,
  successUrl,
  cancelUrl,
  customerEmail,
}) {
  const amount = normalizeAmount(priceAmount)
  const normalizedOrderId = normalizeOrderId(orderId)

  const payload = {
    price_amount: amount,
    price_currency: 'usd',
    order_id: normalizedOrderId,
    order_description:
      orderDescription ||
      `BISIS Order ${normalizedOrderId}`,
  }

  if (
    ipnCallbackUrl &&
    typeof ipnCallbackUrl === 'string'
  ) {
    payload.ipn_callback_url = ipnCallbackUrl
  }

  if (
    successUrl &&
    typeof successUrl === 'string'
  ) {
    payload.success_url = successUrl
  }

  if (
    cancelUrl &&
    typeof cancelUrl === 'string'
  ) {
    payload.cancel_url = cancelUrl
  }

  if (
    customerEmail &&
    typeof customerEmail === 'string'
  ) {
    payload.customer_email = customerEmail
  }

  return requestNowPayments(
    '/v1/invoice',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
}

async function getPaymentStatus(paymentId) {
  const id = String(paymentId ?? '').trim()

  if (!id) {
    const error = new Error('Payment ID is required')
    error.status = 422
    error.code = 'PAYMENT_ID_REQUIRED'
    throw error
  }

  return requestNowPayments(
    `/v1/payment/${encodeURIComponent(id)}`,
    {
      method: 'GET',
    },
  )
}

async function getAvailableCurrencies() {
  return requestNowPayments(
    '/v1/currencies',
    {
      method: 'GET',
    },
  )
}

async function getMinimumPaymentAmount(
  currency = 'usdcbsc',
) {
  const normalizedCurrency = String(
    currency || '',
  )
    .trim()
    .toLowerCase()

  if (!normalizedCurrency) {
    const error = new Error('Currency is required')
    error.status = 422
    error.code = 'CURRENCY_REQUIRED'
    throw error
  }

  return requestNowPayments(
    `/v1/min-amount?currency_from=${encodeURIComponent(
      normalizedCurrency,
    )}`,
    {
      method: 'GET',
    },
  )
}

module.exports = {
  createPayment,
  createInvoice,
  getPaymentStatus,
  getAvailableCurrencies,
  getMinimumPaymentAmount,
}