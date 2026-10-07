'use strict'

/**
 * AI OS integration boundary — configuration.
 *
 * STATUS: SCAFFOLD ONLY. Not activated. No real AI OS request is made.
 *
 * Configuration follows the existing backend convention in
 * `backend/src/services/nowpayments.service.js`:
 *   const apiKey = String(process.env.NOWPAYMENTS_API_KEY || '').trim()
 *
 * The integration FAILS CLOSED when configuration is absent. No real
 * secret is stored here. No production credential is referenced.
 *
 * Environment variables (defined as isolated placeholders in
 * `.env.example`):
 *   AI_OS_ENABLED            - boolean feature flag (default false)
 *   AI_OS_WEBHOOK_URL        - external webhook URL (placeholder only)
 *   AI_OS_WEBHOOK_SECRET     - HMAC signing/verification secret (placeholder only)
 *   AI_OS_TIMEOUT_MS         - request timeout in milliseconds (default 10000)
 */

const DEFAULT_TIMEOUT_MS = 10000

function readBoolean(name, defaultValue = false) {
  const value = String(process.env[name] || '').trim().toLowerCase()
  if (value === 'true') return true
  if (value === 'false') return false
  return defaultValue
}

function readString(name) {
  const value = String(process.env[name] || '').trim()
  return value.length > 0 ? value : null
}

/**
 * Read the current AI OS integration configuration.
 *
 * @returns {{ enabled: boolean, url: string|null, secret: string|null, timeoutMs: number }}
 */
function getAIOSConfig() {
  return {
    enabled: readBoolean('AI_OS_ENABLED', false),
    url: readString('AI_OS_WEBHOOK_URL'),
    secret: readString('AI_OS_WEBHOOK_SECRET'),
    timeoutMs: readTimeoutMs(),
  }
}

function readTimeoutMs() {
  const raw = String(process.env.AI_OS_TIMEOUT_MS || '').trim()
  if (raw.length === 0) return DEFAULT_TIMEOUT_MS
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TIMEOUT_MS
  return Math.floor(parsed)
}

/**
 * Assert that the integration is configured and enabled.
 *
 * Throws a structured error (matching `nowpayments.service.js` convention)
 * when the integration is disabled or misconfigured.
 *
 * @param {{errors: any[]}} errorsModule - the AI OS errors module
 * @throws {Error} with .status and .code
 */
function requireAIOSConfig(errorsModule) {
  const config = getAIOSConfig()

  if (!config.enabled) {
    throw errorsModule.integrationDisabled()
  }

  if (!config.url) {
    throw errorsModule.configurationMissing('AI_OS_WEBHOOK_URL is not set')
  }

  return config
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  getAIOSConfig,
  requireAIOSConfig,
}