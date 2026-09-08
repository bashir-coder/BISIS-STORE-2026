// Ethereum uses Keccak-256 rather than standardized SHA3-256. Keep the known
// canonical topic explicit so verification does not depend on a crypto package.
const ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a9df523b3ef'
const HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/
const TX_HASH = /^0x[0-9a-fA-F]{64}$/

const getPaymentConfig = (env = process.env) => {
  const network = String(env.WEB3_NETWORK || '').toLowerCase()
  const rpcUrl = env.WEB3_RPC_URL
  const tokenAddress = env.USDC_CONTRACT_ADDRESS
  const recipientAddress = env.WEB3_RECIPIENT_ADDRESS
  const confirmations = Number(env.WEB3_REQUIRED_CONFIRMATIONS || 12)
  if (network !== 'polygon' || !rpcUrl || !HEX_ADDRESS.test(tokenAddress || '') || !HEX_ADDRESS.test(recipientAddress || '')) return null
  if (!Number.isInteger(confirmations) || confirmations < 1) return null
  return {
    network: 'polygon',
    currency: 'USDC',
    rpcUrl,
    tokenAddress: tokenAddress.toLowerCase(),
    recipientAddress: recipientAddress.toLowerCase(),
    confirmations,
    decimals: 6,
  }
}

const decimalToUnits = (value, decimals) => {
  const text = String(value)
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new Error('Invalid expected amount')
  const [whole, fraction = ''] = text.split('.')
  if (fraction.length > decimals || fraction.replace(/0+$/, '').length > decimals) throw new Error('Amount precision exceeds token decimals')
  return BigInt(whole) * (10n ** BigInt(decimals)) + BigInt((fraction + '0'.repeat(decimals)).slice(0, decimals) || 0)
}

const rpc = async (config, method, params, fetchImpl = global.fetch) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetchImpl(config.rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error('RPC request failed')
    const body = await response.json()
    if (body.error || body.jsonrpc !== '2.0') throw new Error('RPC returned an error')
    return body.result
  } finally {
    clearTimeout(timeout)
  }
}

const verifyPolygonUsdcPayment = async ({ transactionId, expectedAmount, config = getPaymentConfig(), fetchImpl }) => {
  if (!config) return { ok: false, code: 'PAYMENT_VERIFIER_UNCONFIGURED', reason: 'Payment verifier is not configured' }
  if (!TX_HASH.test(transactionId || '')) return { ok: false, code: 'INVALID_TRANSACTION_ID', reason: 'Invalid transaction ID' }

  const chainId = await rpc(config, 'eth_chainId', [], fetchImpl)
  if (String(chainId).toLowerCase() !== '0x89') return { ok: false, code: 'NETWORK_MISMATCH', reason: 'RPC endpoint is not Polygon mainnet' }
  const transaction = await rpc(config, 'eth_getTransactionByHash', [transactionId], fetchImpl)
  if (!transaction || !transaction.blockNumber || !transaction.to || transaction.to.toLowerCase() !== config.tokenAddress) {
    return { ok: false, code: 'TRANSACTION_NOT_FOUND_OR_TOKEN_MISMATCH', reason: 'Transaction is not a confirmed USDC transfer' }
  }
  const receipt = await rpc(config, 'eth_getTransactionReceipt', [transactionId], fetchImpl)
  if (!receipt || receipt.status !== '0x1' || !receipt.blockNumber) return { ok: false, code: 'TRANSACTION_UNCONFIRMED', reason: 'Transaction is not finalized' }
  const latestBlock = await rpc(config, 'eth_blockNumber', [], fetchImpl)
  const confirmations = BigInt(latestBlock) - BigInt(receipt.blockNumber) + 1n
  if (confirmations < BigInt(config.confirmations)) return { ok: false, code: 'TRANSACTION_UNCONFIRMED', reason: 'Transaction does not have enough confirmations' }

  const expectedUnits = decimalToUnits(expectedAmount, config.decimals)
  const recipientTopic = `0x${config.recipientAddress.slice(2).padStart(64, '0')}`
  const transfers = (receipt.logs || []).filter((log) =>
    log.address?.toLowerCase() === config.tokenAddress &&
    log.topics?.[0]?.toLowerCase() === ERC20_TRANSFER_TOPIC &&
    log.topics?.[2]?.toLowerCase() === recipientTopic.toLowerCase()
  )
  const matching = transfers.filter((log) => BigInt(log.data) === expectedUnits)
  if (matching.length > 1) return { ok: false, code: 'PAYMENT_AMBIGUOUS', reason: 'Transaction contains multiple matching transfers' }
  if (matching.length !== 1) return { ok: false, code: 'PAYMENT_MISMATCH', reason: 'Recipient or exact amount does not match' }
  return { ok: true, network: config.network, currency: config.currency, transactionId, confirmations: confirmations.toString(), blockNumber: receipt.blockNumber, tokenAddress: config.tokenAddress, recipientAddress: config.recipientAddress, amountUnits: expectedUnits.toString() }
}

module.exports = { getPaymentConfig, verifyPolygonUsdcPayment, decimalToUnits, ERC20_TRANSFER_TOPIC }
