'use strict'

const { assertTenantContext } = require('./core')

class LocalMockAdapter {
  constructor(name, { enabled = false, responses = {} } = {}) {
    this.name = name
    this.enabled = enabled
    this.responses = { ...responses }
    this.calls = []
  }
  health() { return this.enabled ? 'local-ready' : 'not-configured' }
  async call(context, operation, input = {}) {
    assertTenantContext(context)
    if (!this.enabled) throw new Error('ADAPTER_DISABLED')
    this.calls.push({ operation, input })
    return { adapter: this.name, operation, accepted: true, providerCall: false, result: this.responses[operation] || null }
  }
}

class PaymentProvider {
  health() { return 'interface-only' }
  async authorize() { throw new Error('PAYMENT_ADAPTER_NOT_CONFIGURED') }
  async capture() { throw new Error('PAYMENT_ADAPTER_NOT_CONFIGURED') }
  async refund() { throw new Error('PAYMENT_ADAPTER_NOT_CONFIGURED') }
}

class CRMProvider {
  health() { return 'interface-only' }
  async upsertContact() { throw new Error('CRM_ADAPTER_NOT_CONFIGURED') }
}

class CommunicationProvider {
  health() { return 'interface-only' }
  async send() { throw new Error('COMMUNICATION_ADAPTER_NOT_CONFIGURED') }
}

class ProjectManagementProvider {
  health() { return 'interface-only' }
  async createTask() { throw new Error('PROJECT_ADAPTER_NOT_CONFIGURED') }
}

class StorageProvider {
  health() { return 'interface-only' }
  async putObject() { throw new Error('STORAGE_ADAPTER_NOT_CONFIGURED') }
  async getSignedUrl() { throw new Error('STORAGE_ADAPTER_NOT_CONFIGURED') }
}

class IdentityProvider {
  health() { return 'interface-only' }
  async authorize() { throw new Error('IDENTITY_ADAPTER_NOT_CONFIGURED') }
}

class NotificationProvider {
  health() { return 'interface-only' }
  async send() { throw new Error('NOTIFICATION_ADAPTER_NOT_CONFIGURED') }
}

class NamedLocalAdapters {
  constructor() {
    this.stripe = new LocalMockAdapter('stripe')
    this.paypal = new LocalMockAdapter('paypal')
    this.microsoft = new LocalMockAdapter('microsoft')
    this.slack = new LocalMockAdapter('slack')
    this.discord = new LocalMockAdapter('discord')
    this.notion = new LocalMockAdapter('notion')
    this.github = new LocalMockAdapter('github')
    this.jira = new LocalMockAdapter('jira')
    this.hubspot = new LocalMockAdapter('hubspot')
    this.salesforce = new LocalMockAdapter('salesforce')
  }
  status() { return Object.fromEntries(Object.entries(this).map(([name, adapter]) => [name, adapter.health()])) }
}

module.exports = {
  LocalMockAdapter,
  PaymentProvider,
  CRMProvider,
  CommunicationProvider,
  ProjectManagementProvider,
  StorageProvider,
  IdentityProvider,
  NotificationProvider,
  NamedLocalAdapters,
}
