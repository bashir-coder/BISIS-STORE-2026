'use strict'

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

function requestValidationFailed(detail) {
  return makeError(
    `AI OS request validation failed: ${detail || 'invalid request'}`,
    400,
    'AI_OS_REQUEST_VALIDATION_FAILED',
  )
}

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
