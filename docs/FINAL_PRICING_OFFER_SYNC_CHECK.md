# BİŞİŞ V1 — Final Pricing + Offer Sync Check

**Auditor**: Kilo #4  
**Date**: September 13, 2026  
**Scope**: Source-of-truth sync check for Foundation Package pricing, offer clarity, and acquisition readiness  
**Rule**: No price changes. Read-only verification.

---

## 1. CANONICAL PRICE

### Foundation = $699 — ✅ PASS

| Source | Value | Status | Customer-Facing? |
|--------|-------|--------|-------------------|
| `database/seeds/packages.json:7` | $699 | ✅ CORRECT — canonical seed | Indirect (via API) |
| Backend API (`packages.routes.js`) | Serves from Supabase | ✅ Will reflect database | ✅ Yes (PackagesPage) |
| Order creation (`orders.routes.js`) | Server-side from database | ✅ No hardcoded price | No (backend only) |
| Payment (`nowpayments.service.js`) | Uses order amount | ✅ Dynamic | No (backend only) |

**Foundation price is correct in the canonical data layer.** The API serves $699 for Foundation if the database was seeded from `packages.json`.

---

## 2. STALE PRICES — Customer-Facing Conflicts Found

### 🔴 CONFLICT 1: AIChatbot.tsx (CUSTOMER-FACING)

**File**: `frontend/src/components/AIChatbot.tsx:86,148,210`  
**Content**: FAQ answer to "What are your package prices?" in all 3 languages:

| Language | Package 1 | Package 2 | Package 3 |
|----------|-----------|-----------|-----------|
| Arabic | Starter $249 | Growth $649 | Investor-Ready $1,499 |
| English | Starter $249 | Growth $649 | Investor-Ready $1,499 |
| Turkish | Starter Paketi $249 | Growth Paketi $649 | Investor-Ready Paketi $1,499 |

**Problem**: Customer-facing FAQ quotes DIFFERENT NAMES (Starter/Growth/Investor-Ready) and DIFFERENT PRICES ($249/$649/$1,499) than the canonical seed (Foundation/Growth/Scale at $699/$1,499/$2,499).

A customer who uses the chatbot and then visits /packages will see different names and prices.

### 🔴 CONFLICT 2: constants.ts (FRONTEND CONSTANTS)

**File**: `frontend/src/utils/constants.ts:10–50`  
**Content**: `PACKAGES` array with:
- Starter = $249
- Growth = $649
- Investor = $1,499

**Problem**: Different names AND different prices from canonical seed.

**Note**: `PACKAGES` from `constants.ts` appears to be UNUSED in actual frontend rendering. The PackagesPage fetches from `/api/packages`. However, the existence of this conflicting data in the codebase is a maintenance risk.

### 🟡 CONFLICT 3: i18n translations (Package Names)

**File**: `frontend/src/i18n-fallback.ts`  
**Content**:
- `packages.starter.name` = "Starter"
- `packages.growth.name` = "Growth"
- `packages.investor.name` = "Investor-Ready"
- `packages.foundation.name` = **NOT FOUND**
- `packages.scale.name` = **NOT FOUND**

**Problem**: The i18n translation keys use Starter/Growth/Investor-Ready naming. No Foundation or Scale keys exist. If the frontend ever switches to using these translation keys for package display, it will show "Starter" instead of "Foundation."

**However**: The PackagesPage currently renders `pkg.name` from the API response (dynamic), not from i18n keys. So this is a latent risk, not an active conflict.

### Summary of Stale Prices

| Stale Price | Location | Customer-Facing | Severity |
|-------------|----------|------------------|----------|
| Starter $249 | `AIChatbot.tsx:86,148,210` | ✅ YES — FAQ chatbot | 🔴 HIGH |
| Growth $649 | `AIChatbot.tsx:86,148,210` | ✅ YES — FAQ chatbot | 🔴 HIGH |
| Investor-Ready $1,499 | `AIChatbot.tsx:86,148,210` | ✅ YES — FAQ chatbot | 🔴 HIGH |
| Starter $249 | `constants.ts:15` | ❌ Unused in rendering | 🟡 MEDIUM |
| Growth $649 | `constants.ts:28` | ❌ Unused in rendering | 🟡 MEDIUM |
| Investor $1,499 | `constants.ts:41` | ❌ Unused in rendering | 🟡 MEDIUM |
| "Starter/Growth/Investor-Ready" names | `i18n-fallback.ts:444-446,1028-1030,1612-1614` | ❌ Not currently used for packages | 🟡 MEDIUM |

### Prices NOT Found in Customer-Facing Areas (CONFIRMED SAFE)

| Location | Has pricing? | Status |
|----------|-------------|--------|
| `frontend/src/sections/Hero.tsx` | No — shows 18/3/6/V1 stats only | ✅ Safe |
| `frontend/src/sections/About.tsx` | No — shows 18/3/6/V1 stats only | ✅ Safe |
| `frontend/src/sections/StatsStrip.tsx` | No — shows 18/3/6/V1 stats only | ✅ Safe |
| `frontend/src/pages/PackagesPage.tsx` | Dynamic from `/api/packages` | ✅ Safe (if DB seeded correctly) |
| `frontend/src/pages/ContactPage.tsx` | No pricing — contact info only | ✅ Safe |
| `frontend/src/i18n-fallback.ts` (body) | No price numbers at all | ✅ Safe |

---

## 3. SOURCE OF TRUTH

### Where price SHOULD be:

| Layer | Source of Truth | Current State |
|-------|----------------|---------------|
| Canonical package price | `database/seeds/packages.json` | ✅ Foundation = $699 |
| Displayed on website | Backend API (`/api/packages` from Supabase) | ✅ Reflects database (if seeded from packages.json) |
| Order price | Backend `orders.routes.js` (server-side from package record) | ✅ No hardcoded price in order creation |
| Payment amount | Backend `payment-verifier.js` / `nowpayments.service.js` (from order) | ✅ Dynamic from order |
| Invoice amount | Backend `invoices.routes.js:56` (from order.amount/order.price) | ✅ Dynamic from order |
| FAQ answers | `AIChatbot.tsx` (hardcoded) | ❌ WRONG — quotes stale prices |
| Frontend constants | `constants.ts` (hardcoded) | ❌ WRONG — different prices (unused but exists) |

### Single Source of Truth for Pricing:

**`database/seeds/packages.json`** → served by **`backend/src/api/routes/packages.routes.js`** → consumed by **`frontend/src/pages/PackagesPage.tsx`** → displayed to customer.

Everything else that contains pricing should either be removed or aligned to this source.

---

## 4. OFFER: Is Foundation Clear for the Customer?

### Package Name Conflict

| Source | Package Name |
|--------|-------------|
| `packages.json` | **Foundation** |
| `constants.ts` | **Starter** |
| `AIChatbot.tsx` | **Starter** |
| `i18n-fallback.ts` | **Starter** (translation key) |
| `Footer.tsx:13` | `packages.starter.name` → **"Starter"** (navigation link) |

The canonical package is called **Foundation** in the data layer but **Starter** in frontend translations, constants, and FAQ. The PackagesPage currently renders the API name (Foundation), but the navigation Footer link says "Starter."

**This is a naming conflict, not a price conflict for the canonical display, but it will confuse customers who hear "Starter" from the chatbot or see "Starter" in navigation and then see "Foundation" on the packages page.**

### Offer Clarity Assessment

| Element | Status | Detail |
|---------|--------|--------|
| Package name | 🟡 CONFLICT | Foundation vs Starter — depends on which name the founder chooses |
| Price | ✅ CLEAR | $699 (from canonical seed via API) |
| Deliverables | ✅ CLEAR | 7 specific services listed in packages.json |
| Delivery | ✅ CLEAR | 1–24h per service (from services.json) |
| What's excluded | 🟡 MISSING | No explicit exclusions documented |
| Revision policy | 🟡 MISSING | Not defined anywhere |
| CTA | 🟡 MANUAL | "استكشف الباقات" (Explore packages) → /packages |
| Payment method | 🟡 MANUAL | Not configured online; manual for first customers |

### Offer Verdict:

**Foundation is clear in terms of price and deliverables via the canonical path.** But:
- The name conflict (Foundation vs Starter) creates confusion
- Exclusions and revision policy are undocumented
- Payment requires manual handling for first customers

---

## 5. FIRST CUSTOMER: Can the Offer Be Sold Manually Now?

| Requirement | Met? | How |
|-------------|------|-----|
| Clear offer | ✅ | Foundation, $699, 7 deliverables |
| Clear price | ✅ | $699 (need founder to confirm as final) |
| Reachable customer | ✅ | Gaza/regional founders via WhatsApp/LinkedIn |
| Delivery capability | ✅ | Founder delivers manually |
| Payment collection | ✅ | Manual (bank/cash/USDC invoice) |
| Communication | ✅ | WhatsApp, email, Google Drive |
| Trust building | 🟡 | No testimonials yet — founder identity + free discovery call |

### Manual Sale Feasibility: ✅ YES

**A founder can sell Foundation to a Gaza/regional founder right now via WhatsApp with:**
1. A personalized message referencing the prospect's specific situation
2. A clear offer: "Foundation — 7 strategy deliverables for $699, delivered in 1–3 days"
3. Manual payment arrangement
4. Delivery via WhatsApp + Google Drive

### Missing for smooth manual sale:
- One-page offer document (not yet created)
- Revision policy (not yet defined)
- Founder must decide on a single consistent price for all outreach

---

## 6. LIFE PLAN

### Status: EXCLUDE FROM FIRST LAUNCH

| Check | Finding |
|-------|---------|
| Production-ready? | ❌ NO — `subscription.routes.js` creates active subscription WITHOUT payment verification or entitlement check |
| Customer-facing price correct? | $150/month in `LifePlanPage.tsx:11` matches `constants.ts:52` (`LIFE_PLAN_PRICE = 49`) ❌ CONFLICT |
| Implementation matches promise? | ❌ NO — subscription activates without payment; LifePlanPage description promises "AI analysis, human review, planning, routines, continuous updates" but no verified implementation exists |
| Can cause confusion with Foundation? | ❌ YES — Life Plan is a subscription ($150/month or $49/month in different sources) vs Foundation is a one-time package ($699). Having both live would confuse first customers about what they're buying |

**Classification: EXCLUDE FROM FIRST LAUNCH**  
Life Plan is frozen per `BİŞİŞ_V1_Rescue_and_Launch_Plan.md:180` and `BİŞİŞ_Strategic_Review.md:175`. Do not expose to customers until subscription payment verification, entitlement, and cancellation/refund policies are fully implemented.

### Additional Confirmed Life Plan Issues:
- **Price conflict**: LifePlanPage says $150/month, constants.ts says $49/month
- **No entitlement logic**: subscription.routes.js creates active status without verifying payment
- **Navigation**: Still potentially accessible via route
- **Per launch plan**: Must be hidden until complete payment/entitlement/cancellation flow exists

---

## 7. TAX

### Status: LEGAL/BUSINESS DECISION REQUIRED

**Finding**: `backend/src/api/routes/invoices.routes.js:58`

```javascript
const tax = Number((amount * 0.15).toFixed(2))
```

**The invoice system automatically calculates 15% tax on the order amount.** This is hardcoded.

**For a Gaza/regional customer ordering Foundation at $699:**
- Order amount: $699
- Tax (15%): $104.85
- Total: $803.85

**This MUST NOT go live without a legal/business decision because:**
1. Tax laws vary by jurisdiction (Gaza, Palestine, Turkey, etc.)
2. 15% may or may not be correct for the founder's legal entity type
3. Tax may not apply to certain types of service in certain jurisdictions
4. No legal entity or tax registration is documented in the project files
5. The 15% appears to be hardcoded with no documentation of its basis

**For the first customer**: The founder should either:
- A) Not issue a formal invoice (use a simple receipt/payment record instead), OR
- B) Decide with a legal advisor that 15% is correct for their situation, OR
- C) Remove the tax calculation until a legal determination is made

---

## 8. REMAINING BLOCKERS

### 🔴 TRUE BLOCKERS (prevent first customer sale)

| # | Blocker | Type | Resolution |
|---|---------|------|------------|
| 1 | **AIChatbot.tsx quotes wrong prices ($249/$649/$1,499) to customers** | PRICING INTEGRITY | Must be updated before any customer uses the chatbot for pricing info. If chatbot is live, it will actively mislead customers. |
| 2 | **15% tax hardcoded in invoices with no legal basis** | LEGAL RISK | Must decide: issue invoice with tax, without tax, or no invoice at all for first customers. |

### 🟡 MANUAL CONTROLS ACCEPTABLE

| # | Item | Why Not a Blocker |
|---|------|-------------------|
| 3 | No one-page offer document | Founder can describe verbally; document is for consistency |
| 4 | No revision policy written | Founder can define in conversation; 1-round is reasonable |
| 5 | No testimonials yet | Expected for first customer; founder identity substitutes |
| 6 | Payment not online | Manual collection is acceptable for first 1–10 customers |
| 7 | Foundation vs Starter naming | Internal cleanup; doesn't prevent sale if founder uses one name consistently |

### 🟢 POST-LAUNCH

| # | Item | When |
|---|------|------|
| 8 | constants.ts alignment | After first 3 customers, before scaling |
| 9 | i18n translation update | After name/price decision finalized |
| 10 | Life Plan re-evaluation | Post-launch when subscription infrastructure is complete |

---

## 9. FINAL VERDICT

### 🟡 FIRST CUSTOMER READY WITH MANUAL CONTROLS

### Justification:

**What is READY:**
- Foundation package is correctly priced at $699 in the canonical data layer
- The API serves correct prices from the database
- The offer (7 deliverables, $699, 1–24h delivery) is concrete and sellable
- All manual acquisition and delivery mechanics are available
- Customer-facing Hero/About pages correctly show 18 services, not 1800

**What requires MANUAL CONTROL:**
- AIChatbot FAQ actively quotes wrong prices ($249/$649/$1,499) — must be corrected before any customer asks about pricing through the chatbot
- Invoice tax (15%) has no legal basis — founder must decide how to handle invoicing for first customer
- Founder must use ONE consistent price in all personal outreach (recommended: $699)
- No formal offer document, revision policy, or exclusions document — founder can define these in conversation

**What prevents a fully automated launch:**
- Payment not configured for online transactions
- Subscription/Life Plan not production-ready
- 3 conflicting pricing systems exist (though only 1 is customer-facing)

---

## 10. NEXT ACTION

### One step only:

**Update `AIChatbot.tsx` FAQ pricing answer to quote Foundation = $699 / Growth = $1,499 / Scale = $2,499** (matching `packages.json` seed), with correct package names, before any prospect asks about pricing through the chatbot.

If the chatbot is not yet live, this becomes the FIRST task before launch, because it is the only customer-facing source that actively misquotes prices.

---

*All findings verified against current BİŞİŞ V1 project files as of September 13, 2026.*  
*No files modified. Read-only verification.*
