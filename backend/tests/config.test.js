const express = require('express')
const request = require('supertest')

jest.mock('../src/services/payment-verifier', () => ({
  getPaymentConfig: jest.fn(() => ({ network: 'bsc', currency: 'USDC' })),
}))

const router = require('../src/api/routes/config.routes')

const app = express()
app.use('/api/config', router)

describe('Config', () => {
  test('wallet-address returns config', async () => {
    process.env.WEB3_RECIPIENT_ADDRESS = '0xTEST'
    const res = await request(app).get('/api/config/wallet-address')
    expect(res.status).toBe(200)
    expect(res.body.network).toBe('bsc')
    expect(res.body.address).toBe('0xTEST')
  })
})
