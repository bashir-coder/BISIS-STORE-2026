const express = require('express')
const { getPaymentConfig } = require('../../services/payment-verifier')
const router = express.Router()

// GET /api/config/wallet-address
router.get('/wallet-address', (req, res) => {
  const config = getPaymentConfig()
  if (!config) {
    return res.status(503).json({ message: 'Payment verifier is not configured', code: 'PAYMENT_VERIFIER_UNCONFIGURED' })
  }
  res.json({ address: process.env.WEB3_RECIPIENT_ADDRESS, network: config.network, currency: config.currency })
})

module.exports = router
