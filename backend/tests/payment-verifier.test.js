const { verifyPolygonUsdcPayment, getPaymentConfig, ERC20_TRANSFER_TOPIC } = require('../src/services/payment-verifier')

const txid = `0x${'1'.repeat(64)}`
const token = '0x1111111111111111111111111111111111111111'
const recipient = '0x2222222222222222222222222222222222222222'
const recipientTopic = `0x${recipient.slice(2).padStart(64, '0')}`
const config = { network: 'polygon', currency: 'USDC', rpcUrl: 'https://rpc.test', tokenAddress: token, recipientAddress: recipient, confirmations: 2, decimals: 6 }
const response = (result) => ({ ok: true, json: async () => ({ jsonrpc: '2.0', result }) })

const fetchFor = (logs, latest = '0x66') => jest.fn(async (_url, options) => {
  const { method } = JSON.parse(options.body)
  if (method === 'eth_chainId') return response('0x89')
  if (method === 'eth_getTransactionByHash') return response({ blockNumber: '0x64', to: token })
  if (method === 'eth_getTransactionReceipt') return response({ status: '0x1', blockNumber: '0x64', logs })
  if (method === 'eth_blockNumber') return response(latest)
  throw new Error(`unexpected RPC method ${method}`)
})
const transfer = (amount = '0xf4240', to = recipientTopic) => ({ address: token, topics: [ERC20_TRANSFER_TOPIC, `0x${'3'.repeat(64)}`, to], data: amount })

describe('Polygon USDC payment verification', () => {
  test('accepts exact finalized transfer', async () => {
    const result = await verifyPolygonUsdcPayment({ transactionId: txid, expectedAmount: '1.00', config, fetchImpl: fetchFor([transfer()]) })
    expect(result.ok).toBe(true)
    expect(result.amountUnits).toBe('1000000')
  })

  test.each([
    ['invalid transaction id', { transactionId: 'not-a-hash', expectedAmount: '1.00' }, 'INVALID_TRANSACTION_ID'],
    ['wrong recipient', { transactionId: txid, expectedAmount: '1.00', logs: [transfer('0xf4240', `0x${'4'.repeat(64)}`)] }, 'PAYMENT_MISMATCH'],
    ['wrong amount', { transactionId: txid, expectedAmount: '2.00', logs: [transfer()] }, 'PAYMENT_MISMATCH'],
    ['unconfirmed', { transactionId: txid, expectedAmount: '1.00', latest: '0x64' }, 'TRANSACTION_UNCONFIRMED'],
    ['duplicate matching transfers', { transactionId: txid, expectedAmount: '1.00', logs: [transfer(), transfer()] }, 'PAYMENT_AMBIGUOUS'],
  ])('%s transaction', async (_name, input, code) => {
    const result = await verifyPolygonUsdcPayment({ transactionId: input.transactionId, expectedAmount: input.expectedAmount, config, fetchImpl: fetchFor(input.logs || [transfer()], input.latest || '0x66') })
    expect(result.ok).toBe(false)
    expect(result.code).toBe(code)
  })

  test('fails closed when verifier configuration is missing', async () => {
    const result = await verifyPolygonUsdcPayment({ transactionId: txid, expectedAmount: '1.00', config: null })
    expect(result).toEqual(expect.objectContaining({ ok: false, code: 'PAYMENT_VERIFIER_UNCONFIGURED' }))
  })

  test.each(['0', '-1', '2.5', 'not-a-number'])('rejects invalid confirmation setting %s', (confirmations) => {
    expect(getPaymentConfig({
      WEB3_NETWORK: 'polygon',
      WEB3_RPC_URL: 'https://rpc.test',
      USDC_CONTRACT_ADDRESS: token,
      WEB3_RECIPIENT_ADDRESS: recipient,
      WEB3_REQUIRED_CONFIRMATIONS: confirmations,
    })).toBeNull()
  })

  test('defaults missing confirmation setting to twelve blocks', () => {
    expect(getPaymentConfig({
      WEB3_NETWORK: 'polygon',
      WEB3_RPC_URL: 'https://rpc.test',
      USDC_CONTRACT_ADDRESS: token,
      WEB3_RECIPIENT_ADDRESS: recipient,
    })).toEqual(expect.objectContaining({ confirmations: 12 }))
  })
})
