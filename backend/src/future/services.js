'use strict'

const {
  assertTenantContext,
  ClientScore,
  AnalyticsEngine,
  CloudResourcePlanner,
  MarketplaceCatalog,
  WebhookVerifier,
} = require('./core')

function clone(value) {
  return value === undefined ? value : JSON.parse(JSON.stringify(value))
}

class InMemoryRepository {
  constructor({ key = 'id' } = {}) {
    this.key = key
    this.records = new Map()
  }

  save(context, record) {
    const scope = assertTenantContext(context)
    if (!record || record[this.key] === undefined || record[this.key] === null) throw new Error('REPOSITORY_KEY_REQUIRED')
    const id = `${scope.tenantId}:${record[this.key]}`
    const saved = { ...clone(record), tenantId: scope.tenantId, updatedBy: scope.actorId, updatedAt: new Date().toISOString() }
    this.records.set(id, saved)
    return clone(saved)
  }

  findById(context, id) {
    const scope = assertTenantContext(context)
    const record = this.records.get(`${scope.tenantId}:${id}`)
    return clone(record || null)
  }

  list(context, predicate = () => true) {
    const scope = assertTenantContext(context)
    return [...this.records.values()].filter((record) => record.tenantId === scope.tenantId && predicate(record)).map(clone)
  }

  delete(context, id) {
    const scope = assertTenantContext(context)
    return this.records.delete(`${scope.tenantId}:${id}`)
  }
}

class ApprovalPolicy {
  constructor({ sensitiveActions = [] } = {}) {
    this.sensitiveActions = new Set(sensitiveActions)
  }

  evaluate(action, approval = {}) {
    const sensitive = this.sensitiveActions.has(action)
    return {
      action,
      required: sensitive,
      approved: !sensitive ? true : approval.approved === true && typeof approval.reason === 'string' && approval.reason.trim().length >= 3,
      reason: sensitive ? (approval.reason || null) : 'not-sensitive',
    }
  }
}

class WorkflowService {
  constructor({ repository = new InMemoryRepository({ key: 'runId' }), approvalPolicy = new ApprovalPolicy({ sensitiveActions: ['external_side_effect', 'financial_write'] }) } = {}) {
    this.repository = repository
    this.approvalPolicy = approvalPolicy
  }

  create(context, definition, idempotencyKey) {
    const scope = assertTenantContext(context)
    if (!definition || !Array.isArray(definition.steps) || definition.steps.length === 0) throw new Error('WORKFLOW_DEFINITION_INVALID')
    if (!idempotencyKey || typeof idempotencyKey !== 'string') throw new Error('IDEMPOTENCY_KEY_REQUIRED')
    const existing = this.repository.list(scope).find((run) => run.idempotencyKey === idempotencyKey)
    if (existing) return { ...existing, duplicate: true }
    return this.repository.save(scope, { runId: `${scope.tenantId}:${idempotencyKey}`, idempotencyKey, definition: clone(definition), status: 'queued', history: [{ state: 'queued', at: new Date().toISOString() }] })
  }

  approve(context, runId, reason) {
    const scope = assertTenantContext(context)
    const run = this.repository.findById(scope, runId)
    if (!run) throw new Error('WORKFLOW_NOT_FOUND')
    const decision = this.approvalPolicy.evaluate('external_side_effect', { approved: true, reason })
    if (!decision.approved) throw new Error('HUMAN_APPROVAL_REQUIRED')
    run.status = 'approved'
    run.approvedBy = scope.actorId
    run.approvalReason = reason
    run.history.push({ state: 'approved', actorId: scope.actorId, at: new Date().toISOString() })
    return this.repository.save(scope, run)
  }

  async execute(context, runId, handlers = {}) {
    const scope = assertTenantContext(context)
    const run = this.repository.findById(scope, runId)
    if (!run) throw new Error('WORKFLOW_NOT_FOUND')
    if (run.status !== 'approved') throw new Error('WORKFLOW_APPROVAL_REQUIRED')
    run.status = 'running'
    this.repository.save(scope, run)
    const outputs = []
    try {
      for (const step of run.definition.steps) {
        if (typeof handlers[step.type] !== 'function') throw new Error(`WORKFLOW_HANDLER_MISSING:${step.type}`)
        outputs.push(await handlers[step.type](clone(step.input), scope))
      }
      run.status = 'completed'
      run.outputs = outputs
      run.history.push({ state: 'completed', at: new Date().toISOString() })
      return this.repository.save(scope, run)
    } catch (error) {
      run.status = 'failed'
      run.error = error.message
      run.history.push({ state: 'failed', error: error.message, at: new Date().toISOString() })
      this.repository.save(scope, run)
      throw error
    }
  }
}

class CRMService {
  constructor({ clients = new InMemoryRepository(), leads = new InMemoryRepository(), notes = new InMemoryRepository(), followUps = new InMemoryRepository(), scorer = new ClientScore() } = {}) {
    this.clients = clients
    this.leads = leads
    this.notes = notes
    this.followUps = followUps
    this.scorer = scorer
  }

  upsertClient(context, client) {
    const scope = assertTenantContext(context)
    if (!client?.id || !client?.name) throw new Error('CLIENT_INVALID')
    return this.clients.save(scope, { ...client, score: this.scorer.calculate(client.signals || {}) })
  }

  addLead(context, lead) {
    const scope = assertTenantContext(context)
    if (!lead?.id || !lead?.name) throw new Error('LEAD_INVALID')
    return this.leads.save(scope, { ...lead, stage: lead.stage || 'new' })
  }

  addNote(context, note) {
    const scope = assertTenantContext(context)
    if (!note?.id || !note?.clientId || !note?.text) throw new Error('NOTE_INVALID')
    return this.notes.save(scope, note)
  }

  scheduleFollowUp(context, followUp) {
    const scope = assertTenantContext(context)
    if (!followUp?.id || !followUp?.clientId || !followUp?.runAt) throw new Error('FOLLOW_UP_INVALID')
    return this.followUps.save(scope, { ...followUp, status: 'scheduled' })
  }
}

function moneyMinor(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0 || !Number.isInteger(Math.round(number * 100))) throw new Error('MONEY_INVALID')
  return Math.round(number * 100)
}

class InvoiceService {
  constructor({ repository = new InMemoryRepository() } = {}) { this.repository = repository }

  create(context, invoice) {
    const scope = assertTenantContext(context)
    if (!invoice?.id || !invoice?.currency || !Array.isArray(invoice.lines) || invoice.lines.length === 0) throw new Error('INVOICE_INVALID')
    const lines = invoice.lines.map((line) => {
      if (!line.description || !Number.isInteger(line.quantity) || line.quantity <= 0) throw new Error('INVOICE_LINE_INVALID')
      const unitMinor = moneyMinor(line.unitAmount)
      return { description: line.description, quantity: line.quantity, unitMinor, totalMinor: unitMinor * line.quantity }
    })
    const totalMinor = lines.reduce((sum, line) => sum + line.totalMinor, 0)
    return this.repository.save(scope, { id: invoice.id, currency: invoice.currency.toUpperCase(), lines, totalMinor, status: 'draft' })
  }

  markIssued(context, id) {
    const scope = assertTenantContext(context)
    const invoice = this.repository.findById(scope, id)
    if (!invoice) throw new Error('INVOICE_NOT_FOUND')
    invoice.status = 'issued'
    return this.repository.save(scope, invoice)
  }
}

class TransactionService {
  constructor({ repository = new InMemoryRepository() } = {}) { this.repository = repository }
  record(context, transaction) {
    const scope = assertTenantContext(context)
    if (!transaction?.id || !transaction?.currency || !transaction?.type) throw new Error('TRANSACTION_INVALID')
    return this.repository.save(scope, { ...transaction, currency: transaction.currency.toUpperCase(), amountMinor: moneyMinor(transaction.amount), immutable: true })
  }
}

class ExpenseService {
  constructor({ repository = new InMemoryRepository() } = {}) { this.repository = repository }
  record(context, expense) {
    const scope = assertTenantContext(context)
    if (!expense?.id || !expense?.category || !expense?.currency) throw new Error('EXPENSE_INVALID')
    return this.repository.save(scope, { ...expense, currency: expense.currency.toUpperCase(), amountMinor: moneyMinor(expense.amount), immutable: true })
  }
}

class FinancialReportService {
  constructor({ transactionRepository = new InMemoryRepository(), expenseRepository = new InMemoryRepository() } = {}) {
    this.transactions = transactionRepository
    this.expenses = expenseRepository
  }
  summarize(context, currency) {
    const scope = assertTenantContext(context)
    const normalized = currency.toUpperCase()
    const credits = this.transactions.list(scope, (item) => item.currency === normalized && item.type === 'credit').reduce((sum, item) => sum + item.amountMinor, 0)
    const debits = this.transactions.list(scope, (item) => item.currency === normalized && item.type === 'debit').reduce((sum, item) => sum + item.amountMinor, 0)
    const expenses = this.expenses.list(scope, (item) => item.currency === normalized).reduce((sum, item) => sum + item.amountMinor, 0)
    return { currency: normalized, revenueMinor: credits, transactionDebitsMinor: debits, expensesMinor: expenses, netMinor: credits - debits - expenses }
  }
}

class AnalyticsService {
  constructor({ engine = new AnalyticsEngine() } = {}) { this.engine = engine }
  metric(name, values) {
    if (!name || !Array.isArray(values)) throw new Error('METRIC_INVALID')
    const trend = values.length >= 2 ? this.engine.trend(values) : null
    const confidence = this.engine.confidence(values)
    return { name, latest: Number(values[values.length - 1]), trend, confidence, source: 'deterministic-local-observation' }
  }
  recommend(metric, threshold) {
    if (!metric?.confidence || typeof metric.latest !== 'number') throw new Error('METRIC_REQUIRED')
    const above = metric.latest >= threshold
    return { action: above ? 'investigate-growth' : 'investigate-risk', score: metric.confidence.confidence, evidence: { latest: metric.latest, threshold }, requiresHumanReview: true }
  }
}

class AutomationService {
  constructor({ repository = new InMemoryRepository(), webhookVerifier = new WebhookVerifier() } = {}) { this.repository = repository; this.webhookVerifier = webhookVerifier }
  registerTrigger(context, trigger) {
    const scope = assertTenantContext(context)
    if (!trigger?.id || !trigger.event || !trigger.action) throw new Error('TRIGGER_INVALID')
    return this.repository.save(scope, { ...trigger, status: 'active', retryLimit: Math.max(0, Math.min(5, Number(trigger.retryLimit ?? 3))) })
  }
  normalizeWebhook(payload, signature, secret) {
    if (!this.webhookVerifier.verify(payload, signature, secret)) throw new Error('WEBHOOK_SIGNATURE_INVALID')
    return { type: payload.event || 'unknown', eventId: payload.id || null, payload: clone(payload) }
  }
  executeTrigger(context, triggerId, event) {
    const scope = assertTenantContext(context)
    const trigger = this.repository.findById(scope, triggerId)
    if (!trigger || trigger.status !== 'active') throw new Error('TRIGGER_NOT_FOUND')
    if (trigger.event !== event.type) return { matched: false, status: 'ignored' }
    return { matched: true, status: 'proposed', action: trigger.action, eventId: event.eventId, requiresApproval: Boolean(trigger.requiresApproval) }
  }
}

class AuditService {
  constructor() { this.events = [] }
  record(context, event) {
    const scope = assertTenantContext(context)
    if (!event?.type || !event.action) throw new Error('AUDIT_EVENT_INVALID')
    const record = Object.freeze({ id: `${Date.now()}-${this.events.length}`, ...scope, ...clone(event), immutable: true, at: new Date().toISOString() })
    this.events.push(record)
    return record
  }
  list(context) { const scope = assertTenantContext(context); return this.events.filter((event) => event.tenantId === scope.tenantId).map(clone) }
}

class SecurityEventService {
  constructor({ audit = new AuditService() } = {}) { this.audit = audit }
  record(context, event) { return this.audit.record(context, { ...event, category: 'security' }) }
}

class AnomalyDetector {
  detect(values, { zLimit = 2 } = {}) {
    if (!Array.isArray(values) || values.length < 3) throw new Error('ANOMALY_SERIES_TOO_SHORT')
    const mean = values.reduce((a, b) => a + Number(b), 0) / values.length
    const variance = values.reduce((sum, value) => sum + ((Number(value) - mean) ** 2), 0) / values.length
    const deviation = Math.sqrt(variance)
    const last = Number(values[values.length - 1])
    return { anomaly: deviation > 0 && Math.abs(last - mean) / deviation >= zLimit, mean, deviation, last, method: 'deterministic-z-score' }
  }
}

class OrganizationService {
  constructor({ repository = new InMemoryRepository() } = {}) { this.repository = repository }
  create(context, organization) {
    const scope = assertTenantContext(context)
    if (!organization?.id || !organization?.name) throw new Error('ORGANIZATION_INVALID')
    return this.repository.save(scope, { ...organization, status: 'active' })
  }
}

class TeamService {
  constructor({ repository = new InMemoryRepository() } = {}) { this.repository = repository }
  create(context, team) {
    const scope = assertTenantContext(context)
    if (!team?.id || !team?.organizationId || !team?.name) throw new Error('TEAM_INVALID')
    return this.repository.save(scope, team)
  }
}

class MembershipService {
  constructor({ repository = new InMemoryRepository() } = {}) { this.repository = repository }
  add(context, membership) {
    const scope = assertTenantContext(context)
    if (!membership?.id || !membership?.organizationId || !membership?.userId || !membership?.role) throw new Error('MEMBERSHIP_INVALID')
    return this.repository.save(scope, membership)
  }
}

class LocalIdentityProvider {
  constructor() { this.name = 'local-disabled-identity-provider' }
  health() { return 'not-configured' }
  async authenticate() { throw new Error('IDENTITY_PROVIDER_DISABLED') }
}

class CommissionCalculator {
  calculate(amount, rate = 0.1) {
    const amountMinor = moneyMinor(amount)
    const normalizedRate = Number(rate)
    if (!Number.isFinite(normalizedRate) || normalizedRate < 0 || normalizedRate > 1) throw new Error('COMMISSION_RATE_INVALID')
    const commissionMinor = Math.round(amountMinor * normalizedRate)
    return { amountMinor, commissionMinor, sellerMinor: amountMinor - commissionMinor }
  }
}

class SellerVerification {
  verify() { return { status: 'pending_review', verified: false, providerCall: false } }
}

class DisabledPayoutProvider {
  health() { return 'disabled' }
  async payout() { throw new Error('PAYOUT_PROVIDER_DISABLED') }
}

class MarketplaceService {
  constructor({ catalog = new MarketplaceCatalog(), commission = new CommissionCalculator(), sellerVerification = new SellerVerification() } = {}) {
    this.catalog = catalog
    this.commission = commission
    this.sellerVerification = sellerVerification
  }
  createListing(context, listing) { return this.catalog.list(context, listing) }
  submitForReview(context, id) { return this.catalog.publish(context, id) }
  quoteCommission(amount, rate) { return this.commission.calculate(amount, rate) }
  sellerStatus() { return this.sellerVerification.verify() }
}

class LocalPlanner {
  constructor({ planner = new CloudResourcePlanner() } = {}) { this.planner = planner }
  plan(context, resource) { return this.planner.plan(context, resource) }
}

class DecisionEngine {
  propose(context, decision) {
    const scope = assertTenantContext(context)
    if (!decision?.action || !decision?.evidence) throw new Error('DECISION_INVALID')
    return { ...scope, id: `${scope.tenantId}:${Date.now()}`, state: 'PROPOSED', action: decision.action, evidence: clone(decision.evidence), confidence: Math.max(0, Math.min(1, Number(decision.confidence ?? 0))), riskScore: Math.max(0, Math.min(100, Number(decision.riskScore ?? 100))), requiresHumanApproval: true }
  }
  approve(context, proposal, reason) {
    const scope = assertTenantContext(context)
    if (!proposal || proposal.tenantId !== scope.tenantId || !reason) throw new Error('DECISION_APPROVAL_INVALID')
    return { ...proposal, state: 'APPROVED', approvedBy: scope.actorId, approvalReason: reason, approvedAt: new Date().toISOString() }
  }
}

class RiskAnalyzer {
  score({ impact = 0, uncertainty = 0, reversibility = 1 } = {}) {
    const values = [impact, uncertainty, 1 - reversibility].map(Number)
    if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) throw new Error('RISK_INPUT_INVALID')
    return { score: Math.round((values[0] * 0.5 + values[1] * 0.3 + values[2] * 0.2) * 100), factors: { impact, uncertainty, reversibility } }
  }
}

class FounderReportService {
  constructor({ analytics, financials, crm }) { this.analytics = analytics; this.financials = financials; this.crm = crm }
  build(context, { currency = 'USD', metric = null, observations = [] } = {}) {
    const scope = assertTenantContext(context)
    const analytics = metric ? this.analytics.metric(metric, observations) : null
    return { tenantId: scope.tenantId, generatedBy: scope.actorId, financialSummary: this.financials?.summarize(scope, currency) || null, analytics, crm: { clients: this.crm?.clients.list(scope).length || 0, leads: this.crm?.leads.list(scope).length || 0 }, status: 'draft', requiresHumanReview: true }
  }
}

module.exports = {
  InMemoryRepository,
  ApprovalPolicy,
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
  SellerVerification,
  DisabledPayoutProvider,
  MarketplaceService,
  LocalPlanner,
  DecisionEngine,
  RiskAnalyzer,
  FounderReportService,
}
