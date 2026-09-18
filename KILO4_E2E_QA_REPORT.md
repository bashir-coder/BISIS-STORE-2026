# KILO #4 — E2E / QA REPORT

**Independent release test:** BİŠIŞ V1 customer journey  
**Test date:** 2026-09-18  
**Scope:** Local runtime and isolated QA accounts only. No production customer data, paid transaction, code changes, commits, or deployment changes.

---

## 1. Environment

* **Frontend:** Local Vite runtime at `http://127.0.0.1:3000`; current repository build.
* **Backend:** Local Express runtime at `http://127.0.0.1:5000`; runtime configuration reports `NODE_ENV=production`, but this was not a production deployment.
* **Database:** External Supabase project used only for isolated QA records. Test accounts and orders were cleaned up after testing.
* **Browser:** Chrome 153 headless through CDP at `http://127.0.0.1:9224`; desktop, mobile, and tablet viewport probes.
* **Test accounts:** Temporary Customer A and Customer B accounts with confirmed email state, created through the QA/admin path. No real customer data was used.
* **Production E2E boundary:** **NOT VERIFIED**. No production frontend, production backend, real customer, or paid transaction was exercised.

---

## 2. Customer Journey

| Stage | Result | Evidence |
| --- | --- | --- |
| Visit | **PARTIAL — RUNTIME VERIFIED** | Homepage rendered in Chrome; no broken hero assets or horizontal overflow were observed on the tested landing view. Navigation and every CTA were not exhaustively exercised. |
| Register | **PARTIAL — RUNTIME VERIFIED** | Invalid email and invalid short-password cases were rejected by the form. Successful UI registration was not completed; QA accounts were created through the admin path instead. |
| Verify email | **NOT TESTED — ENVIRONMENT BLOCKED** | The verification entry reached `/verify`, but the supported verification UI did not load in headless Chrome. |
| Login | **PARTIAL — RUNTIME VERIFIED** | Invalid credentials were rejected. Valid UI login, logout, and session persistence were not fully exercised. |
| Browse services | **PARTIAL — RUNTIME VERIFIED** | Package/catalog API and package page rendered. A complete service-detail journey was not verified. |
| Select package | **PASS — RUNTIME VERIFIED** | Foundation selection rendered at `$699.00` and navigated toward `/payment`. |
| Create order | **PASS — RUNTIME VERIFIED** | Isolated orders were created for Customer A and Customer B with the selected package, price, and customer binding. |
| Payment | **PARTIAL — RUNTIME VERIFIED** | A real NOWPayments invoice was created for a Foundation order. No funds were paid and no paid state was claimed. |
| NOWPayments | **PARTIAL — RUNTIME VERIFIED** | Invoice creation returned a provider invoice with `waiting` status and the expected BSC USDC payment currency. |
| IPN | **NOT TESTED — ENVIRONMENT BLOCKED** | No paid provider event or IPN was generated or received. |
| Payment status | **PARTIAL — RUNTIME VERIFIED** | The order remained in a non-paid waiting state after invoice creation; no false `paid`/`verified` state was observed. Return-page status loading was not completed. |
| Processing | **NOT TESTED** | No trusted paid event was available to enter processing. |
| Delivery | **NOT TESTED** | No paid/processing order was available for delivery verification. |
| Completion | **NOT TESTED** | Customer confirmation, approval, revision, and completion were not exercised. |

**Negative cases actually executed:** invalid signup fields, invalid login, invalid order ID, and cross-customer direct-order access. Double-click submission, refresh during provider return, browser back after payment, cancel return, missing `order_id`, and network-failure recovery were not completed and are not marked PASS.

---

## 3. Security Smoke

| Test | Result | Evidence |
| --- | --- | --- |
| Customer A → own data | **PASS — RUNTIME VERIFIED** | Customer A could read their own order. |
| Customer A → Customer B | **PASS — RUNTIME VERIFIED** | Cross-customer order access was denied/not visible. |
| Client → Admin | **PASS — RUNTIME VERIFIED** | Client request to the admin endpoint returned `403`. |
| Unauthenticated → protected | **PASS — RUNTIME VERIFIED** | Protected request without a valid session returned `401`. |
| IDOR | **PASS — RUNTIME VERIFIED** | Direct access to another customer's order was denied; an invalid order ID returned `404`. |

Payment-status tampering and live IPN signature/replay behavior were not exercised in this QA pass.

---

## 4. i18n

* **AR:** Partial runtime coverage. Landing, package, auth validation, and Arabic verification-page probes rendered without a raw missing-key string in the tested surfaces. RTL switching from Arabic was observed.
* **EN:** Partial runtime coverage. Language switching changed the root direction from `rtl` to `ltr`; the tested pages rendered English content.
* **TR:** Controls and Turkish fallback content are present, but the full TR journey was not runtime-verified.
* **Missing keys:** `nav.lab` is absent from the fallback/seed translation resources. `Header.tsx` supplies an English fallback, so the header can show English in AR/TR.
* **Mojibake:** No new mojibake was observed in the tested browser surfaces. A separate Unicode brand inconsistency remains: the official name is `BİŠIŠ`, while customer-facing UI and translations frequently use `BİŞIŞ`.
* **Payment copy:** The payment description says Polygon USDC while the live invoice path and invoice card say BSC USDC. This is a functional customer-instruction defect, not merely cosmetic.

---

## 5. Browser / Responsive

* **Desktop:** Homepage and package page loaded without horizontal overflow; package selection and Foundation card were usable. Payment success/cancel pages were not fully captured before runtime instability.
* **Mobile:** Tested home/package viewports had no observed horizontal overflow or inaccessible primary package CTA. Payment and dashboard layouts were not fully verified.
* **Tablet:** Tested home/package viewport had no observed horizontal overflow. Full tablet journey coverage was not completed.
* **Browser limitation:** Local background processes were intermittent between probes. Any stage that terminated before evidence was captured remains **NOT TESTED**.

---

## 6. Console / Network

Only material errors from the executed probes are recorded:

1. Human-verification page displayed: `تعذر تحميل نظام التحقق. أعد تحميل الصفحة وحاول مرة أخرى.` This blocked verification in the headless browser and is classified as **environment-blocked**, not as a successful verification.
2. `GET /api/orders/<order-id>` returned `404`. Both `PaymentSuccess.tsx:69` and `PaymentCancelled.tsx:41` call this endpoint, so return-page order loading is broken by the missing backend route.
3. NOWPayments rejected a reserved `.example.test` customer email with `INVALID_REQUEST_PARAMS`. This prevented a conventional reserved-domain test account; it is a test-data limitation, not evidence of a successful payment.
4. No CORS or 5xx response was observed in the successful local probes. No console-breaking error was observed on the tested homepage/package views.

---

## 7. Defects

| Severity | Issue | Evidence | Owner |
| --- | --- | --- | --- |
| **P0** | Payment rail and verifier are not aligned or launch-configured. | NOWPayments invoice creation uses `usdcbsc`/BSC (`backend/src/services/nowpayments.service.js:111-119`; `backend/src/api/routes/orders.routes.js:972-1054`), while the verifier requires Polygon and rejects other configuration (`backend/src/services/payment-verifier.js:7-23`). Web3 RPC, contract, and recipient values are placeholders, and `WEB3_NETWORK` is not aligned. | Payment / Backend |
| **P1** | Customer-facing payment copy contradicts the actual invoice rail. | `PaymentPage.tsx:550-563` renders Polygon copy followed by a BSC invoice card; fallback translations also contain Polygon copy at `frontend/src/i18n-fallback.ts:462` and `:472-476`. | Frontend / Payment |
| **P1** | Payment success and cancel pages cannot load order status. | `frontend/src/pages/PaymentSuccess.tsx:69` and `frontend/src/pages/PaymentCancelled.tsx:41` call `GET /api/orders/${orderId}`; the backend route table has no `GET /:id` handler (`backend/src/api/routes/orders.routes.js:283-285`, `:532-534`, `:1278-1280`). Runtime probe returned `404`. | Backend / Frontend contract |
| **P1** | Public success/cancel return URLs are undefined in the current configuration. | `backend/src/api/routes/orders.routes.js:898-910` only constructs return URLs when a public web URL exists; the configured public frontend value is a placeholder. | Infrastructure / Backend |
| **P1** | Human verification is blocked in the tested browser environment. | `/verify` loaded but displayed the verification-load error; no supported-browser verification completion was obtained. | Infrastructure / QA |
| **P2** | Official brand spelling is inconsistent in customer-facing surfaces. | Official spelling is `BİŠIŠ`; `Header.tsx:131,190-201` and `LabPage.tsx:266` use it correctly, while `Footer.tsx:60-65`, translations, PaymentPage, and other UI strings use `BİŞIŞ`. | Frontend / i18n |
| **P2** | `nav.lab` translation key is missing. | `Header.tsx:131` calls `t('nav.lab', 'BİŠIŠ LAB')`; no localized `nav.lab` key was found in the fallback/seed resources, causing an English fallback in AR/TR. | i18n |
| **P2** | Canonical package prices are formatted without thousands separators. | API values are correct, but `PackagesPage.tsx:422` renders `$1499.00`/`$2499.00` rather than the canonical `$1,499.00`/`$2,499.00` presentation. | Frontend |
| **P1** | Migration gate fails. | `npm run migration:check` failed because `database/migrations/015_rls_recursion_fix.sql` is unexpected against the canonical migration list. | Release Control / Database |
| **P2** | Lint gate fails. | `npm run lint` failed at `backend/tests/runtime-test.js:76` with an unnecessary semicolon; six additional warnings were reported. | Release Control |

---

## 8. Tests Actually Run

| Test | Result | Evidence |
| --- | --- | --- |
| Backend unit/integration suite (`npm test`) | **PASS** | Backend test command completed successfully. |
| Frontend TypeScript check (`npm run typecheck`) | **PASS** | No type errors reported. |
| Frontend production build (`npm run build`) | **PASS** | Vite build completed successfully. |
| Backend lint (`npm run lint`) | **FAIL** | `backend/tests/runtime-test.js:76`; six warnings also reported. |
| Migration validation (`npm run migration:check`) | **FAIL** | Unexpected migration `015_rls_recursion_fix.sql`. |
| Backend liveness/readiness/catalog probes | **PASS** | `/api/live`, `/api/ready`, and `/api/packages` responded successfully. |
| Package price API probe | **PASS** | Foundation `$699`, Growth `$1,499`, Scale `$2,499`. |
| Order creation and ownership smoke | **PASS** | A/B orders created; own access allowed and other-customer access denied. |
| Auth boundary smoke | **PASS** | Unauthenticated request `401`; client-to-admin request `403`. |
| Real NOWPayments invoice creation | **PASS — INVOICE ONLY** | Invoice created for `$699` with BSC USDC and remained `waiting`; no payment was completed. |
| Browser landing/package/language/auth probes | **PARTIAL** | Homepage/package rendering, AR→EN direction switch, invalid signup, and invalid login were observed. |
| Responsive overflow probes | **PARTIAL** | No overflow observed on tested desktop/mobile/tablet home/package viewports. |
| Live payment/IPN/status/delivery/completion | **NOT TESTED** | No funds paid and no trusted paid event was available. |

---

## 9. Production E2E

**NOT VERIFIED**

The local runtime does not establish production readiness. No production customer journey, live paid transaction, production IPN, production delivery, or production customer confirmation was verified.

---

## 10. Status

**🔴 E2E / QA — BLOCKED**

The local journey reaches order creation and invoice creation, but the first customer cannot be safely completed because the payment rail/verifier contract is inconsistent, payment return URLs are not configured, and success/cancel status loading has no matching order-detail route. Production E2E remains unverified.

---

## 11. Next Dependency

**Revalidate the complete paid journey only after the payment network/verifier contract, order-detail route, and public return URL are aligned and runtime-verified end to end.**
