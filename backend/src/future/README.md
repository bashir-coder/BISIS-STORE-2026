# Future Core Modular Architecture

> **STATUS: OPT-IN ONLY — DISABLED BY DEFAULT — NOT PART OF V1 ROUTES.**

`backend/src/future/` contains provider-neutral foundations for future BİŞIŞ versions. `index.js` is the compatibility barrel; implementations live in `core.js`, `services.js`, and `adapters.js`, while domain barrels provide focused imports.

| Domain | Barrel | Main exports |
|---|---|---|
| Shared | `shared/` | `assertTenantContext`, `InMemoryRepository`, JSDoc contracts |
| AI | `ai/` | `LocalProvider`, `ModelSelector`, `PromptEngine`, `EvaluationEngine`, `ScopedMemoryStore`, `ToolRegistry`, `AgentExecutor` |
| Workflows | `workflows/` | `WorkflowEngine`, `WorkflowService`, `ApprovalPolicy` |
| CRM | `crm/` | `CRMService`, `ClientScore`, `LeadTracker`, `NotesStore` |
| Finance | `finance/` | `FinancialLedger`, `InvoiceService`, `TransactionService`, `ExpenseService`, `FinancialReportService` |
| Analytics | `analytics/` | `AnalyticsEngine`, `AnalyticsService`, `AnomalyDetector` |
| Automation | `automation/` | `AutomationCenter`, `AutomationService`, `WebhookVerifier` |
| Security | `security/` | `SecurityPolicy`, `AuditService`, `SecurityEventService`, `AnomalyDetector` |
| Enterprise | `enterprise/` | `OrganizationService`, `TeamService`, `MembershipService`, `IdentityProvider` |
| Marketplace | `marketplace/` | `MarketplaceService`, `CommissionCalculator`, `SellerVerification`, `DisabledPayoutProvider` |
| Integrations | `integrations/` | provider contracts, `IntegrationRegistry`, `LocalMockAdapter` |
| Cloud | `cloud/` | `CloudResourcePlanner`, `LocalPlanner`, `CloudProvider` |
| Decision | `decision/` | `DecisionEngine`, `RiskAnalyzer`, `ApprovalPolicy`, `AgentExecutor` |
| Reporting | `reporting/` | `FounderReportService` |

## Rules for adding future code

Every public operation receives a tenant context and must enforce scope. Every high-impact action remains proposal/review/approval-gated. In-memory repositories are test implementations only. External adapters are disabled by default and must not acquire credentials from V1 environment files. New routes, migrations, workers, or frontend pages require a separate integration decision.
