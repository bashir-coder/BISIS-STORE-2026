'use strict'

const fs = require('fs')
const path = require('path')
const https = require('https')
const http = require('http')
const futureRoot = path.resolve(__dirname, '../../src/future')

function sourceFiles() {
  return fs.readdirSync(futureRoot, { recursive: true })
    .filter((file) => /\.(js|ts|tsx)$/.test(file))
    .map((file) => path.join(futureRoot, file))
}

describe('Future Core architecture contract', () => {
  test('all focused domain barrels are importable from the root', () => {
    const root = require('../../src/future')
    const domains = ['shared', 'ai', 'workflows', 'crm', 'finance', 'analytics', 'automation', 'security', 'enterprise', 'marketplace', 'integrations', 'cloud', 'decision', 'reporting']
    for (const domain of domains) expect(root.domains[domain]).toBeDefined()
  })

  test('future source has no V1 server/routes or production secret imports', () => {
    const source = sourceFiles().map((file) => fs.readFileSync(file, 'utf8')).join('\n')
    expect(source).not.toMatch(/require\(['"].*server(?:\.js)?['"]\)/)
    expect(source).not.toMatch(/require\(['"].*src\/api\/routes/)
    expect(source).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|SUPABASE_URL|dotenv/)
  })

  test('local provider performs no network calls', async () => {
    const originalHttp = http.request
    const originalHttps = https.request
    const fail = () => { throw new Error('NETWORK_CALL_NOT_ALLOWED_IN_LOCAL_PROVIDER') }
    http.request = fail
    https.request = fail
    try {
      const { LocalProvider } = require('../../src/future/ai')
      const result = await new LocalProvider().complete({ prompt: 'local test' })
      expect(result.provider).toBe('local-deterministic')
      expect(result.usage.estimatedCost).toBe(0)
    } finally {
      http.request = originalHttp
      https.request = originalHttps
    }
  })

  test('future remains disabled unless explicitly enabled', () => {
    const { FUTURE_ENABLED, assertFutureEnabled } = require('../../src/future')
    expect(FUTURE_ENABLED).toBe(false)
    expect(() => assertFutureEnabled()).toThrow('FUTURE_FEATURE_DISABLED')
  })
})
