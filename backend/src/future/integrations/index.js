'use strict'

const { IntegrationRegistry } = require('../core')
const { LocalMockAdapter, PaymentProvider, CRMProvider, CommunicationProvider, ProjectManagementProvider, StorageProvider, IdentityProvider, NotificationProvider, NamedLocalAdapters } = require('../adapters')

module.exports = { IntegrationRegistry, LocalMockAdapter, PaymentProvider, CRMProvider, CommunicationProvider, ProjectManagementProvider, StorageProvider, IdentityProvider, NotificationProvider, NamedLocalAdapters }
