'use strict'

const {
  InMemoryRepository,
  WorkflowService,
  CRMService,
  InvoiceService,
  TransactionService,
  ExpenseService,
  FinancialReportService,
  AnalyticsService,
  AutomationService,
  AuditService,
  SecurityEventService,
  AnomalyDetector,
  OrganizationService,
  TeamService,
  MembershipService,
  LocalIdentityProvider,
  CommissionCalculator,
  DisabledPayoutProvider,
  MarketplaceService,
  LocalPlanner,
  DecisionEngine,
  RiskAnalyzer,
  FounderReportService,
} = require('../../src/future/services')

const a = { tenantId: 'org-a', actorId: 'user-a', permissions: ['read:report'] }
const b = { tenantId: 'org-b', actorId: 'user-b', permissions: [] }

describe('Future service layer', () => {
  test('repository is persistence-ready and tenant scoped', () => {
    const repo = new InMemoryRepository()
    repo.save(a, { id: 'one', value: 1 })
    expect(repo.findById(a, 'one').value).toBe(1)
    expect(repo.findById(b, 'one')).toBeNull()
    expect(() => repo.save(a, { value: 1 })).toThrow('REPOSITORY_KEY_REQUIRED')
  })

  test('workflow service handles idempotency, approval, success, and failure', async () => {
    const service = new WorkflowService()
    const run = service.create(a, { steps: [{ type: 'double', input: { n: 3 } }] }, 'workflow-key')
    expect(service.create(a, { steps: [{ type: 'double' }] }, 'workflow-key').duplicate).toBe(true)
    await expect(service.execute(a, run.runId, {})).rejects.toThrow('WORKFLOW_APPROVAL_REQUIRED')
    service.approve(a, run.runId, 'Owner reviewed test action')
    const result = await service.execute(a, run.runId, { double: async (input) => input.n * 2 })
    expect(result.status).toBe('completed')
    expect(result.outputs).toEqual([6])
    expect(() => service.approve(b, run.runId, 'wrong tenant')).toThrow('WORKFLOW_NOT_FOUND')
  })

  test('CRM services create scoped clients/leads/notes/follow-ups', () => {
    const crm = new CRMService()
    crm.upsertClient(a, { id: 'c1', name: 'Client A', signals: { engagement: 1, completion: 1, recency: 1 } })
    crm.addLead(a, { id: 'l1', name: 'Lead A' })
    crm.addNote(a, { id: 'n1', clientId: 'c1', text: 'Call' })
    crm.scheduleFollowUp(a, { id: 'f1', clientId: 'c1', runAt: '2030-01-01T00:00:00Z' })
    expect(crm.clients.list(b)).toHaveLength(0)
    expect(crm.leads.list(a)).toHaveLength(1)
    expect(() => crm.addLead(a, { name: 'missing-id' })).toThrow('LEAD_INVALID')
  })

  test('financial services calculate invoices and reports with minor units', () => {
    const transactions = new InMemoryRepository()
    const expenses = new InMemoryRepository()
    const invoices = new InvoiceService()
    const invoice = invoices.create(a, { id: 'i1', currency: 'USD', lines: [{ description: 'Service', quantity: 2, unitAmount: 10.25 }] })
    expect(invoice.totalMinor).toBe(2050)
    const transactionService = new TransactionService({ repository: transactions })
    const expenseService = new ExpenseService({ repository: expenses })
    transactionService.record(a, { id: 't1', type: 'credit', currency: 'USD', amount: 20.5 })
    expenseService.record(a, { id: 'e1', category: 'tools', currency: 'USD', amount: 2.5 })
    const report = new FinancialReportService({ transactionRepository: transactions, expenseRepository: expenses }).summarize(a, 'USD')
    expect(report.netMinor).toBe(1800)
    expect(() => invoices.create(a, { id: 'bad', currency: 'USD', lines: [] })).toThrow('INVOICE_INVALID')
  })

  test('analytics and automation services remain deterministic', () => {
    const analytics = new AnalyticsService()
    const metric = analytics.metric('sales', [1, 2, 3])
    expect(metric.trend.direction).toBe('up')
    expect(analytics.recommend(metric, 2).requiresHumanReview).toBe(true)
    const automation = new AutomationService()
    automation.registerTrigger(a, { id: 'tr1', event: 'order.created', action: 'notify', requiresApproval: true })
    const verifier = new (require('../../src/future').WebhookVerifier)()
    const payload = { id: 'evt1', event: 'order.created' }
    const signature = verifier.sign(payload, 'test-webhook-secret')
    const event = automation.normalizeWebhook(payload, signature, 'test-webhook-secret')
    expect(automation.executeTrigger(a, 'tr1', event).status).toBe('proposed')
    expect(() => automation.normalizeWebhook(payload, 'bad', 'test-webhook-secret')).toThrow('WEBHOOK_SIGNATURE_INVALID')
  })

  test('audit/security/anomaly services produce scoped evidence', () => {
    const audit = new AuditService()
    const security = new SecurityEventService({ audit })
    security.record(a, { type: 'login', action: 'allow' })
    expect(audit.list(a)).toHaveLength(1)
    expect(audit.list(b)).toHaveLength(0)
    expect(new AnomalyDetector().detect([1, 1, 1, 10], { zLimit: 1 }).anomaly).toBe(true)
  })

  test('enterprise services and identity adapter validate inputs', async () => {
    const orgs = new OrganizationService()
    const teams = new TeamService()
    const memberships = new MembershipService()
    orgs.create(a, { id: 'o1', name: 'Org A' })
    teams.create(a, { id: 'team1', organizationId: 'o1', name: 'Team' })
    expect(memberships.add(a, { id: 'm1', organizationId: 'o1', userId: 'u1', role: 'member' }).role).toBe('member')
    const identity = new LocalIdentityProvider()
    expect(identity.health()).toBe('not-configured')
    await expect(identity.authenticate()).rejects.toThrow('IDENTITY_PROVIDER_DISABLED')
    expect(() => teams.create(a, { id: 'bad' })).toThrow('TEAM_INVALID')
  })

  test('marketplace commission and payout boundaries are safe', async () => {
    const marketplace = new MarketplaceService()
    marketplace.createListing(a, { id: 'listing', title: 'Service', price: 100 })
    expect(marketplace.submitForReview(a, 'listing').status).toBe('pending_review')
    expect(marketplace.quoteCommission(100, 0.1).sellerMinor).toBe(9000)
    expect(marketplace.sellerStatus().verified).toBe(false)
    await expect(new DisabledPayoutProvider().payout()).rejects.toThrow('PAYOUT_PROVIDER_DISABLED')
    expect(() => new CommissionCalculator().calculate(10, 2)).toThrow('COMMISSION_RATE_INVALID')
  })

  test('cloud planning and decision support never execute side effects', () => {
    const plan = new LocalPlanner().plan(a, { type: 'database', name: 'planned-db' })
    expect(plan.provisioned).toBe(false)
    const decisionEngine = new DecisionEngine()
    const proposal = decisionEngine.propose(a, { action: 'external_side_effect', evidence: ['local observation'], confidence: 0.8, riskScore: 40 })
    expect(proposal.state).toBe('PROPOSED')
    expect(decisionEngine.approve(a, proposal, 'Reviewed locally').state).toBe('APPROVED')
    expect(new RiskAnalyzer().score({ impact: 1, uncertainty: 0, reversibility: 0 }).score).toBe(70)
  })

  test('founder report composes domain services without duplicate logic', () => {
    const crm = new CRMService()
    const tx = new InMemoryRepository()
    const ex = new InMemoryRepository()
    new TransactionService({ repository: tx }).record(a, { id: 't', type: 'credit', currency: 'USD', amount: 5 })
    const financials = new FinancialReportService({ transactionRepository: tx, expenseRepository: ex })
    const report = new FounderReportService({ analytics: new AnalyticsService(), financials, crm }).build(a, { metric: 'health', observations: [1, 2] })
    expect(report.financialSummary.revenueMinor).toBe(500)
    expect(report.requiresHumanReview).toBe(true)
  })
})
