'use strict'

const {
  LocalMockAdapter,
  PaymentProvider,
  CRMProvider,
  CommunicationProvider,
  ProjectManagementProvider,
  StorageProvider,
  IdentityProvider,
  NotificationProvider,
  NamedLocalAdapters,
} = require('../../src/future/adapters')

const context = { tenantId: 'tenant-a', actorId: 'actor-a' }

describe('Future integration adapter contracts', () => {
  test('named provider adapters are local and disabled by default', () => {
    const adapters = new NamedLocalAdapters()
    expect(Object.keys(adapters.status())).toHaveLength(10)
    expect(Object.values(adapters.status()).every((status) => status === 'not-configured')).toBe(true)
  })

  test('local mock adapter can be enabled explicitly without network calls', async () => {
    const adapter = new LocalMockAdapter('local-test', { enabled: true, responses: { ping: { ok: true } } })
    await expect(adapter.call(context, 'ping', { value: 1 })).resolves.toEqual({ adapter: 'local-test', operation: 'ping', accepted: true, providerCall: false, result: { ok: true } })
    expect(adapter.calls).toHaveLength(1)
    await expect(adapter.call(null, 'ping')).rejects.toThrow('TENANT_CONTEXT_REQUIRED')
  })

  test.each([
    [PaymentProvider, 'authorize', 'PAYMENT_ADAPTER_NOT_CONFIGURED'],
    [CRMProvider, 'upsertContact', 'CRM_ADAPTER_NOT_CONFIGURED'],
    [CommunicationProvider, 'send', 'COMMUNICATION_ADAPTER_NOT_CONFIGURED'],
    [ProjectManagementProvider, 'createTask', 'PROJECT_ADAPTER_NOT_CONFIGURED'],
    [StorageProvider, 'putObject', 'STORAGE_ADAPTER_NOT_CONFIGURED'],
    [IdentityProvider, 'authorize', 'IDENTITY_ADAPTER_NOT_CONFIGURED'],
    [NotificationProvider, 'send', 'NOTIFICATION_ADAPTER_NOT_CONFIGURED'],
  ])('%p remains safe until configured', async (Provider, method, error) => {
    await expect(new Provider()[method](context, {})).rejects.toThrow(error)
  })
})
