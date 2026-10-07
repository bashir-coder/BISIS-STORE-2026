'use strict'

const { validateRequest, normalizeRequest } = require('./request')
const { getAIOSConfig, requireAIOSConfig } = require('./config')
const {
  integrationDisabled,
  configurationMissing,
  requestValidationFailed,
  transportFailure,
  timeout,
} = require('./errors')

async function sendToAIOS(request, options = {}) {
  const validation = validateRequest(request)
  if (!validation.valid) {
    const error = requestValidationFailed(
      validation.errors.join('; '),
    )
    throw error
  }

  const normalized = normalizeRequest(request, {
    correlationId: options.correlationId,
  })

  let config
  config = requireAIOSConfig(require('./errors'))

  const payload = {
    task: normalized.task,
    description: normalized.description,
    context: normalized.context,
    priority: normalized.priority,
    requested_agent: normalized.requested_agent,
    founder_approval: normalized.founder_approval,
    task_id: normalized.task_id,
    timestamp: normalized.timestamp,
    attachments: normalized.attachments,
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(
    () => controller.abort(),
    config.timeoutMs,
  )

  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const error = transportFailure(
        `HTTP ${response.status}: ${response.statusText}`,
      )
      error.status = response.status
      throw error
    }

    return {
      accepted: true,
      status: response.status,
      response_available: false,
      _correlation_id: normalized._correlation_id,
    }
  } catch (err) {
    clearTimeout(timeoutId)

    if (err.name === 'AbortError') {
      const error = timeout(
        `Request timed out after ${config.timeoutMs}ms`,
      )
      throw error
    }

    if (
      err.code === 'ECONNREFUSED' ||
      err.code === 'ENOTFOUND' ||
      err.code === 'EAI_AGAIN' ||
      err.code === 'ECONNRESET'
    ) {
      const error = transportFailure(
        err.message || 'Network failure',
      )
      throw error
    }

    if (err.status && err.code) {
      throw err
    }

    const error = transportFailure(
      err.message || 'Unknown transport error',
    )
    throw error
  }
}

module.exports = {
  sendToAIOS,
}
