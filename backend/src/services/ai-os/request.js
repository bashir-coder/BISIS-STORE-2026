'use strict'

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

const PRIORITY_VALUES = Object.freeze(['low', 'medium', 'high', 'urgent'])
const DEFAULT_PRIORITY = 'medium'

function validateRequest(request) {
  const errors = []

  if (!request || typeof request !== 'object') {
    return { valid: false, errors: ['request must be a non-null object'] }
  }


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

function normalizeRequest(request, options = {}) {
  const correlationId =
    options.correlationId || `ai-os-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  return {

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
