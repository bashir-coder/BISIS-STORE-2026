# Conversion Path Audit – BISIS-V1

**Scope**: Frontend App.tsx routes + PackagesPage, LifePlanPage, DigitalProductsPage, LabPage, PaymentPage, Dashboard, ClientPortal, ClientDeliveryHome, Header/Footer/LiveStatusRibbon/FloatingButtons. Backend server.js, orders.routes.js, nowpayments.service.js, payment-verifier.js, auth & reCAPTCHA middleware.

**Classification**: ✅ Verified | ⚠️ Risk | 🛑 Blocker | ❓ Unknown

---

## 1. Frontend Route Map (App.tsx:145-250)

| Route | Page | Auth Required | Notes |
|-------|------|---------------|-------|
| `/` | HomePage | No (but human-verified gated) | Lazy loaded |
| `/packages` | PackagesPage | No | Main catalog entry |
| `/life-plan` / `/services/life-plan` | LifePlanPage | No | Signature subscription entry |
| `/lab` | LabPage | No | Educational / system status |
| `/payment` | PaymentPage | No (state-driven) | Requires `location.state` with package/service |
| `/dashboard` | Dashboard | **Yes** (Supabase session) | `useAuth` guards |
| `/portal` | ClientPortal | **Yes** (Supabase session) | `useAuth` guards |
| `/chat` | ChatPage | No (but human-verified gated) | Lazy loaded |
| `/login` / `/register` | LoginPage | No | Public |
| `/verify` / `/verify-email` | VerifyPage / VerifyEmailPage | No | Human verification / email confirmation |

**Auth Gate (App.tsx:44-108)**: All routes except `/verify` and `/verify-email` require `localStorage.BİŞİŞ_human_verified === 'true'`. If missing → redirect to `/verify` preserving original location in state.

---

## 2. CTA Payloads – Entry Points to PaymentPage

### 2.1 PackagesPage → PaymentPage (PackagesPage.tsx:565-578)
```tsx
<Link
  to="/payment"
  state={{
    ...(selectedPackage
      ? { packageId: selectedPackage.id, package: selectedPackage.name, amount: selectedPackage.price }
      : { serviceId: selectedService?.id, service: selectedService?.name, amount: selectedService?.price }),
  }}
>
```
**Payload**: `{ packageId, package, amount }` OR `{ serviceId, service, amount }`

### 2.2 LifePlanPage → PaymentPage (LifePlanPage.tsx:35)
```tsx
navigate('/payment', { state: { serviceId: 42, service: 'The Life Plan™', amount: 150 } })
```
**Payload**: Hardcoded `serviceId: 42`, amount `150` (monthly subscription)

### 2.3 DigitalProductsPage → PaymentPage (DigitalProductsPage.tsx:29-35)
```tsx
<Link to="/payment" state={{ package: prod.name, amount: prod.price }}>
```
**Payload**: `{ package: string, amount: string }` — **Missing `packageId` / `serviceId`**

### 2.4 LabPage → PaymentPage (LabPage.tsx:848-854)
```tsx
<Link to="/payment" className="...">  // No state passed
```
**Payload**: None — user lands on PaymentPage with no selection → shows "choose package" fallback (PaymentPage.tsx:419-448)

---

## 3. PaymentPage Flow (PaymentPage.tsx)

### 3.1 State Parsing (Lines 55-76)
```ts
const paymentState = (location.state || {}) as PaymentState
// Extracts: package, packageId, service, serviceId
```
- `pkgId` = integer `packageId` or null
- `serviceId` = integer `serviceId` or null

### 3.2 Catalog Resolution (Lines 111-157)
- If `pkgId` → `GET /api/packages` → find by `id`
- If `serviceId` → `GET /api/services` → find by `id`
- **Risk**: DigitalProductsPage passes `package` (name) not `packageId` → `pkgId` = null → catalog load skipped → `catalogItem` stays null

### 3.3 Order Creation (Lines 196-267) → `POST /api/orders`
```ts
await api.post('/api/orders', pkgId ? { package_id: pkgId } : { service_id: serviceId })
```
**Requires**: `pkgId` OR `serviceId` as integer
- **Blocker for DigitalProductsPage**: No numeric ID → `alert('A valid package or service must be selected before payment.')` (Line 198-200)

### 3.4 Payment Creation (Lines 234-252) → `POST /api/orders/:id/create-payment`
- Creates NOWPayments invoice via `nowpayments.service.createInvoice`
- On success: `window.location.assign(paymentData.invoice_url)` → redirects to NOWPayments hosted page

### 3.5 File Upload (Lines 343-397) → `POST /api/orders/:id/upload`
- Multer 10MB limit, allowed types: jpeg, png, gif, pdf, doc, docx
- Uploads to `order_files` table (file_kind: 'customer_input')

---

## 4. Backend Order Creation (orders.routes.js:283-525)

### 4.1 `POST /api/orders` (Line 283)
**Auth**: `authenticate` middleware required (Bearer token)

**Body**: `{ package_id?: number, service_id?: number }` — exactly one required

**Validation**:
- Package: active, price > 0 (Lines 320-351)
- Service: active, price > 0 (Lines 352-387)
- Amount must be finite > 0 (Lines 394-410)

**Insert Payload** (Lines 425-455):
```js
{
  amount: numericAmount,
  price: numericAmount,
  package_id: selectedPackage?.id || null,
  service: selectedService?.name || null,
  network: 'bsc',
  currency: 'USDC',
  full_name: req.user.full_name || 'Anonymous',
  email: req.user.email || null,
  workspace_id: req.user.workspace_id || null,
  payment_provider: 'nowpayments',
  status: 'new',
  payment_status: 'pending',
  submission_id: crypto.randomUUID(),
}
```

**Returns**: Created order with `id`, `submission_id`, etc.

### 4.2 `POST /api/orders/:id/create-payment` (Line 532)
**Auth**: `authenticate` + ownership check (order.user_id === req.user.id)

**Status Guards**:
- Blocks if order.status ∈ ['completed','cancelled','refunded'] (Lines 616-627)
- Blocks if payment_status === 'verified' (Lines 629-637)

**Invoice Reuse**: Returns existing invoice if `payment_url` exists and status ∈ ['waiting','pending'] (Lines 643-702)

**NOWPayments Invoice Creation** (Lines 758-781):
```js
createInvoice({
  priceAmount: amount,
  orderId: String(order.id),
  orderDescription: order.package || order.service || `BİŞİŞ Order #${order.id}`,
  ipnCallbackUrl: `${PUBLIC_API_URL}/api/orders/${order.id}/nowpayments-ipn`,
  successUrl: `${PUBLIC_WEB_URL}/payment/success?order_id=${order.id}`,
  cancelUrl: `${PUBLIC_WEB_URL}/payment/cancelled?order_id=${order.id}`,
  customerEmail: req.user.email || order.email,
})
```

**Response** (Lines 992-1051): Full payment data including `invoice_url`, `pay_address`, `pay_amount`, `pay_currency` (usdcbsc), `payment_status` (waiting), `purchase_id`.

---

## 5. NOWPayments Service (nowpayments.service.js)

### 5.1 `createInvoice` (Lines 144-200)
- Fixed: `price_currency: 'usd'`, `pay_currency: 'usdcbsc'` (Line 158-159)
- **Note**: Does NOT set `pay_currency` dynamically — hardcoded to USDC on BSC
- Requires `NOWPAYMENTS_API_KEY` env var (Lines 3-18)

### 5.2 IPN Callback Routes (server.js:302-311)
- `/api/nowpayments/ipn` (primary)
- `/api/orders/:id/nowpayments-ipn` (compatibility — used by `create-payment`)

---

## 6. IPN Handler (nowpayments.routes.js:162-647)

### 6.1 Signature Verification (Lines 174-214)
- HMAC-SHA512 with `NOWPAYMENTS_IPN_SECRET_KEY`
- Timing-safe comparison

### 6.2 Currency Validation (Lines 220-252)
- **Blocker**: Only accepts `pay_currency === 'usdcbsc'` and `price_currency === 'usd'` (Lines 233-252)
- Any other currency → 400 "Unsupported payment currency"

### 6.3 Status Mapping (Lines 98-134)
| NOWPayments Status | Internal Status |
|-------------------|-----------------|
| waiting | pending |
| confirming/confirmed/sending | submitted |
| finished | **verified** |
| partially_paid | submitted |
| failed/expired | failed |
| refunded | refunded |

### 6.4 Order Update (Lines 369-402)
- Updates `payment_status`, `txid` (from `payin_hash`), `network: 'bsc'`, `currency: 'USDC'`
- **Does NOT auto-transition order.status** — stays 'new' until admin moves to 'processing'

### 6.5 Notifications (Lines 496-601)
- Creates notifications for user on `verified`, `failed`, `refunded`

---

## 7. Payment Verifier (payment-verifier.js)

### 7.1 `verifyPolygonUsdcPayment` (Lines 53-80)
- **Configured for Polygon (chainId 0x89)** — NOT BSC
- Checks: chainId, token address (USDC), recipient address, confirmations (≥12), exact amount match
- **Mismatch**: Frontend/orders use `network: 'bsc'` and `pay_currency: 'usdcbsc'` but verifier only supports Polygon
- **Status**: Unused by current IPN flow (IPN trusts NOWPayments); available for manual verification

---

## 8. Auth Middleware (auth.middleware.js)

### 8.1 `authenticate` (Lines 64-94)
- Extracts Bearer token from `Authorization` header
- Validates via `supabase.auth.getUser(token)`
- Provisions/updates user profile in `users` table
- Blocks if `user.is_active === false` → 403 `ACCOUNT_INACTIVE`

### 8.2 `authorize(...roles)` (Lines 96-106)
- Checks `req.user.role` against allowed roles

### 8.3 Role Resolution (Lines 5-14)
- Priority: `app_metadata.role` → `raw_app_meta_data.role` → `user_metadata.role`
- Default: `'client'`
- Valid roles: `['client','manager','editor','admin','super_admin']`

---

## 9. reCAPTCHA Middleware (recaptcha.middleware.js)

### 9.1 `verifyRecaptcha` (Lines 7-145)
- Expects `recaptchaToken` in request body
- Verifies with Google (`score ≥ 0.5`, `action === 'pre_entry'`)
- **Used at**: `POST /api/security/verify-recaptcha` (server.js:285-295)
- **Not enforced** on order creation or payment endpoints

---

## 10. Delivery / Service-Delivery Flow (service-delivery.routes.js)

### 10.1 Project Initialization (Line 202)
`POST /api/service-delivery/orders/:orderId/initialize` — Admin only
- Requires: `order.payment_status ∈ ['verified','paid','completed']` OR `order.status === 'processing'` (Line 213)
- Creates project from template, links to order

### 10.2 Client Home (Line 508) → Used by `ClientDeliveryHome` component
`GET /api/service-delivery/client/home`
- Returns `{ projects: ClientProject[], actions: [] }`
- Called by Dashboard (ClientDeliveryHome.tsx:35) and ClientPortal

### 10.3 Client Project View (Line 366)
`GET /api/service-delivery/projects/:projectId/client-view`
- Returns summarized project with milestones, tasks, requirements, delivery, files

### 10.4 Requirements Flow
- Staff creates requirements → `POST /projects/:projectId/requirements` (Line 285)
- Client submits response/file → `PATCH /projects/:projectId/requirements/:requirementId` (Line 319)
  - Client must upload file to `order_files` first (file_kind: 'customer_input') (Lines 336-343)
  - Sets requirement status = 'submitted'
- Auto-updates project execution_state via `deriveState()`

### 10.5 Delivery Flow (Staff only)
- `POST /delivery/prepare` → status 'prepared' → state 'ready_for_delivery'
- `POST /delivery/send` → status 'client_review' → state 'waiting_on_review' + notification
- Client: `POST /delivery/approve` → status 'completed' → state 'completed'
- Client: `POST /delivery/revision` → status 'revision_requested' (max 5) → state 'in_progress'

---

## 11. Dashboard & ClientPortal Integration

### 11.1 Dashboard (Dashboard.tsx)
- Loads: `/api/orders/my-orders`, `/api/orders/notifications`, `/api/tickets/my`, `/api/faqs`
- Renders `ClientDeliveryHome` (Line 573) — shows active projects + next action
- Order detail modal includes chat (`/api/chat?order_id=`)

### 11.2 ClientPortal (ClientPortal.tsx)
- Loads: `/api/orders/my-orders` (same as Dashboard)
- Renders `ClientDeliveryHome` (Line 85)
- Shows stats + order list with OrderLifecycle

### 11.3 ClientDeliveryHome (ClientDeliveryHome.tsx)
- Calls `GET /api/service-delivery/client/home` (Line 35)
- Shows first action as CTA link to `/projects/:id`
- Displays project cards with progress, milestone, next_action

---

## 12. Header / Footer / LiveStatusRibbon / FloatingButtons

### 12.1 Header (Header.tsx)
- Supabase auth session sync (Lines 42-79) — updates on `storage` and `auth-changed` events
- User menu: Dashboard, Admin (if role=admin), Logout
- Mobile responsive nav

### 12.2 Footer (Footer.tsx)
- Static links to packages, about, FAQ, contact, socials

### 12.3 LiveStatusRibbon (LiveStatusRibbon.tsx)
- Static metrics display (Operational, <15m Instant, Polygon USDC, AR·TR·EN)
- **Risk**: Shows "Polygon USDC" but payment flow uses BSC/USDC

### 12.4 FloatingButtons (FloatingButtons.tsx)
- Social links (WhatsApp, Telegram, Instagram, X, YouTube)
- Back-to-top button (appears after 180px scroll)

---

## 13. Summary Classification by Flow

| Flow Step | Classification | Evidence |
|-----------|---------------|----------|
| **PackagesPage → PaymentPage** | ✅ Verified | Correct payload with numeric IDs; order creation works |
| **LifePlanPage → PaymentPage** | ✅ Verified | Hardcoded serviceId=42, amount=150; works if service exists |
| **DigitalProductsPage → PaymentPage** | 🛑 Blocker | Passes `package` (name string) not `packageId`; PaymentPage requires numeric ID (Line 198) |
| **LabPage → PaymentPage** | ⚠️ Risk | No state passed; user sees "choose package" fallback |
| **Order Creation (POST /api/orders)** | ✅ Verified | Auth required, validates package/service, creates order with submission_id |
| **Payment Creation (POST /api/orders/:id/create-payment)** | ✅ Verified | Ownership check, status guards, invoice reuse, NOWPayments integration |
| **NOWPayments Invoice (createInvoice)** | ✅ Verified | Fixed USDC/BSC; requires API key |
| **IPN Callback** | ✅ Verified | Signature verification, status mapping, order update, notifications |
| **Currency Enforcement (IPN)** | 🛑 Blocker | Only accepts `usdcbsc`/`usd`; no fallback for other currencies |
| **Payment Verifier (Polygon)** | ❓ Unknown | Configured for Polygon (0x89) but flow uses BSC; not integrated in IPN |
| **Auth Middleware** | ✅ Verified | Supabase JWT validation, profile provisioning, role resolution |
| **reCAPTCHA Middleware** | ⚠️ Risk | Only on `/api/security/verify-recaptcha`; not protecting order/payment endpoints |
| **File Upload (PaymentPage)** | ✅ Verified | Multer 10MB, allowed types, uploads to order_files |
| **Project Initialization** | ✅ Verified | Admin only, requires verified/paid order, template-based |
| **Requirements Flow** | ✅ Verified | Staff creates, client submits (with file linkage), auto-state updates |
| **Delivery Flow** | ✅ Verified | prepare → send → approve/revision, notifications, state machine |
| **Client Home (Dashboard/Portal)** | ✅ Verified | Aggregates projects, actions, notifications via service-delivery |
| **LiveStatusRibbon Currency** | ⚠️ Risk | Displays "Polygon USDC" but system uses BSC |

---

## 14. Critical Blockers

1. **DigitalProductsPage → PaymentPage broken** (DigitalProductsPage.tsx:32 vs PaymentPage.tsx:198)
   - Fix: Pass `packageId` / `serviceId` integers in Link state, or add digital product order endpoint

2. **Currency mismatch: LiveStatusRibbon says "Polygon USDC" but NOWPayments uses BSC/USDC** (LiveStatusRibbon.tsx:21 vs nowpayments.service.js:114)
   - Fix: Align messaging or support both networks

3. **Payment verifier configured for Polygon only** (payment-verifier.js:58) — unused but misleading if documented

4. **reCAPTCHA not protecting order/payment endpoints** — only on dedicated verify endpoint

---

## 15. Risks to Monitor

- **Invoice reuse logic** (orders.routes.js:643-702): Returns existing invoice if status 'waiting'/'pending' — could show stale address if user retries after expiry
- **No webhook retry handling visibility** — IPN returns 200 even for unknown status (Line 304-309) to stop retries, but order not updated
- **Order.status not auto-advanced on payment verification** — requires admin to move 'new' → 'processing' (orders.routes.js:1857-1864 blocks transition if payment not verified)
- **Digital products have no delivery mechanism** — `digital-products.routes.js` only serves catalog; no order/delivery integration
- **Hardcoded serviceId=42 in LifePlanPage** — fragile if service ID changes

---

## 16. Verification Checklist

- [x] PackagesPage CTA passes correct payload
- [x] LifePlanPage CTA passes correct payload
- [x] PaymentPage creates order → payment → redirects to NOWPayments
- [x] IPN verifies signature, maps status, updates order, notifies user
- [x] Dashboard/Portal show orders, notifications, projects via service-delivery
- [x] Requirements & delivery flows functional with state machine
- [ ] DigitalProductsPage → PaymentPage (BLOCKED)
- [ ] LabPage → PaymentPage (no selection)
- [ ] Currency messaging consistency (Polygon vs BSC)
- [ ] reCAPTCHA on sensitive endpoints
- [ ] Payment verifier network alignment

---

*Generated from read-only code inspection. No modifications made.*