'use strict'

/**
 * @typedef {Object} TenantContext
 * @property {string} tenantId
 * @property {string} actorId
 * @property {string[]} [permissions]
 */

/**
 * @typedef {Object} Repository
 * @property {(context: TenantContext, record: Object) => Object} save
 * @property {(context: TenantContext, id: string) => Object|null} findById
 * @property {(context: TenantContext, predicate?: Function) => Object[]} list
 * @property {(context: TenantContext, id: string) => boolean} delete
 */

/**
 * @typedef {Object} AIProvider
 * @property {string} name
 * @property {(request: Object) => Promise<Object>} complete
 */

/** @typedef {{name: string, permissions?: string[], requiresApproval?: boolean, handler: Function}} Tool */
/** @typedef {{id?: string, version?: number, steps: Object[]}} WorkflowDefinition */
/** @typedef {{health: Function, enabled?: boolean}} IntegrationAdapter */
/** @typedef {{health: Function, authorize: Function, capture: Function, refund: Function}} PaymentProvider */
/** @typedef {{health: Function, authorize: Function}} IdentityProvider */
/** @typedef {{plan: Function, provision?: Function, destroy?: Function}} CloudProvider */
/** @typedef {{health: Function, send: Function}} NotificationProvider */

module.exports = {}
