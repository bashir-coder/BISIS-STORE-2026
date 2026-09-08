'use strict'

/**
 * Future Core public barrel.
 * STATUS: OPT-IN ONLY — DISABLED BY DEFAULT — NOT PART OF V1 ROUTES.
 * Implementations live in focused domain modules; this file preserves the
 * existing require('../../src/future') compatibility surface.
 */

const core = require('./core')
const services = require('./services')
const adapters = require('./adapters')
const domains = {
  shared: require('./shared'),
  ai: require('./ai'),
  workflows: require('./workflows'),
  crm: require('./crm'),
  finance: require('./finance'),
  analytics: require('./analytics'),
  automation: require('./automation'),
  security: require('./security'),
  enterprise: require('./enterprise'),
  marketplace: require('./marketplace'),
  integrations: require('./integrations'),
  cloud: require('./cloud'),
  decision: require('./decision'),
  reporting: require('./reporting'),
}

module.exports = {
  ...core,
  ...services,
  ...adapters,
  domains,
}
