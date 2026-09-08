'use strict'

const {
  FUTURE_ENABLED,
  ScopedMemoryStore,
  LocalProvider,
  AgentExecutor,
  EvaluationEngine,
  ToolRegistry,
  WorkflowEngine,
  ClientScore,
  LeadTracker,
  NotesStore,
  FinancialLedger,
  AnalyticsEngine,
  AutomationCenter,
  WebhookVerifier,
  IntegrationRegistry,
  MarketplaceCatalog,
  CloudResourcePlanner,
  SecurityPolicy,
} = require('../../src/future')

const tenantA = { tenantId: 'tenant-a', actorId: 'actor-a', permissions: ['read:report'] }
const tenantB = { tenantId: 'tenant-b', actorId: 'actor-b', permissions: [] }

describe('Future implementation boundary', () => {
  test('future runtime remains disabled by default', () => {
    expect(FUTURE_ENABLED).toBe(false)
  })

  test('memory is tenant scoped and rejects missing context', () => {
    const memory = new ScopedMemoryStore()
    memory.put(tenantA, 'preference', { language: 'ar' })
    expect(memory.get(tenantA, 'preference').value.language).toBe('ar')
    expect(memory.get(tenantB, 'preference')).toBeNull()
    expect(() => memory.put(null, 'x', 1)).toThrow('TENANT_CONTEXT_REQUIRED')
  })
})

describe('Provider-neutral AI and approvals', () => {
  test('local provider produces deterministic evaluated plan without side effects', async () => {
    const executor = new AgentExecutor({ provider: new LocalProvider(), evaluator: new EvaluationEngine() })
    const plan = await executor.plan(tenantA, 'Summarize {{topic}}', { topic: 'V1' }, { requiredTerms: ['V1'], minimumScore: 1 })
    expect(plan.status).toBe('approval_required')
    expect(plan.evaluation.passed).toBe(true)
    expect(plan.sideEffects).toEqual([])
  })

  test('tool registry enforces approval, permission, and tenant scope', async () => {
    const registry = new ToolRegistry()
    registry.register('report', async () => ({ ok: true }), { permissions: ['read:report'] })
    await expect(registry.invoke('report', {}, tenantA)).rejects.toThrow('HUMAN_APPROVAL_REQUIRED')
    await expect(registry.invoke('report', {}, tenantB, { approved: true })).rejects.toThrow('TOOL_PERMISSION_DENIED')
    await expect(registry.invoke('report', {}, tenantA, { approved: true })).resolves.toEqual({ ok: true })
  })

  test('workflow requires approval, is idempotent, and records failure', async () => {
    const engine = new WorkflowEngine()
    const first = engine.create(tenantA, { steps: [{ type: 'safe', input: { value: 2 } }] }, 'same-key')
    expect(engine.create(tenantA, { steps: [{ type: 'safe' }] }, 'same-key').duplicate).toBe(true)
    await expect(engine.execute(tenantA, first.runId, {})).rejects.toThrow('WORKFLOW_APPROVAL_REQUIRED')
    engine.approve(tenantA, first.runId, 'Reviewed locally')
    const done = await engine.execute(tenantA, first.runId, { safe: async (input) => input.value * 2 })
    expect(done.status).toBe('completed')
    expect(done.outputs).toEqual([4])
    await expect(engine.execute(tenantB, first.runId, {})).rejects.toThrow('WORKFLOW_NOT_FOUND')
  })
})

describe('CRM, finance, analytics, and automation primitives', () => {
  test('CRM score, leads, and notes stay scoped', () => {
    expect(new ClientScore().calculate({ engagement: 1, completion: 1, recency: 1 }).band).toBe('high')
    const leads = new LeadTracker()
    leads.upsert(tenantA, { id: 'lead-1', name: 'A' })
    expect(leads.list(tenantB)).toHaveLength(0)
    const notes = new NotesStore()
    notes.add(tenantA, { clientId: 'client-1', text: 'Follow up' })
    expect(notes.list(tenantB)).toHaveLength(0)
  })

  test('financial ledger uses minor units and rejects invalid amounts', () => {
    const ledger = new FinancialLedger()
    ledger.record(tenantA, { type: 'credit', currency: 'usd', amount: 10.5 })
    ledger.record(tenantA, { type: 'debit', currency: 'USD', amount: 2.25 })
    expect(ledger.balance(tenantA, 'USD')).toBe(825)
    expect(() => ledger.record(tenantA, { type: 'credit', currency: 'USD', amount: -1 })).toThrow('MONEY_INVALID')
  })

  test('analytics reports explainable confidence and trend', () => {
    const analytics = new AnalyticsEngine()
    expect(analytics.trend([1, 2, 3]).direction).toBe('up')
    expect(analytics.confidence([10, 10, 10]).confidence).toBeGreaterThan(0)
    expect(() => analytics.trend([1])).toThrow('TREND_SERIES_TOO_SHORT')
  })

  test('automation schedules and cancels within tenant scope', () => {
    const automation = new AutomationCenter()
    automation.schedule(tenantA, { id: 'job-1', runAt: '2030-01-01T00:00:00Z', action: 'report' })
    expect(() => automation.cancel(tenantB, 'job-1')).toThrow('SCHEDULE_NOT_FOUND')
    expect(automation.cancel(tenantA, 'job-1').status).toBe('cancelled')
  })
})

describe('External boundaries remain local and disabled', () => {
  test('webhook signatures are verifiable without network calls', () => {
    const verifier = new WebhookVerifier()
    const payload = { event: 'created', id: '1' }
    const signature = verifier.sign(payload, 'local-test-secret')
    expect(verifier.verify(payload, signature, 'local-test-secret')).toBe(true)
    expect(verifier.verify(payload, signature, 'wrong-secret')).toBe(false)
  })

  test('integration registry reports disabled adapters and blocks calls', async () => {
    const registry = new IntegrationRegistry()
    registry.register('stripe', { health: () => 'not-configured', charge: async () => ({}) })
    expect(registry.status()[0]).toEqual({ name: 'stripe', enabled: false, health: 'not-configured' })
    await expect(registry.call('stripe', 'charge')).rejects.toThrow('INTEGRATION_DISABLED')
  })

  test('marketplace has moderation state and cloud only plans resources', () => {
    const marketplace = new MarketplaceCatalog()
    marketplace.list(tenantA, { id: 'listing-1', title: 'Template', price: 10 })
    expect(marketplace.publish(tenantA, 'listing-1').status).toBe('pending_review')
    expect(marketplace.review(tenantA, 'listing-1', { rating: 5, text: 'Useful' }).rating).toBe(5)
    const cloud = new CloudResourcePlanner().plan(tenantA, { type: 'project', name: 'demo' })
    expect(cloud.provisioned).toBe(false)
    expect(cloud.providerCall).toBe(false)
  })

  test('security policy denies cross-tenant resource and allows explicit permission', () => {
    const policy = new SecurityPolicy()
    expect(policy.authorize(tenantB, 'read:report', { tenantId: tenantA.tenantId }).allowed).toBe(false)
    expect(policy.authorize(tenantA, 'read:report', { tenantId: tenantA.tenantId }).allowed).toBe(true)
  })
})
