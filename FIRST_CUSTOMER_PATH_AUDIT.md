# BİŞİŞ V1 — First-Customer Path Audit
**Evidence Report: Package/Order Creation → Payment → Verification → Processing → Requirements → Execution → Delivery → Approval → Completion → Invoice/Testimonial/Referral**

---

## Executive Summary

| Stage | Implementation Status | Primary Evidence |
|-------|----------------------|------------------|
| Package Selection | ✅ Implemented | `PackagesPage.tsx:288-318`, `packages.routes.js:63-75` |
| Order Creation | ✅ Implemented | `orders.routes.js:283-525`, `PaymentPage.tsx:196-267` |
| Payment (NOWPayments) | ✅ Implemented | `orders.routes.js:532-1074`, `nowpayments.service.js:144-200` |
| Payment Verification (IPN) | ✅ Implemented | `nowpayments.routes.js:162-647` |
| On-Chain Verification | ⚠️ Fail-Closed/DB-Only | `payment-verifier.js:53-80`, `001_launch_contract.sql:411-450` |
| Processing Gate | ✅ Implemented | `orders.routes.js:1850-1864` |
| Project Initialization | ✅ Implemented | `service-delivery.routes.js:202-266` |
| Requirements Gathering | ✅ Implemented | `service-delivery.routes.js:268-364` |
| Execution (Milestones/Tasks) | ✅ Implemented | `execution.routes.js:373-574` |
| Delivery Workflow | ✅ Implemented | `service-delivery.routes.js:541-620` |
| Client Approval | ✅ Implemented | `service-delivery.routes.js:580-597` |
| Completion & Invoice | ✅ Implemented | `orders.routes.js:1987-2088`, `invoices.routes.js:48-68` |
| Testimonial/Referral | ❌ Not Implemented | No code evidence |

**Overall**: End-to-end lifecycle is implemented and enforced via API + DB constraints. **Launch blocker**: On-chain payment verifier is unconfigured (fail-closed), blocking real fund flows. External configuration required per `FINAL_LAUNCH_CHECKLIST.md:44-53`.

---

## 1. Package/Order Creation

### 1.1 Package Catalog (Frontend → Backend)

**Frontend** (`frontend/src/pages/PackagesPage.tsx`):
- Lines 288-318: Renders services grid with "Select" buttons
- Lines 303-309: On selection, sets `selectedServiceId`, navigates to `/payment` with state:
```typescript
state={{
  serviceId: selectedService?.id,
  service: selectedService?.name,
  amount: selectedService?.price
}}
```
- Lines 372-461: Renders packages grid with selection
- Lines 438-458: On package selection, navigates to `/payment` with `packageId`, `package`, `amount`

**Backend** (`backend/src/api/routes/packages.routes.js`):
- Lines 63-75: `GET /api/packages` returns active packages
- Lines 92-103: `GET /api/services` returns active services

### 1.2 Order Creation API

**Route**: `POST /api/orders` (`backend/src/api/routes/orders.routes.js:283-525`)

**Trigger**: Customer clicks "Pay Now" on PaymentPage
**Actor**: Authenticated customer (`authenticate` middleware)
**Input**: `{ package_id }` OR `{ service_id }` (mutually exclusive)

**Validation** (lines 293-388):
- Package/service must exist, be active, price > 0
- Amount derived from package/service price

**Order Record Created** (lines 191-224, 425-463):
```javascript
{
  user_id: req.user.id,
  status: 'new',
  payment_status: 'pending',
  payment_provider: 'nowpayments',
  amount: numericAmount,
  price: numericAmount,
  package_id: selectedPackage?.id || null,
  service: selectedService?.name || null,
  network: 'bsc',
  currency: 'USDC',
  full_name: req.user.full_name || 'Anonymous',
  email: req.user.email,
  workspace_id: req.user.workspace_id,
  submission_id: crypto.randomUUID()
}
```

**Events** (lines 478-508): Inserts `order_events` with `event_type: 'order_created'`

**Completion Signal**: Returns `201 Created` with order object including `id`, `submission_id`, `payment_status: 'pending'`

---

## 2. Payment (NOWPayments Invoice Creation)

### 2.1 Create Payment API

**Route**: `POST /api/orders/:id/create-payment` (`orders.routes.js:532-1074`)

**Trigger**: Immediately after order creation (PaymentPage.tsx:234-252)
**Actor**: Customer (order owner)
**Preconditions** (lines 616-637):
- Order not in `completed`, `cancelled`, `refunded`
- `payment_status !== 'verified'`

**Invoice Reuse** (lines 643-702): If existing `payment_url` and status in `waiting|pending`, returns existing invoice

**NOWPayments Invoice Creation** (lines 758-781):
```javascript
await createInvoice({
  priceAmount: amount,
  orderId: String(order.id),
  orderDescription: order.package || order.service || `BİŞİŞ Order #${order.id}`,
  ipnCallbackUrl: `${publicApiUrl}/api/orders/${order.id}/nowpayments-ipn`,
  successUrl: `${publicWebUrl}/payment/success?order_id=${order.id}`,
  cancelUrl: `${publicWebUrl}/payment/cancelled?order_id=${order.id}`,
  customerEmail: req.user.email
})
```

**NOWPayments Service** (`backend/src/services/nowpayments.service.js:144-200`):
- Calls `POST https://api.nowpayments.io/v1/invoice`
- Fixed: `price_currency: 'usd'`, `pay_currency: 'usdcbsc'`
- Returns: `invoice_id`, `payment_id`, `purchase_id`, `invoice_url`, `pay_address`, `pay_amount`, `pay_currency`, `payment_status`

**Order Update** (lines 852-912): Persists all NOWPayments fields on order:
- `nowpayments_payment_id`, `nowpayments_invoice_id`, `nowpayments_purchase_id`
- `payment_url`, `nowpayments_pay_address`, `nowpayments_pay_currency`, `nowpayments_pay_amount`
- `nowpayments_price_amount`, `nowpayments_price_currency`, `nowpayments_status`
- `network: 'bsc'`, `currency: 'USDC'`

**Events** (lines 927-986): `order_events` with `event_type: 'payment.nowpayments.created'`

**Frontend Response** (`PaymentPage.tsx:239-252`):
- Sets payment state
- **Auto-redirects**: `window.location.assign(paymentData.invoice_url)` (line 249-251)

**Completion Signal**: Returns `201` with invoice details; frontend redirects to NOWPayments checkout page

---

## 3. Payment Verification

### 3.1 NOWPayments IPN (Primary Verification Path)

**Route**: `POST /api/orders/:id/nowpayments-ipn` → handled by `nowpayments.routes.js:162-647` (mounted at `/api/nowpayments-ipn` in server.js)

**Trigger**: NOWPayments server-to-server callback
**Actor**: NOWPayments (no auth, signature-verified)

**Signature Verification** (lines 174-214):
- Validates `x-nowpayments-sig` header against `NOWPAYMENTS_IPN_SECRET_KEY`
- HMAC-SHA512 of sorted JSON payload
- Timing-safe comparison

**Currency Enforcement** (lines 220-252):
- `pay_currency` must be `usdcbsc`
- `price_currency` must be `usd`

**Order Resolution** (lines 258-289): Finds order by `order_id` from payload

**Status Mapping** (`normalizeStatus`, lines 98-134):
| NOWPayments Status | Internal `payment_status` |
|-------------------|---------------------------|
| `waiting` | `pending` |
| `confirming`, `confirmed`, `sending` | `submitted` |
| `finished` | **`verified`** ✅ |
| `partially_paid` | `submitted` |
| `failed`, `expired` | `failed` |
| `refunded` | `refunded` |
| Unknown | Ignored (200 OK, no order change) |

**Downgrade Prevention** (lines 352-363): If order already `verified`, ignores non-refund IPNs

**Order Update** (lines 369-402):
```javascript
{
  payment_status: paymentStatus,  // 'verified' | 'submitted' | 'failed' | 'refunded'
  network: 'bsc',
  currency: 'USDC',
  txid: payinHash,  // from payload.payin_hash
  updated_at: now()
}
```

**Events** (lines 455-481): `order_events` with `event_type: 'payment.nowpayments.{status}'`

**Notifications** (lines 496-601):
- `verified` → "Payment confirmed"
- `failed` → "Payment failed"
- `refunded` → "Payment refunded"

**Completion Signal**: Returns `200 { success: true, updated: true, order: updatedOrder }`

### 3.2 On-Chain Polygon USDC Verification (Secondary/Optional)

**Service**: `backend/src/services/payment-verifier.js:53-80` (`verifyPolygonUsdcPayment`)

**Configuration** (`getPaymentConfig`, lines 7-24):
```javascript
Requires env: WEB3_NETWORK='polygon', WEB3_RPC_URL, USDC_CONTRACT_ADDRESS, WEB3_RECIPIENT_ADDRESS
Defaults: confirmations=12, decimals=6
Returns null if unconfigured → fail-closed
```

**Verification Logic** (lines 53-80):
1. Validates transaction hash format
2. Confirms RPC is Polygon mainnet (`chainId === 0x89`)
3. Fetches transaction + receipt
4. Checks: `receipt.status === '0x1'`, confirmed block, sufficient confirmations
5. Parses ERC20 Transfer logs for USDC token → recipient address
6. Exact amount match (6 decimals)
7. **Fail-closed**: Returns `{ ok: false, code: 'PAYMENT_VERIFIER_UNCONFIGURED' }` if config missing

**Database Function** (`001_launch_contract.sql:411-450`):
```sql
verify_payment_and_order(p_payment_id, p_transaction_id, ...)
- Row-locks payment + order
- Validates: payment.status='submitted', order.payment_status='submitted'
- Checks transaction_id uniqueness
- Atomically updates both tables to 'verified'
- Restricted to service_role
```

**Test Coverage** (`backend/tests/payment-verifier.test.js`): 7 passing tests including fail-closed, wrong recipient, wrong amount, unconfirmed, duplicate transfers.

**Status**: **Implemented but unconfigured** — returns 503 if env vars missing (`FINAL_LAUNCH_CHECKLIST.md:51`)

---

## 4. Processing Gate

### 4.1 Order Status Transitions (Enforced)

**Route**: `PATCH /api/orders/:id` (`orders.routes.js:1700-2105`)

**Actor**: Staff (`admin`, `super_admin`, `manager`)
**Allowed Statuses** (lines 1726-1733): `new`, `processing`, `completed`, `cancelled`, `refunded`

**Transition Matrix** (lines 1735-1769):
```
new → processing | cancelled
processing → completed | cancelled
completed → refunded
cancelled → (none)
refunded → (none)
```

**Payment Gate** (lines 1850-1864):
```javascript
if (['processing', 'completed'].includes(status) && order.payment_status !== 'verified') {
  return 409: 'Order cannot enter fulfilment until payment is verified'
}
if (status === 'refunded' && order.payment_status !== 'verified') {
  return 409: 'Order cannot be refunded until payment is verified'
}
```

**Invoice Creation on Completion** (lines 1987-2088):
- Auto-creates invoice in `invoices` table when status → `completed`
- 15% tax, `status: 'paid'`, `invoice_number: INV-${timestamp}-${random}`

**Notifications** (lines 1950-1981): Creates `notifications` for customer with localized status label

**Completion Signal**: Returns updated order; `order_events` records `status_changed`

---

## 5. Project Initialization (Service Delivery Start)

### 5.1 Initialize Project from Order

**Route**: `POST /api/service-delivery/orders/:orderId/initialize` (`service-delivery.routes.js:202-266`)

**Trigger**: Staff action after payment verified
**Actor**: Staff (`admin`, `super_admin`, `manager`, `editor`)
**Preconditions** (line 213):
```javascript
if (!['verified', 'paid', 'completed'].includes(order.payment_status) && order.status !== 'processing') {
  return 409: 'ORDER_NOT_READY'
}
```

**Idempotency** (lines 214-216): Returns existing project if `order.project_id` already set

**Project Creation** (lines 223-235):
```javascript
{
  workspace_id: order.workspace_id || req.user.workspace_id,
  created_by: req.user.id,
  name: req.body.name || order.service || order.package || `Order #${order.id}`,
  description: req.body.description,
  status: 'active',
  execution_state: 'not_started',
  waiting_on: null
}
```

**Links Order** (line 234): `UPDATE orders SET project_id = project.id WHERE id = order.id`

**Applies Template** (lines 236-238): Calls `applyTemplate()` which:
- Creates `project_milestones` from `project_template_milestones`
- Creates `project_tasks` from `project_template_tasks` (linked by position)

**Requirements** (lines 239-254): Accepts `requirements[]` from request body, creates `project_requirements`

**State Derivation** (lines 256-257): Calls `deriveState()` → updates `projects.execution_state`, `waiting_on`

**Completion Signal**: Returns `201` with project, milestones, tasks, requirements

---

## 6. Requirements Gathering

### 6.1 Staff Creates Requirements

**Route**: `POST /api/service-delivery/projects/:projectId/requirements` (`service-delivery.routes.js:285-317`)

**Actor**: Staff
**Input**: `title`, `description`, `requirement_type` (text|file|choice), `is_required`, `client_visible`
**Side Effects**:
- `recordActivity` with `REQUIREMENT_REQUESTED` (client-visible)
- `notifyProjectOwner` → customer notification
- `updateProjectState` → may set `execution_state: 'waiting_on_client'`

### 6.2 Client Submits Requirements

**Route**: `PATCH /api/service-delivery/projects/:projectId/requirements/:requirementId` (`service-delivery.routes.js:319-364`)

**Actor**: Client (validated via `getClientProject`)
**Preconditions** (lines 332-334):
- Cannot edit if status `approved` or `not_applicable`
- Must provide `response_value` (text/choice) or `file_id` (file type)

**File Validation** (lines 336-344):
- File must belong to client (`uploaded_by = req.user.id`)
- File must be `file_kind = 'customer_input'`
- File must link to order in same project

**Update** (lines 345-347):
```javascript
{
  response_value: ...,
  file_id: ...,
  status: 'submitted',
  completed_at: now(),
  updated_by: req.user.id
}
```

**Side Effects**:
- `recordActivity` with `REQUIREMENT_SUBMITTED` (client-visible)
- `updateProjectState` → may clear `waiting_on_client`
- `notifyProjectOwner` → staff notification

**State Derivation** (`deriveState`, lines 99-109):
```javascript
if (pendingRequirements.length) return { execution_state: 'waiting_on_client', waiting_on: 'client' }
```

**Completion Signal**: Returns updated requirement; project state auto-updates

---

## 7. Execution (Milestones & Tasks)

### 7.1 Template-Driven Structure

**Templates** (`execution.routes.js:84-371`): CRUD for `project_templates` with milestones + tasks
- `client_visible` flag on tasks controls client visibility

**Apply Template** (`execution.routes.js:414-460`): `POST /projects/:projectId/apply-template`
- Idempotent: fails if project already has milestones/tasks (409 `PROJECT_STRUCTURE_EXISTS`)
- Creates milestones + tasks preserving positions
- Records `PROJECT_STRUCTURE_INITIALIZED` activity

### 7.2 Milestone/Task Management (Staff Only)

**Milestones** (`execution.routes.js:463-506`): CRUD with status transitions
- `completed_at` auto-set on status → `completed`

**Tasks** (`execution.routes.js:509-562`): CRUD with assignee, priority, due date, `client_visible`
- `completed_at` auto-set on status → `done`

**State Refresh** (`refreshProjectState`, lines 43-66): Called after every milestone/task change
```javascript
Derives execution_state from:
- pending requirements → 'waiting_on_client'
- delivery.status === 'client_review' → 'waiting_on_review'
- delivery.status === 'completed'/'approved' → 'completed'
- any task blocked → 'blocked'
- all tasks done/cancelled → 'ready_for_delivery'
- any task in_progress/done → 'in_progress'
- tasks exist → 'in_progress'
- else → 'not_started'
```

**Completion Signal**: Project `execution_state` and `waiting_on` updated in real-time

---

## 8. Delivery Workflow

### 8.1 Staff Prepares Delivery

**Route**: `POST /projects/:projectId/delivery/prepare` (`service-delivery.routes.js:541-559`)
- Valid transition: `ready_for_delivery` | `revision_requested` → `prepared`
- Sets `prepared_by`, `prepared_at`
- Updates project: `execution_state: 'ready_for_delivery'`, `waiting_on: null`

### 8.2 Staff Sends Delivery

**Route**: `POST /projects/:projectId/delivery/send` (`service-delivery.routes.js:561-578`)
- Requires current status `prepared`
- Sets status → `client_review`, `delivered_at`
- `recordActivity` `DELIVERY_SENT` (client-visible)
- `notifyProjectOwner` → "Your delivery is ready for review"
- Updates project: `execution_state: 'waiting_on_review'`, `waiting_on: 'review'`

### 8.3 Client Approves Delivery

**Route**: `POST /projects/:projectId/delivery/approve` (`service-delivery.routes.js:580-597`)
- **Actor**: Client (validated via `getClientProject`)
- Valid from: `client_review` | `delivered`
- Sets status → `completed`, `approved_at`, `reviewed_at`
- `recordActivity` `CLIENT_APPROVED` (client-visible)
- Updates project: `execution_state: 'completed'`, `waiting_on: null`

### 8.4 Client Requests Revision

**Route**: `POST /projects/:projectId/delivery/revision` (`service-delivery.routes.js:599-620`)
- **Actor**: Client
- Valid from: `client_review` | `delivered`
- Max 5 revisions (`revision_count < 5`)
- Requires `reason`
- Sets status → `revision_requested`, increments `revision_count`
- `recordActivity` `REVISION_REQUESTED` (client-visible)
- `notifyProjectOwner` → "A client requested changes"
- Updates project: `execution_state: 'in_progress'`, `waiting_on: 'founder'`

**Delivery Status Enum** (line 46): `ready_for_delivery`, `prepared`, `delivered`, `client_review`, `approved`, `revision_requested`, `completed`

---

## 9. Completion & Invoice

### 9.1 Order Completion → Invoice Auto-Creation

**Trigger**: `PATCH /api/orders/:id` with `status: 'completed'` (`orders.routes.js:1987-2088`)

**Logic** (lines 1987-2088):
```javascript
if (status === 'completed') {
  const existingInvoice = await supabase.from('invoices').select('id').eq('order_id', orderId).maybeSingle()
  if (!existingInvoice) {
    const amount = Number(order.amount || order.price || 0)
    const tax = Number((amount * 0.15).toFixed(2))
    const total = Number((amount + tax).toFixed(2))
    const invoiceNumber = `INV-${Date.now()}-${random}`
    await supabase.from('invoices').insert([{
      order_id: orderId,
      invoice_number: invoiceNumber,
      amount, tax, total,
      status: 'paid',  // Note: 'paid' not 'issued' per FINAL_LAUNCH_CHECKLIST.md:38
      created_at: now(),
      updated_at: now()
    }])
  }
}
```

### 9.2 Invoice Management

**Route**: `POST /api/invoices` (`invoices.routes.js:48-68`)
- Staff can manually create invoice for order
- Same 15% tax calculation
- `status: 'issued'` (differs from auto-creation)

**Invoice Statuses** (line 73): `issued`, `void`, `refunded`

**Access Control**: Customer sees own invoices via `canAccessOrder` (line 8)

---

## 10. Testimonial / Referral

**Status**: ❌ **Not Implemented**

**Search Evidence**:
- No routes for testimonials/referrals in `backend/src/api/routes/`
- No tables for testimonials/referrals in migrations
- No frontend components/pages for testimonial/referral flow
- `frontend/src/sections/Testimonials.tsx` exists but is static display only

---

## 11. Gaps & Launch Blockers

### 11.1 Critical Launch Blockers (from `FINAL_LAUNCH_CHECKLIST.md`)

| Blocker | Description | Evidence |
|---------|-------------|----------|
| **Payment Verifier Unconfigured** | Polygon RPC, USDC contract, recipient address not set → verifier returns 503, order creation blocked for real payments | `payment-verifier.js:7-14`, `FINAL_LAUNCH_CHECKLIST.md:51` |
| **Production Supabase** | Test project used; need production ref, backup/PITR, canonical migrations 001→011 applied | `FINAL_LAUNCH_CHECKLIST.md:48` |
| **Production Secrets** | Service role key must be server-only; Vite vars separated | `FINAL_LAUNCH_CHECKLIST.md:49` |
| **Domain/DNS/CORS** | `ALLOWED_ORIGINS`, `VITE_API_URL` must be production domain | `FINAL_LAUNCH_CHECKLIST.md:50` |
| **Docker/Compose** | Not tested in sandbox; needs host/CI runtime verification | `FINAL_LAUNCH_CHECKLIST.md:52` |

### 11.2 Functional Gaps

| Gap | Impact | Location |
|-----|--------|----------|
| **No Testimonial/Referral System** | Post-completion engagement missing | N/A |
| **No Automated Email/SMS Notifications** | Only in-app `notifications` table | `orders.routes.js:1950-1981` |
| **No Webhook Retry/Dead Letter for NOWPayments** | IPN failures logged but not retried | `nowpayments.routes.js:483-490` |
| **No Payment Refund API** | Refund status exists but no initiation flow | `orders.routes.js:1732` (status only) |
| **No Client-Facing Invoice PDF** | `pdf_url` column exists but no generation | `001_launch_contract.sql:235` |
| **Storage Bucket Contract Not Approved** | File upload works but bucket/policies not verified | `FINAL_LAUNCH_CHECKLIST.md:24`, `LAUNCH_MAP.md:32` |

### 11.3 Verification Coverage

| Test Suite | Coverage | Evidence |
|------------|----------|----------|
| Integration Tests | 24/24 passing | `backend/tests/integration.test.js` |
| Payment Verifier Tests | 7/7 passing | `backend/tests/payment-verifier.test.js` |
| Order Lifecycle Smoke | PASS | `FINAL_LAUNCH_CHECKLIST.md:26` |
| IDOR Prevention | PASS | `integration.test.js:167-218` |
| Auth/API Smoke | PASS | `FINAL_LAUNCH_CHECKLIST.md:20` |

---

## 12. State Machine Summary

### Order States
```
new → (payment created) → pending
pending → (IPN verified) → verified
verified → (staff) → processing
processing → (staff) → completed
completed → (auto) → invoice created (paid)
completed → (staff) → refunded
any → (staff) → cancelled
```

### Project Execution States
```
not_started
  ↓ (template applied + requirements created)
waiting_on_client
  ↓ (all required requirements submitted)
in_progress / waiting_on_founder
  ↓ (all tasks done)
ready_for_delivery
  ↓ (staff prepares)
prepared
  ↓ (staff sends)
client_review / delivered
  ↓ (client approves)
completed
  ↓ (revision requested)
revision_requested → in_progress
```

### Payment Statuses
```
pending → submitted → verified
              ↓
            failed
              ↓
            refunded
```

---

## 13. File Reference Index

| Component | File | Key Lines |
|-----------|------|-----------|
| Package Catalog API | `backend/src/api/routes/packages.routes.js` | 63-75, 92-103 |
| Order Creation API | `backend/src/api/routes/orders.routes.js` | 191-224, 283-525 |
| Payment Creation API | `backend/src/api/routes/orders.routes.js` | 532-1074 |
| NOWPayments Service | `backend/src/services/nowpayments.service.js` | 144-200 |
| NOWPayments IPN | `backend/src/api/routes/nowpayments.routes.js` | 162-647 |
| On-Chain Verifier | `backend/src/services/payment-verifier.js` | 53-80 |
| Order Status Transitions | `backend/src/api/routes/orders.routes.js` | 1700-2105 |
| Project Initialization | `backend/src/api/routes/service-delivery.routes.js` | 202-266 |
| Requirements API | `backend/src/api/routes/service-delivery.routes.js` | 268-364 |
| Execution (Milestones/Tasks) | `backend/src/api/routes/execution.routes.js` | 373-574 |
| Delivery Workflow | `backend/src/api/routes/service-delivery.routes.js` | 541-620 |
| Invoice Auto-Creation | `backend/src/api/routes/orders.routes.js` | 1987-2088 |
| Invoice Management | `backend/src/api/routes/invoices.routes.js` | 1-82 |
| Frontend Package Selection | `frontend/src/pages/PackagesPage.tsx` | 288-318, 372-461 |
| Frontend Payment Flow | `frontend/src/pages/PaymentPage.tsx` | 196-267, 249-251 |
| Frontend Project Workspace | `frontend/src/pages/ProjectWorkspacePage.tsx` | 105-158 |
| Database Schema (Core) | `database/migrations/001_launch_contract.sql` | 147-239, 411-450 |
| Database Schema (NOWPayments) | `database/migrations/013_nowpayments_integration.sql` | 22-132 |
| Database Schema (Delivery) | `database/migrations/006_service_delivery_engine.sql` | 1-105 |
| Launch Checklist | `docs/FINAL_LAUNCH_CHECKLIST.md` | 1-75 |

---

## Conclusion

The first-customer path is **fully implemented in code** with proper:
- ✅ API contracts
- ✅ Database schema + constraints
- ✅ State machines with enforced transitions
- ✅ Access control (RLS + middleware)
- ✅ Event sourcing (`order_events`, `project_activity`)
- ✅ Notifications
- ✅ Idempotency keys
- ✅ Test coverage (integration + unit)

**Single critical blocker**: **Payment verifier unconfigured** — no real USDC payments can be verified on-chain. The NOWPayments IPN path works but depends on external provider callback. Per `FINAL_LAUNCH_CHECKLIST.md:7-8`: **"READY AFTER EXTERNAL CONFIGURATION"**.

**Testimonial/Referral**: Not implemented — would require new tables, routes, and frontend surfaces.