'use strict'

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
