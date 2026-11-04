# DATABASE INTEGRITY REPORT (Preliminary)

**Document:** DATABASE_INTEGRITY_REPORT.md  
**Audit Date:** 2026-11-01  
**Status:** AUDIT IN PROGRESS

---

## 1. KEY TABLES & RELATIONSHIPS

From migration 001:
- users (PK: id UUID) - has workspace_id, role, auth_provider, is_verified, is_active
- workspaces (PK: id UUID)
- workspace_members (composite PK: workspace_id, user_id) - links users to workspaces with roles
- services, packages, projects, orders, payments
- orders have user_id, workspace_id, project_id, payment_status
- payments reference orders

From migration 005 (execution engine):
- project_templates, project_template_milestones, project_template_tasks
- project_milestones, project_tasks (linked to projects, orders, assignees)
- project_activity (audit trail)

From migration 013 (NOWPayments):
- likely adds payment provider fields

From migration 019:
- digital_products, digital_product_purchases

---

## 2. INTEGRITY CONCERNS TO INVESTIGATE

### Orphaned Records
- Orders without valid users/workspaces?
- Payments without orders?
- Projects without workspaces?
- Workspace members pointing to non-existent users/workspaces?
- Project tasks without projects?

### Data Consistency
- orders.payment_status vs payments.status - could be out of sync
- users.role vs workspace_members.role - different purposes?
- Orders with payment_status 'verified' but no verified payment record?
- Delivered orders without deliveries?

### Business Logic
- Digital products purchases - need to ensure proper linking
- Tickets linked to projects/orders
- Subscriptions vs one-time purchases

### Migration 018 Impact
If personas were removed from Staging but exist in Prod:
- services.persona_ids column dropped in 018 - would break if data exists
- packages.persona_ids dropped
- users.persona_id dropped
- personas table dropped
- get_services_by_persona functions dropped

This could cause issues if Prod still has code expecting personas.

---

## 3. RECOMMENDATIONS

Need to run read-only aggregate queries against both environments to check:
- Referential integrity (orphaned FKs)
- Data distribution
- Status consistency
- Duplicate records
