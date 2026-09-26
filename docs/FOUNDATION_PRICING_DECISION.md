# BİŞİŞ V1 — Foundation Package Pricing Decision Support

**Auditor**: Kilo #4 — First Customer Acquisition & Launch Growth Auditor  
**Date**: September 13, 2026  
**Scope**: Read-only pricing analysis for Foundation Package first customer  
**Previous reports**: `docs/FIRST_CUSTOMER_ACQUISITION_AUDIT.md`, `docs/FIRST_CUSTOMER_HANDOFF_FINAL.md`

---

## A. VERIFIED FOUNDATION PACKAGE

### Exact Package Identity

| Field | Value | Source |
|-------|-------|--------|
| Package ID | `foundation` (slug) | `database/seeds/packages.json:3` |
| Package Name | Foundation | `database/seeds/packages.json:5` |
| Package Description | Clarity & Direction | `database/seeds/packages.json:6` |
| Canonical Price (seed) | $699 | `database/seeds/packages.json:7` |
| Category | core | `database/seeds/packages.json:4` |
| Is Popular | false | `database/seeds/packages.json:11` |
| Is Active | true | `database/seeds/packages.json:12` |

### Included Services (Exact IDs and Prices)

Source: `database/seeds/packages.json:9` → service IDs mapped to `database/seeds/services.json`

| # | Service ID | Service Name | Individual Price | Delivery | Source |
|---|-----------|-------------|-----------------|----------|--------|
| 1 | svc-001 | The Mission Statement | $199 | 1–24h | `services.json:7` |
| 2 | svc-002 | The Quick Decision | $199 | 1–24h | `services.json:8` |
| 3 | svc-003 | The Compass Session | $249 | 1–24h | `services.json:9` |
| 4 | svc-004 | The 30-Minute Session | $149 | 1–24h | `services.json:10` |
| 5 | svc-005 | The Trinity Report | $249 | 1–24h | `services.json:11` |
| 6 | svc-007 | The Core Thesis Report | $349 | 1–24h | `services.json:13` |
| 7 | svc-008 | The Story | $299 | 1–24h | `services.json:14` |

**Total individual services**: 7 (confirmed from `packages.json:9` — 7 service IDs listed)  
**Package features list** (`packages.json:8`): "The Mission Statement", "The Quick Decision", "The Compass Session", "The Trinity Report", "The Core Thesis Report", "The Story", "1 × The 30-Minute Session" — 7 items, matching.

**Note**: The `features` array uses display names; the `services` array uses canonical IDs. They are consistent — svc-004 appears as "1 × The 30-Minute Session" in features and `svc-004` in the services list. No discrepancy.

---

## B. SERVICE ECONOMICS

### A. Total Individual-Service Value

$199 + $199 + $249 + $149 + $249 + $349 + $299 = **$1,693**

Step-by-step:
```
199 + 199 = 398
398 + 249 = 647
647 + 149 = 796
796 + 249 = 1045
1045 + 349 = 1394
1394 + 299 = 1693
```

### B. Arithmetic Average Service Price

$1,693 ÷ 7 = **$241.86**

### C. Median Service Price

Sorted prices: $149, $199, $199, $249, $249, $299, $349  
4th value of 7 = **$249**

### D. Lowest Service Price

$149 — svc-004: The 30-Minute Session

### E. Highest Service Price

$349 — svc-007: The Core Thesis Report

### F. Price Range

$149 – $349 (spread of $200)

### Summary Table

| Metric | Value |
|--------|-------|
| Total individual value | **$1,693** |
| Arithmetic average | **$241.86** |
| Median | **$249** |
| Lowest | **$149** |
| Highest | **$349** |
| Range | $149–$349 |
| Service count | 7 |

---

## C. PRICE SCENARIO COMPARISON

### Candidate: $249

| Metric | Value |
|--------|-------|
| Absolute discount vs $1,693 | $1,693 − $249 = **$1,444** |
| Percentage discount | $1,444 ÷ $1,693 = **85.3%** |
| Effective price per service | $249 ÷ 7 = **$35.57** |
| Position vs average ($241.86) | $249 = **1.03× average** (at average) |
| Position vs median ($249) | $249 = **exactly at median** |
| Effective price vs cheapest service ($149) | $35.57 is **23.8%** of individual cheapest |
| Effective price vs most expensive ($349) | $35.57 is **10.2%** of individual most expensive |

**Assessment**: $249 sits at the median of individual service prices, but only costs $35.57 per service. This means the customer would pay 85% less than buying individually. Every individual service costs more ($149 minimum) than the entire package's per-service equivalent ($35.57). This creates an absurd value gap.

### Candidate: $497

| Metric | Value |
|--------|-------|
| Absolute discount vs $1,693 | $1,693 − $497 = **$1,196** |
| Percentage discount | $1,196 ÷ $1,693 = **70.6%** |
| Effective price per service | $497 ÷ 7 = **$71.00** |
| Position vs average ($241.86) | $497 = **2.05× average** |
| Position vs median ($249) | $497 = **1.99× median** |
| Effective price vs cheapest service ($149) | $71.00 is **47.7%** of individual cheapest |
| Effective price vs most expensive ($349) | $71.00 is **20.3%** of individual most expensive |

**Assessment**: $497 is a 70.6% discount — deep but slightly less absurd than $249. Still, the customer gets every service for less than half of what the cheapest individual service costs.

### Candidate: $699 (canonical seed price)

| Metric | Value |
|--------|-------|
| Absolute discount vs $1,693 | $1,693 − $699 = **$994** |
| Percentage discount | $994 ÷ $1,693 = **58.7%** |
| Effective price per service | $699 ÷ 7 = **$99.86** |
| Position vs average ($241.86) | $699 = **2.89× average** |
| Position vs median ($249) | $699 = **2.81× median** |
| Effective price vs cheapest service ($149) | $99.86 is **67.0%** of individual cheapest |
| Effective price vs most expensive ($349) | $99.86 is **28.6%** of individual most expensive |
| Position vs Growth package ($1,499) | $699 = **46.6%** of Growth price |
| Position vs Scale package ($2,499) | $699 = **28.0%** of Scale price |

**Assessment**: $699 offers a 58.7% discount from individual service total. The per-service cost of $99.86 is less than 40% of the individual average ($241.86) but within a plausible "premium bundle" range.

### Additional Candidate: $599

| Metric | Value |
|--------|-------|
| Absolute discount vs $1,693 | $1,693 − $599 = **$1,094** |
| Percentage discount | $1,094 ÷ $1,693 = **64.6%** |
| Effective price per service | $599 ÷ 7 = **$85.57** |

### Additional Candidate: $799

| Metric | Value |
|--------|-------|
| Absolute discount vs $1,693 | $1,693 − $799 = **$894** |
| Percentage discount | $894 ÷ $1,693 = **52.8%** |
| Effective price per service | $799 ÷ 7 = **$114.14** |

### Comparison Matrix

| Price | Discount % | $/service | vs Avg | vs Median | Bundle Coherence |
|-------|-----------|-----------|--------|-----------|------------------|
| $249 | 85.3% | $35.57 | 1.03× | 1.00× | 🔴 Absurd — cheaper than cheapest service |
| $497 | 70.6% | $71.00 | 2.05× | 1.99× | 🟠 Very aggressive — half of cheapest service |
| $599 | 64.6% | $85.57 | 2.46× | 2.41× | 🟡 Aggressive but defensible |
| **$699** | **58.7%** | **$99.86** | **2.89×** | **2.81×** | **🟢 Substantial but reasonable bundle** |
| $799 | 52.8% | $114.14 | 3.29× | 3.22× | 🟢 Conservative bundle discount |

### What "Reasonable Bundle Discount" Would Suggest

Industry-standard bundle discounts for 7 items: 25–35%.
- 25% of $1,693 = **$1,270**
- 35% of $1,693 = **$1,100**

**FACT**: None of the three original candidates ($249/$497/$699) fall within the standard bundle discount range. They are all significantly below it.  
**FACT**: $699 corresponds to a ~58.7% discount — more than double the upper end of standard bundle range.  
**INFERENCE**: The individual service prices ($149–$349) serve as reference points, not as the basis for a mathematically derived bundle price. The package price has its own logic — likely calibrated for the Gaza/regional market and first-customer accessibility.

---

## D. COMMERCIAL ANALYSIS

### FACTS (verified from data)

1. Foundation contains 7 services with individual values ranging from $149 to $349, totaling $1,693.
2. $699 is the price stored in `packages.json` — the canonical database seed.
3. $249 is the price stored in `constants.ts` — a frontend constant.
4. $249 is also the price quoted by `AIChatbot.tsx` for "Starter" — a customer-facing FAQ answer.
5. `AIChatbot.tsx` and `constants.ts` use different package names (Starter/Growth/Investor-Ready) than `packages.json` (Foundation/Growth/Scale).
6. The customer-facing UI (Hero, About, StatsStrip) correctly displays "18 services, 3 packages."
7. Payment is not configured for online transactions — founder must accept payment manually.
8. All Foundation services have 1–24h delivery — fast turnaround.
9. The founder is the sole deliverable resource (founder-led delivery).

### INFERENCES (derived from facts + logic)

1. The individual service prices ($149–$349) are likely aspirational "à la carte" reference prices, not the actual basis for bundle pricing — because no standard bundle discount produces $699, $497, or $249 from $1,693.
2. The $699 seed price likely reflects the founder's intended market positioning: affordable enough for early customers but high enough to signal quality.
3. The $249 in `constants.ts` and `AIChatbot.tsx` is likely a stale/legacy frontend price that predates the `packages.json` pricing model. Evidence: it uses different package names (Starter vs Foundation), different mid-tier pricing ($649 vs $1,499 for Growth), and a different high-tier name (Investor vs Scale).
4. $249 as a bundle price for 7 strategy deliverables would be unsustainable — it implies $35.57 per deliverable, which is below the cost of any single deliverable individually.
5. The founder's hypothesis ("derive from individual service prices + bundle discount") cannot produce any of the three candidates using standard discount ranges. The pricing model in the system does NOT follow this hypothesis.
6. Gaza/regional founders likely have lower spending power than founders in established markets, making aggressive discounting more impactful but also more risky for positioning.

### COMMERCIAL JUDGMENTS (my strategic opinion, clearly labeled)

1. **$249 is TOO CHEAP for a first customer.** At $35.57 per deliverable, it signals "low quality" to a skeptical first customer evaluating a new brand. A founder paying $249 will question whether they're getting real strategic work or a template. It also damages the foundation for raising prices with customer #4+. **Verdict: Do NOT use $249 as the launch price.**

2. **$497 is commercially coherent IF framed correctly.** At 70.6% discount, it's aggressive but the "founding customer" narrative can justify it. However, it creates a problem: the gap between $497 and $699 is $202 — large enough that customer #4 will demand an explanation or discount. If the founder is willing to permanently price at $497, it works. If $497 is meant to be temporary, the transition back to $699 will feel like a price hike. **Verdict: Possible but risky. Requires founder commitment.**

3. **$699 is the most defensible price.** At 58.7% discount off individual service total, the value narrative is compelling ("7 services worth $1,693 for $699"). The $99.86 per-service cost is below individual minimum ($149) but not absurdly so — it signals "bundle deal" rather than "fire sale." It's the canonical seed price, meaning the founder already set it as the intended value. **Verdict: RECOMMENDED as primary price.**

4. **No discount is needed for the first customer if $699 is used.** The 58.7% discount off individual service value IS the value proposition. Adding an additional launch discount on top of an already-substantial bundle discount creates discount stacking that erodes pricing integrity.

5. **If a first-3 discount is desired, $549 ($699 minus 21.4%) is appropriate.** This is a modest early-customer incentive that doesn't undermine pricing structure. A 21% discount is within standard early-customer/beta-pricing ranges. But it's NOT necessary — the bundle value alone justifies the purchase.

6. **The package should NOT be priced below $497 under any scenario.** Below $497, the price-per-service falls below $71, which is less than half the cheapest individual service. No framing can make this credible for a quality-conscious first customer.

---

## E. $497 LAUNCH OFFER TEST

### Is $497 economically coherent?

**Partially.** $497 = 70.6% discount off individual total = $71 per service. It is economically coherent in the sense that the math works (the founder can deliver at this price and still generate revenue). However, it is 85% below the average individual service price ($241.86), which means the customer gets every service for less than a third of the average service price. This is far enough below individual pricing that it raises the question: "Why would any service cost $149+ individually if the bundle is $497?"

### Is it too large a discount?

**Yes, for a permanent price.** 70.6% is in the range of clearance/liquidation discounts, not strategic bundle pricing. For a first-customer launch offer, it's deep but potentially justifiable with proper framing.

### Does it undermine the $699 package?

**Yes, significantly.** If $497 is offered to first 3 customers and then reverts to $699:
- Customer #4 sees a $202 difference and asks "why?"
- Customer #4 may request the same price or wait for another promotion
- The $699 price loses credibility because $497 exists as a reference point
- The founder must permanently defend $699 against the shadow of $497

### Could $497 be positioned as a limited founding-customer offer?

**Yes, with strict conditions:**
1. Clearly limited to first 3 customers only
2. $699 is stated as the regular price next to $497
3. The offer is framed as "help us launch" not "we're cheap"
4. The founder commits to never offering $497 again (even to customer #4–10)
5. No written coupon or code that could be shared

**But**: Even with perfect framing, the founder must be prepared for customer #4 to ask "what happened to $497?" and have a good answer ready.

### What should the normal/reference price be?

**$699.** This is the canonical seed price and the most commercially defensible number. It's a 58.7% discount off individual service value — substantial enough to feel like a deal, restrained enough to maintain credibility.

### $497 Verdict:

**🟡 MODIFY — Recommend $699 as primary, $549 as optional first-3 price (not $497).**

$497 is unnecessarily aggressive. If the founder wants to incentivize first 3 customers, a 20% discount off $699 ($549) achieves the same goal without creating the pricing integrity issues that $497 would create.

If the founder specifically wants $497 for first 3: it's possible but must be treated as a ONE-TIME founding offer with no future extensions or references.

---

## F. RECOMMENDED PRICE

### ONE PRIMARY FOUNDATION PACKAGE PRICE

# **$699**

### Why $699 (6 points):

1. **It's the canonical seed price.** `database/seeds/packages.json:7` explicitly sets Foundation at $699. This is the founder's stated intended value. No calculation overrides a deliberate founder decision — and the calculation confirms it's commercially defensible.

2. **The value narrative works without discount stacking.** "7 strategy deliverables individually worth $1,693, now $699" = 58.7% discount. This is compelling on its own without needing an additional launch offer.

3. **$99.86 per service is below individual minimum but not absurd.** The cheapest individual service is $149. At $99.86 per service, the bundle signals "smart buying" not "fire sale."

4. **$249 fails the credibility test.** At $35.57 per service for 7 strategic deliverables, a new customer will question quality. First customers are the most skeptical — pricing too low confirms their fear that the service is unproven.

5. **$497 creates more problems than it solves.** A 70.6% discount is unsustainable to maintain and creates a permanent pricing shadow that makes $699 harder to defend later.

6. **The bundle discount is already substantial.** A 58.7% discount off individual service value doesn't need an additional launch discount layered on top. The value IS the discount.

### Pricing Structure:

| Tier | Price | Who | Notes |
|------|-------|-----|-------|
| Reference/list price | **$699** | All customers | The price that exists in canonical seed |
| First 3 customers (optional) | **$549** (21% off) | Founder's choice | Only if founder wants early incentive; NOT required |
| First 3 customers (aggressive) | **$497** (29% off) | Only if founder decides | Must be ONE-TIME; never repeat; always state $699 as regular |
| **No discount** | **$699** | Everyone | **RECOMMENDED — simplest, cleanest** |

### Recommended Positioning Sentence:

> "Foundation — 7 strategic deliverables to give your business clarity and direction. Everything you need to go from scattered to focused, delivered in 1–3 days."

The $1,693 individual value is implied by the quantity and specificity of deliverables, not stated explicitly (which would invite "why is it only $699?").

---

## G. SOURCE-OF-TRUTH CHANGES REQUIRED

After the founder confirms the price decision (recommended: $699), the following locations must eventually be synchronized:

| # | Location | Current State | Required Change | Priority | File/Location |
|---|----------|--------------|-----------------|----------|---------------|
| 1 | **`database/seeds/packages.json`** | Foundation = $699 | ✅ Already correct if $699 confirmed | No change | Line 7 |
| 2 | **`frontend/src/utils/constants.ts`** | Starter = $249 | ❌ CONFLICT — must align to canonical pricing | HIGH | Lines 10–50 |
| 3 | **`frontend/src/components/AIChatbot.tsx`** | FAQ quotes Starter/Growth/Investor-Ready at $249/$649/$1,499 | ❌ CONFLICT — different names AND different prices from seed | HIGH | Lines 86, 148, 210 |
| 4 | **`frontend/src/pages/PackagesPage.tsx`** | Reads from `/api/packages` (dynamic) | ⚠️ Will reflect whatever is in the database. Verify the live database matches `packages.json` seed | MEDIUM | Lines 73–96 |
| 5 | **Backend `packages.routes.js`** | Reads from Supabase `packages` table | ⚠️ Will reflect database content. No hardcoded price to fix | LOW | — |
| 6 | **i18n translations** | Unknown — translations live in Supabase per README | ⚠️ Need to verify if any translations contain stale prices ($249/$649/$1,499) | MEDIUM | `i18n.ts` + Supabase translation table |
| 7 | **`docs/FIRST_CUSTOMER_ACQUISITION_AUDIT.md`** | References $497 launch offer | ⚠️ Needs update to reflect final price decision | LOW | — |
| 8 | **`docs/FIRST_CUSTOMER_HANDOFF_FINAL.md`** | References $497 launch offer | ⚠️ Needs update to reflect final price decision | LOW | — |
| 9 | **`docs/BİŞİŞ_V1_Rescue_and_Launch_Plan.md`** | References Starter as recommended first package | ⚠️ Uses "Starter" naming — different from "Foundation" in seed | MEDIUM | Line 320 |
| 10 | **Contact page / WhatsApp pricing** | Unknown — depends on what founder says | ⚠️ Founder must use consistent price in all outreach | HIGH | — |
| 11 | **Invoice template** | May reference specific price | ⚠️ Must match decided price | MEDIUM | — |
| 12 | **`frontend/src/sections/Hero.tsx`** | No price mentioned (only stats: 18/3/6/V1) | ✅ No change needed | No change | — |
| 13 | **`frontend/src/sections/About.tsx`** | No price mentioned | ✅ No change needed | No change | — |
| 14 | **`frontend/src/sections/StatsStrip.tsx`** | Shows 18/3/6/V1 (no price) | ✅ No change needed | No change | — |

### Critical Conflict Summary:

The pricing conflict exists in **3 places**:
1. **Database seed** → Foundation at $699
2. **Frontend constants** → Starter at $249
3. **Chatbot FAQ** → Starter at $249 (customer-facing)

If the founder chooses $699: items 2 and 3 must be updated.
If the founder chooses $249: items 1 and 3 must be updated AND the value proposition collapses (85% discount = quality concern).
If the founder chooses any other price: ALL THREE must be updated to match.

---

## H. FINAL DECISION

### 🟢 PRICE DECISION READY

**Justification:**

The pricing data is complete, verified, and sufficient to make a confident recommendation. The calculation from actual service prices ($1,693 total) produces a clear value range, and the canonical seed price ($699) is within the commercially defensible zone. No additional data is needed.

**RECOMMENDATION: $699 as primary price, no launch discount required.** The bundle's existing 58.7% discount off individual service value is the value proposition. No artificial scarcity or launch discount needed for first customer.

**If founder prefers a first-3 discount: $549** (21% off $699) is the maximum recommended early-customer discount before it creates pricing integrity issues. **$497 is not recommended** due to the 70.6% discount and resulting pricing shadow.

**$249 is explicitly rejected** as a primary or launch price — it signals low quality for a new brand and is economically indefensible (85% discount, $35.57 per deliverable, cheaper than any individual service).

---

*Price analysis based on verified data from:*
- `database/seeds/packages.json` (package definition and seed price)
- `database/seeds/services.json` (individual service prices)
- `frontend/src/utils/constants.ts` (frontend pricing — flagged as conflict)
- `frontend/src/components/AIChatbot.tsx` (customer-facing FAQ pricing — flagged as conflict)
- `frontend/src/pages/PackagesPage.tsx` (dynamic pricing via API)

*No files modified. No prices changed. This is a decision support report.*
