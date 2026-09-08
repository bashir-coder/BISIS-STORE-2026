'use strict'

/** STATUS: FUTURE INTEGRATIONS DOMAIN — DISABLED BY DEFAULT — NOT PART OF V1 ROUTES. */

const { IntegrationRegistry } = require('../core')
const { LocalMockAdapter, PaymentProvider, CRMProvider, CommunicationProvider, ProjectManagementProvider, StorageProvider, IdentityProvider, NotificationProvider, NamedLocalAdapters } = require('../adapters')

module.exports = { IntegrationRegistry, LocalMockAdapter, PaymentProvider, CRMProvider, CommunicationProvider, ProjectManagementProvider, StorageProvider, IdentityProvider, NotificationProvider, NamedLocalAdapters }
