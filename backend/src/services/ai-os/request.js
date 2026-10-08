'use strict'

/**
 * AI OS integration boundary — internal request contract.
 *
 * STATUS: SCAFFOLD ONLY. Not activated. No real AI OS request is made.
 *
 * This module defines ONLY the fields that the AIOS-2 read-only audit
 * classified as VERIFIED or explicitly justified. Fields whose external
 * contract is UNKNOWN are documented as such and are NOT asserted here.
 *
 * Distinction:
 *   - Fields marked "backend-derived" are produced by the Bişiş Backend
 *     itself and are NOT part of the frozen external AI OS contract.
 *   - Fields marked "AI-OS-verified" are confirmed by the AIOS-2 audit.
 *   - Fields marked "UNKNOWN" are NOT asserted. They are reserved for
 *     future verification and default to safe values.
 *
 * Do NOT treat this module as the authoritative external contract.
 * The external contract remains UNKNOWN until explicitly verified.
 */

// Field names that the AIOS-2 audit confirmed as part of the external
// request contract. This list is intentionally minimal.
const KNOWN_REQUEST_FIELDS = Object.freeze([
  'task',
  'description',
  'context',
  'priority',
  'requested_agent',
  'founder_approval',
  'task_id',
  'timestamp',
  'attachments',
])

// Allowed priority values, matching the existing convention in
// `backend/src/api/routes/execution.routes.js:9`:
//   const priorities = ['low', 'medium', 'high', 'urgent']
const PRIORITY_VALUES = Object.freeze(['low', 'medium', 'high', 'urgent'])
const DEFAULT_PRIORITY = 'medium'

/**
 * Validate the internal request shape before any transport.
 *
 * This is a BACKEND-SIDE validation. It does NOT claim to enforce the
 * external AI OS contract; it only ensures the backend does not send
 * structurally invalid payloads.
 *
 * @param {Object} request
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateRequest(request) {
  const errors = []

  if (!request || typeof request !== 'object') {
    return { valid: false, errors: ['request must be a non-null object'] }
  }

  // task is the only REQUIRED field per AIOS-2 audit.
  if (typeof request.task !== 'string' || request.task.trim().length === 0) {
    errors.push('task must be a non-empty string')
  }

  if (request.task && request.task.trim().length > 4000) {
    errors.push('task must not exceed 4000 characters')
  }

  if (
    request.priority !== undefined &&
    !PRIORITY_VALUES.includes(request.priority)
  ) {
    errors.push(
      `priority must be one of: ${PRIORITY_VALUES.join(', ')}`,
    )
  }

  if (
    request.founder_approval !== undefined &&
    typeof request.founder_approval !== 'boolean'
  ) {
    errors.push('founder_approval must be a boolean')
  }

  if (
    request.timestamp !== undefined &&
    request.timestamp !== null &&
    typeof request.timestamp !== 'string'
  ) {
    errors.push('timestamp must be a string')
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Normalize a request into the canonical internal shape.
 *
 * Backend-derived fields (correlation_id, request_hash) are added here.
 * They are NOT part of the external AI OS contract.
 *
 * @param {Object} request
 * @param {Object} [options]
 * @param {string} [options.correlationId] - backend correlation ID
 * @returns {Object}
 */
function normalizeRequest(request, options = {}) {
  const correlationId =
    options.correlationId || `ai-os-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  return {
    // AI-OS-verified fields.
    task: typeof request.task === 'string' ? request.task.trim() : '',
    description:
      typeof request.description === 'string' ? request.description.trim() : '',
    context: request.context !== undefined ? request.context : '',
    priority:
      request.priority !== undefined &&
      PRIORITY_VALUES.includes(request.priority)
        ? request.priority
        : DEFAULT_PRIORITY,
    requested_agent:
      typeof request.requested_agent === 'string'
        ? request.requested_agent.trim()
        : undefined,
    founder_approval:
      typeof request.founder_approval === 'boolean'
        ? request.founder_approval
        : undefined,
    task_id:
      typeof request.task_id === 'string' && request.task_id.trim().length > 0
        ? request.task_id.trim()
        : undefined,
    timestamp:
      typeof request.timestamp === 'string' && request.timestamp.trim().length > 0
        ? request.timestamp
        : new Date().toISOString(),
    attachments: Array.isArray(request.attachments) ? request.attachments : undefined,

    // Backend-derived fields (NOT part of external contract).
    _correlation_id: correlationId,
    _backend_source: 'bisis-backend',
  }
}

module.exports = {
  KNOWN_REQUEST_FIELDS,
  PRIORITY_VALUES,
  DEFAULT_PRIORITY,
  validateRequest,
  normalizeRequest,
}