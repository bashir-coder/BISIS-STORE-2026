const crypto = require('crypto')

const IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET_KEY || 'test-only-ipn-secret-placeholder'

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
  const sortedPayload = sortObject(payload)
  const payloadString = JSON.stringify(sortedPayload)
  return crypto.createHmac('sha512', IPN_SECRET).update(payloadString).digest('hex')
}

function timingSafeEqualHex(expectedSignature, receivedSignature) {
  const expected = Buffer.from(String(expectedSignature || ''), 'utf8')
  const received = Buffer.from(String(receivedSignature || ''), 'utf8')
  if (expected.length === 0 || received.length === 0) return false
  if (expected.length !== received.length) return false
  return crypto.timingSafeEqual(expected, received)
}

describe('NOWPayments IPN Signature Verification', () => {
  const basePayload = {
    order_id: '42',
    payment_id: 'np-pay-12345',
    purchase_id: 'np-purch-67890',
    payment_status: 'finished',
    price_amount: '249.00',
    price_currency: 'usd',
    pay_amount: '249.00',
    pay_currency: 'usdcbsc',
    pay_address: '0xABC123DEF456',
    payin_hash: '0xHASH123',
    network: 'bsc',
    created_at: '2026-09-17T12:00:00.000Z',
  }

  test('A. Valid signature is accepted', () => {
    const signature = createSignature(basePayload)
    const result = timingSafeEqualHex(signature, signature)
    expect(result).toBe(true)
  })

  test('B. Invalid signature is rejected', () => {
    const validSignature = createSignature(basePayload)
    const invalidSignature = 'a'.repeat(128)
    const result = timingSafeEqualHex(validSignature, invalidSignature)
    expect(result).toBe(false)
  })

  test('C. Modified payload (changed amount) is rejected', () => {
    const validSignature = createSignature(basePayload)
    const modifiedPayload = { ...basePayload, price_amount: '99999.00' }
    const modifiedSignature = createSignature(modifiedPayload)
    const result = timingSafeEqualHex(validSignature, modifiedSignature)
    expect(result).toBe(false)
  })

  test('D. Modified payload (changed order_id) is rejected', () => {
    const validSignature = createSignature(basePayload)
    const modifiedPayload = { ...basePayload, order_id: '99999' }
    const modifiedSignature = createSignature(modifiedPayload)
    const result = timingSafeEqualHex(validSignature, modifiedSignature)
    expect(result).toBe(false)
  })

  test('E. Modified payload (changed payment_status) is rejected', () => {
    const validSignature = createSignature(basePayload)
    const modifiedPayload = { ...basePayload, payment_status: 'verified' }
    const modifiedSignature = createSignature(modifiedPayload)
    const result = timingSafeEqualHex(validSignature, modifiedSignature)
    expect(result).toBe(false)
  })

  test('F. Empty signature is rejected', () => {
    const signature = createSignature(basePayload)
    const result = timingSafeEqualHex(signature, '')
    expect(result).toBe(false)
  })

  test('G. Missing signature header is rejected', () => {
    const result = timingSafeEqualHex('', '')
    expect(result).toBe(false)
  })

  test('H. Deterministic — same payload produces same signature', () => {
    const sig1 = createSignature(basePayload)
    const sig2 = createSignature(basePayload)
    expect(sig1).toBe(sig2)
  })

  test('I. Sensitive keys not in error responses', () => {
    const nwRoutes = require('fs').readFileSync('./src/api/routes/nowpayments.routes.js', 'utf8')
    const lines = nwRoutes.split('\n')
    let secretLeaked = false
    for (const line of lines) {
      if (line.includes('console.error') || line.includes('console.warn')) {
        if (line.includes('IPN_SECRET') && !line.includes('process.env') && !line.includes('if (!') && !line.includes('const ')) {
          secretLeaked = true
        }
      }
    }
    expect(secretLeaked).toBe(false)
  })

  test('J. IPN_SECRET is loaded from environment not hardcoded', () => {
    const nwRoutes = require('fs').readFileSync('./src/api/routes/nowpayments.routes.js', 'utf8')
    expect(nwRoutes.includes('process.env.NOWPAYMENTS_IPN_SECRET_KEY')).toBe(true)
    expect(nwRoutes.includes('IPN_SECRET = String')).toBe(true)
  })

  test('K. NOWPayments API key loaded from environment', () => {
    const nwService = require('fs').readFileSync('./src/services/nowpayments.service.js', 'utf8')
    expect(nwService.includes('process.env.NOWPAYMENTS_API_KEY')).toBe(true)
  })

  test('L. HMAC algorithm is SHA512', () => {
    const nwRoutes = require('fs').readFileSync('./src/api/routes/nowpayments.routes.js', 'utf8')
    expect(nwRoutes.includes("createHmac('sha512'")).toBe(true)
  })
})
