'use strict'

/**
 * AI OS integration boundary — error types.
 *
 * STATUS: SCAFFOLD ONLY. Not activated. No real AI OS request is made.
 *
 * These errors follow the existing backend convention established in
 * `backend/src/services/nowpayments.service.js`:
 *   const error = new Error('message')
 *   error.status = <HTTP status>
 *   error.code = '<CODE>'
 *   throw error
 *
 * The global error handler in `backend/server.js:825-854` maps `err.status`
 * and `err.code` into the JSON response and logs `[requestId]` with the error.
 *
 * IMPORTANT: These error codes describe the INTEGRATION BOUNDARY, not the
 * external AI OS. They must not be confused with AI-OS-internal error semantics,
 * which remain UNKNOWN (see AIOS-2 audit, Section K).
 */

function makeError(message, status, code, extra) {
  const error = new Error(message)
  error.status = status
  error.code = code
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      error[key] = value
    }
  }
  return error
}

// Configuration / activation boundary.

function integrationDisabled() {
  return makeError(
    'AI OS integration is not enabled.',
    503,
    'AI_OS_INTEGRATION_DISABLED',
  )
}

function configurationMissing(detail) {
  return makeError(
    `AI OS integration is not configured: ${detail || 'missing configuration'}`,
    503,
    'AI_OS_CONFIGURATION_MISSING',
  )
}

// Request validation boundary (backend-side, before any transport).

function requestValidationFailed(detail) {
  return makeError(
    `AI OS request validation failed: ${detail || 'invalid request'}`,
    400,
    'AI_OS_REQUEST_VALIDATION_FAILED',
  )
}

// Transport boundary.

function transportFailure(detail) {
  return makeError(
    `AI OS transport failed: ${detail || 'unknown transport error'}`,
    502,
    'AI_OS_TRANSPORT_FAILURE',
  )
}

function timeout(detail) {
  return makeError(
    `AI OS request timed out: ${detail || 'timeout'}`,
    504,
    'AI_OS_TIMEOUT',
  )
}

// Response boundary.

function invalidResponse(detail) {
  return makeError(
    `AI OS returned an invalid or unrecognized response: ${detail || 'unknown response shape'}`,
    502,
    'AI_OS_INVALID_RESPONSE',
  )
}

function unauthorizedResponse(detail) {
  return makeError(
    `AI OS response signature verification failed: ${detail || 'signature mismatch'}`,
    401,
    'AI_OS_RESPONSE_UNAUTHORIZED',
  )
}

module.exports = {
  integrationDisabled,
  configurationMissing,
  requestValidationFailed,
  transportFailure,
  timeout,
  invalidResponse,
  unauthorizedResponse,
}