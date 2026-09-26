# BİÞIÞ V1 — COMPLETE PAGE & UX ARCHITECTURE REPORT

> **INSPECT → MAP → QUESTION → DELETE → MERGE → MOVE → SIMPLIFY → FREEZE PLAN**
> This report is the output of the inspection phase only. No code changes beyond what is listed in the Implementation Order section.

---

## 1. CURRENT PAGE INVENTORY

### Routed Pages (20 routes in `App.tsx`)

| Page | Route | Lines | Category | Status |
|------|-------|-------|----------|--------|
| VerifyPage | `/verify` (gate before all routes) | 262 | F | Human verification gate |
| VerifyEmailPage | `/verify-email` | 79 | F | Supabase email verification |
| HomePage | `/` | 8 | A | Thin wrapper → LabPage |
| LabPage | `/` (actual content) | 1339 | A/C | 12-section homepage |
| PackagesPage | `/packages` | 587 | B/C | Package browsing + scope calculator |
| LifePlanPage | `/life-plan` | 44 | C/D | Subscription purchase page |
| LifePlanPage | `/services/life-plan` | 44 | C/D | **Duplicate route** |
| AboutPage | `/about` | 16 | A | Thin wrapper → AboutSection |
| FAQPage | `/faq` | 83 | A | 3 hardcoded FAQs |
| ContactPage | `/contact` | 43 | A | Contact info only (no form) |
| ChatPage | `/chat` | 61 | A | AI chatbot full-page |
| LoginPage | `/login`, `/register` | 150 | F | Login + signup (mode-based) |
| ClientPortal | `/portal` | 220 | E | Client order tracking |
| Client360Page | `/clients` | 209 | G | Admin client management |
| WorkbenchPage | `/workbench` | 94 | G | Operations executor |
| ProjectWorkspacePage | `/projects/:id` | 205 | E | Project workspace (client+ops) |
| AdminPanel | `/admin` | 1004 | G | Admin dashboard (overloaded) |
| PaymentPage | `/payment` | 845 | D | Payment flow |
| PaymentSuccess | `/payment/success` | 190 | D | Payment confirmation |
| PaymentCancelled | `/payment/cancelled` | 158 | D | Payment cancelled |
| NotFoundPage | `*` | 51 | A | 404 |

**Total: 25 page files, 20 routed.**

### Orphan Pages (5 — exist but NOT routed)

| Page | Lines | Purpose | Action |
|------|-------|---------|--------|
| Dashboard.tsx | 1211 | Full client dashboard with orders, notifications, tickets, chat | DELETE (replaced by /portal) |
| BlogResourcesPage.tsx | 31 | Placeholder blog/resources page | DELETE (coming soon, not wired) |
| DigitalProductsPage.tsx | 44 | Static digital products listing | DELETE (placeholder) |
| DonationPage.tsx | 32 | Donation page | DELETE (placeholder) |
| PortfolioPage.tsx | 29 | Project portfolio grid | DELETE (placeholder) |

### Orphan Sections (5 — exist in `src/sections/` but NOT imported anywhere)

| Section | Lines | Action |
|---------|-------|--------|
| Hero.tsx | 280 | DELETE (replaced by LabPage inline hero) |
| StatsStrip.tsx | 73 | DELETE (replaced by LabPage inline stats) |
| Steps.tsx | 92 | DELETE (replaced by LabPage inline journey) |
| Testimonials.tsx | 88 | DELETE (replaced by LabPage inline sections) |
| TrustBadges.tsx | 92 | DELETE (replaced by LabPage inline trust) |

Only `About.tsx` (118 lines) is still used — by `AboutPage.tsx`.

### Shared Components (not pages)

| Component | Lines | Used By |
|-----------|-------|---------|
| Header.tsx | 518 | All pages (layout) |
| Footer.tsx | 138 | All pages (layout) |
| AIChatbot.tsx | 495 | ChatPage only |
| AnimatedCounter.tsx | 57 | AboutSection |
| ScrollProgress.tsx | 22 | App.tsx (layout) |
| LiveStatusRibbon.tsx | 114 | App.tsx (layout) |
| FloatingButtons.tsx | 117 | App.tsx (layout) |
| CursorAura.tsx | 47 | App.tsx (layout) |
| OrderLifecycle.tsx | 49 | ClientPortal, Client360, ProjectWorkspace, AdminPanel, Dashboard |
| ClientDeliveryHome.tsx | 86 | ClientPortal, Dashboard |

---

## 2. PAGE PURPOSE

| Page | Primary Job | Secondary | Overloaded? |
|------|-------------|-----------|-------------|
| `/verify` | Prove human (anti-bot) | None | No |
| `/` (LabPage) | Explain BİÞIŞ and drive to packages/life-plan | Education, trust, payment explanation, FAQ, system status | **YES — 12 sections** |
| `/packages` | Show and compare 3 packages | Scope calculator, service catalog | **YES — 587 lines, dual service+package view** |
| `/about` | Explain what BİÞIÞ is | Brand story, value props | No (trivial wrapper) |
| `/faq` | Answer common questions | Link to full FAQ | No (only 3 hardcoded) |
| `/contact` | Show contact info | — | No (but incomplete — no form) |
| `/chat` | AI interaction | — | No |
| `/login` `/register` | Authenticate user | Signup via same component | No |
| `/portal` | Client order tracking | Project/workspace access | No |
| `/workbench` | Operations queue | Task execution | No |
| `/projects/:id` | Execute and deliver project | Requirements, chat, delivery | **Borderline — 205 lines, many features** |
| `/admin` | Admin oversight | Operations, templates, analytics | **YES — 1004 lines, 5+ responsibilities** |
| `/payment` | Collect payment via crypto | Order management, payment status | **YES — 845 lines** |
| `/payment/success` | Confirm payment | Order status, dashboard link | No |
| `/payment/cancelled` | Explain cancellation | Retry payment option | No |
| `/life-plan` | Sell subscription | Explain features | No |

---

## 3. HOMEPAGE AUDIT (LabPage — 1339 lines, 12 sections)

The homepage attempts to serve ALL user needs simultaneously: Discovery, Decision, Conversion, Education, Trust, Status.

### 5-Second Test
A new visitor sees: a badge ("BİÞIŞ LAB"), a large headline in Arabic, two CTAs, and 4 stat cards. Then a wall of scrolling content. The hero communicates "this is a lab" but the stat cards (18 services, 3 packages, 3 languages, system status) compete for attention.

### Section-by-Section Audit

| # | Section | Purpose | KEEP / REMOVE / MERGE / MOVE | Action |
|---|---------|---------|------------------------------|--------|
| 1 | HERO | Explain what BİÞIÞ is + drive action | KEEP (condensed) | Remove stat cards from hero. Keep headline, subtext, primary CTA. Secondary CTA ("How it works") is fine. |
| 2 | STAT CARDS (in hero) | Show service/package counts + system status | **MOVE** to dedicated sections | The "18 services" and "3 packages" stats belong on /packages. System status belongs at bottom. |
| 3 | WHAT IS BİÞIÞ | Brand explanation with 4 value cards | **MERGE** into Hero | The 4 cards (Clarity, Path, Trust, Execution) can become 2-3 concise bullets under the hero headline. |
| 4 | SERVICES | Show service examples + Life Plan | **MOVE** to /packages | Services are browsable on /packages. The Life Plan showcase is important → keep as a distinct element below packages. |
| 5 | PACKAGES | Show 3 packages | KEEP | Core conversion driver. But simplify card descriptions. |
| 6 | SERVICE ANATOMY | Explain scope/output/delivery concept | **MERGE** into Packages | Can be 3 inline bullets within package CTA or a single explanatory line. |
| 7 | PAYMENTS | Explain crypto payment process | **MOVE** to /packages or /payment | Not a discovery concern. Belongs near checkout. |
| 8 | ORDER JOURNEY | Show 5-step flow | **MOVE** to /about or /packages | Important for trust but not homepage-critical. |
| 9 | CLIENT WORKSPACE | Show portal preview | KEEP (condensed) | Important differentiator. Reduce 4 cards to 2 key points. |
| 10 | SECURITY | Build trust | **MOVE** to /about | Security is an "about us" topic. |
| 11 | FAQ (3 items, API-fetched) | Quick answers | **MOVE** to /faq | Full FAQ page exists. Keep 1-2 critical FAQs only. |
| 12 | SYSTEM STATUS | Show live status | KEEP (at bottom) | Trust indicator. But simplify — 3 data points is enough. |
| 13 | ABOUT + START (final CTA) | Drive final action | KEEP | Good final conversion point. Keep 3 CTAs minimal. |

**Homepage proposed new structure (8 sections, ~600 lines):**
1. HERO (headline + subtext + primary CTA + secondary CTA)
2. WHAT IS BİÞIÞ (2-3 sentences, condensed from section 3)
3. PACKAGES (3 cards, primary conversion)
4. LIFE PLAN (subscription highlight, if distinct from packages)
5. CLIENT WORKSPACE (portal preview, condensed to 2 cards)
6. SYSTEM STATUS (simplified)
7. FAQ (1-2 critical questions)
8. FINAL START CTA (headline + primary CTA)

---

## 4. FULL PAGE AUDIT

### PackagesPage (587 lines) — OVERLOADED
**Sections:**
1. Page header + subtitle
2. Scope calculator (interactive, inline)
3. Package cards (3 packages with features)
4. Service details (service cards with prices)
5. Package comparison table (optional)

**Issues:**
- Tries to show packages AND individual services in the same view
- Scope calculator adds complexity
- 587 lines for a single decision page

**Action: Split into two concerns.**
- Keep the core package selection as primary
- Move service catalog to a secondary tab or link, not inline

### PaymentPage (845 lines) — OVERLOADED
**Sections:**
1. Package/service selection
2. Order creation
3. Payment form (NOWPayments)
4. Payment status tracking
5. Multiple payment methods

**Issues:**
- 845 lines for a transaction page
- Mixes order creation with payment execution
- Complex state management

**Action: Split into at least 2 pages/steps.**
- Step 1: Order review (what you're buying)
- Step 2: Payment execution (crypto payment)

### AdminPanel (1004 lines) — OVERLOADED
**Sections:**
1. Action center (new orders, processing, alerts)
2. Operations center (delivery queue, templates)
3. Order management (list, filter, status)
4. Project management (templates, execution)
5. Analytics (charts, stats)
6. Client 360 view (embedded)
7. Notifications
8. Ticket management

**Issues:**
- 5+ distinct responsibilities in one page
- Admin should be role-based modules, not a monolith

**Action: Split into Admin sub-pages.**
- `/admin/orders` — Order management
- `/admin/workbench` — Link to existing /workbench
- `/admin/analytics` — Analytics
- `/admin/clients` — Link to existing /clients

### ProjectWorkspacePage (205 lines)
**Issues:**
- Serves both client and operations (dual mode detected via API)
- Mixes milestones, tasks, requirements, delivery, chat, tickets
- 205 lines is borderline but acceptable if well-organized

**Action: Monitor — no change needed unless user testing reveals confusion.**

### ContactPage (43 lines)
**Issues:**
- Only shows contact info (email, phone, address)
- No contact form — users can't submit inquiries
- No FAQ link or chat link

**Action: Add a simple contact form or link to /chat.**

### LabPage — Hero Stat Cards
**Issues:**
- "18 services" and "3 packages" are hardcoded fallbacks when API isn't loaded
- System status ("READY" or "—") is shown before verification
- Stats compete with headline for attention

**Action: Remove stat cards from hero. Show them contextually where they matter.**

---

## 5. NAVIGATION PLAN

### Current Header Navigation (Desktop)
- Home, Packages, Chat, Contact
- Login/Get Started (unauthenticated)
- User menu with Admin link (authenticated)

### Missing from Navigation
- **About** — exists at `/about` but not in nav
- **FAQ** — exists at `/faq` but only linked in footer
- **Services** — `/services` redirects to `/packages`, no direct link

### Proposed Navigation

#### Desktop Navigation (Primary)
1. **Home** (`/`)
2. **Packages** (`/packages`) — rename to "Services" since that's what users want
3. **Chat** (`/chat`)
4. **About** (`/about`) — add this link
5. **FAQ** (`/faq`) — add this link

*Note: "Contact" can be in the footer only. The FloatingButtons already provides WhatsApp/Telegram.*

#### Footer Navigation (Secondary)
- Brand (logo)
- Packages (with sub-links to each package)
- About / FAQ / Contact
- Social links
- Copyright

#### Authenticated Navigation
- When logged in: User profile menu (Dashboard → `/portal`, Admin link if admin, Logout)
- When not logged in: Sign In / Get Started

### DELETE LIST for Navigation
- Remove `/services` redirect — either make it a real page or remove the route entirely
- Remove `/services/life-plan` duplicate — consolidate to `/life-plan` only

---

## 6. CTA PLAN

### Current CTAs (Inventory)

| CTA Text | Destination | Context | Priority |
|----------|-------------|---------|----------|
| "استكشف الخدمات والباقات" | `/packages` | Hero primary | HIGH |
| "كيف تعمل BİÞIŞ؟" | `#how-it-works` (anchor) | Hero secondary | MEDIUM |
| "عرض جميع الخدمات" | `/packages` | Services section | MEDIUM |
| "افتح مساحة العميل" | `/portal` | Client workspace | HIGH |
| "انتقل إلى الدفع" | `/payment` | Payments section | HIGH |
| "Explore packages" | `/packages` | LabPage card | MEDIUM |
| "ابدأ الآن" | `/packages` | Final CTA | HIGH |
| "تعرف على BİÞIŞ" | `/about` | Final CTA | MEDIUM |
| "تحدث معنا" | `/chat` | Final CTA | MEDIUM |
| "عرض الخدمة" | `/packages` | Service card | LOW |

### Issues:
1. **Multiple CTAs on homepage** — Hero, Services, Packages, Payments, Workspace, Security, FAQ, Final CTA all have CTAs. Too many competing calls-to-action.
2. **Inconsistent CTA wording** — Mix of Arabic and English, varying styles.
3. **Anchor links** — `#how-it-works` anchor may not work on the new reduced homepage.
4. **No clear funnel** — CTA destinations jump between discovery, payment, and portal.

### CTA Plan (Simplified)
- **Primary CTA**: "Get Started" → `/packages` (everywhere)
- **Secondary CTA**: "How it works" → `/about` (not anchor)
- **Tertiary CTA**: "Talk to us" → `/chat` (support context only)
- **Post-auth CTA**: "Open Portal" → `/portal` (for existing customers)

---

## 7. USER JOURNEYS

### Journey A: Visitor (anonymous, new)
```
Homepage (/verify gate)
  → /packages (discover services & pricing)
  → /packages (select package)
  → /login (sign in or register)
  → /payment (complete payment)
  → /payment/success (confirmation)
  → (email notification)
  → /portal (client workspace)
  → /projects/:id (project execution)
```

**Critical bug**: After login, `LoginPage` calls `navigate('/dashboard')` which doesn't exist → user lands on NotFoundPage.

**Critical bug**: After payment, `PaymentSuccess` calls `navigate('/dashboard')` — same issue.

**Critical bug**: After payment cancellation, `PaymentCancelled` calls `navigate('/dashboard')` — same issue.

### Journey B: Customer (authenticated, with active order)
```
/portal (view orders)
  → /projects/:id (track execution)
  → /chat (get support)
  → /portal (back to overview)
```

### Journey C: Payment flow
```
/packages → select package → /payment → NOWPayments →
  /payment/success (poll for status) OR
  /payment/cancelled (retry)
```

**Issue**: Payment flow mixes order creation and payment execution in one 845-line page.

### Journey D: Internal (admin)
```
/login → /admin (full dashboard)
  → /workbench (execution queue)
  → /projects/:id (project detail)
  → /clients (client 360)
```

**Issue**: Admin panel is 1004 lines trying to do everything. WorkbenchPage is separate but overlapping in function.

### Journey E: Life Plan subscriber
```
Homepage (Life Plan showcase)
  → /life-plan (subscription details)
  → /payment (payment)
  → /payment/success
```

---

## 8. MOBILE PLAN

### Homepage (LabPage)
- Stat cards collapse to single column (currently grid-cols-2 sm:grid-cols-4)
- Service cards stack vertically
- Package cards stack
- Final CTA buttons stack (currently `sm:flex-row`)
- **Issue**: 4 stat cards are too much for mobile — reduce to 2 most important

### PackagesPage
- Scope calculator likely breaks on mobile (complex form)
- Package cards should stack vertically
- **Issue**: 587 lines of content on mobile = very long scroll

### PaymentPage
- Payment form needs mobile-optimized layout
- Crypto address/copied needs touch-friendly copy button
- **Issue**: 845 lines = extreme cognitive load on mobile

### AdminPanel
- 1004 lines on mobile is unacceptable
- Needs tab-based or accordion navigation on mobile
- **Issue**: Complex tables and charts don't translate to mobile

### ClientPortal
- Orders list should be priority #1 on mobile
- Project links should be touch-friendly
- **Issue**: Current 220 lines need mobile-first restructuring

### Mobile First Recommendations:
1. **Condense LabPage** — Remove non-critical sections for mobile
2. **Split PaymentPage** — Mobile users can't handle 845 lines of forms
3. **Prioritize ClientPortal** — Order status first, details expandable
4. **Simplify AdminPanel** — Use tabs or navigation drawer on mobile

---

## 9. VISUAL HIERARCHY

### Homepage (LabPage) — current levels:

**Level 1 (must see first):**
- Hero headline
- Primary CTA ("استكشف الخدمات والباقات")

**Level 2 (supports decision):**
- Hero subtext
- Package cards
- Secondary CTA

**Level 3 (supporting context):**
- Service examples
- Order journey steps
- Client workspace preview
- Final CTA buttons

**Level 4 (decorative/optional):**
- Stat cards (services count, packages count)
- "What is BİÞIŞ" detailed explanation
- Service anatomy (3 cards)
- Payment explanation (NOWPayments details)
- Security details
- FAQ (3 items)
- System status
- Eyebrow labels ("الخدمات", "الباقات", etc.)
- Badges ("BİÞIŞ LAB", "الأكثر اختيارًا", "Signature Subscription")
- Glow effects, radial gradients, decorative circles
- Icon backgrounds for each section

### Issues:
- Too many "Level 2" items competing for attention
- "Level 4" items (badges, glows, gradients) add visual noise
- Stat cards mix critical info (system status) with decorative info (service count)

### Recommended hierarchy:
**Level 1**: Hero headline + primary CTA only
**Level 2**: Package cards + life plan highlight
**Level 3**: Order journey (max 3 steps, not 5) + workspace CTA
**Level 4**: FAQ (1-2 items), system status, final CTA
**Remove**: Stat cards from hero, service anatomy section, security section (move to /about)

---

## 10. DELETE LIST

### Pages (5)
1. **Dashboard.tsx** (1211 lines) — Replaces with `/portal`. All `navigate('/dashboard')` calls should go to `/portal`.
2. **BlogResourcesPage.tsx** (31 lines) — Placeholder, not routed, no content.
3. **DigitalProductsPage.tsx** (44 lines) — Placeholder, not routed, no content.
4. **DonationPage.tsx** (32 lines) — Placeholder, not routed, no content.
5. **PortfolioPage.tsx** (29 lines) — Placeholder, not routed, no content.

### Sections (5)
1. **Hero.tsx** (280 lines) — Dead, replaced by LabPage inline hero.
2. **StatsStrip.tsx** (73 lines) — Dead, replaced by LabPage inline stats.
3. **Steps.tsx** (92 lines) — Dead, replaced by LabPage inline journey.
4. **Testimonials.tsx** (88 lines) — Dead, not referenced anywhere.
5. **TrustBadges.tsx** (92 lines) — Dead, not referenced anywhere.

### Routes in App.tsx (2)
1. `/services/life-plan` — Duplicates `/life-plan`. Remove.
2. `/services` — Redirects to `/packages`. Remove redirect; either make `/services` a real page or remove entirely.

### Homepage sections (LabPage) to remove from homepage:
1. **Stat cards in hero** (lines 298-338) — Move system status only to bottom; remove service/package count cards.
2. **Service Anatomy** (lines 740-801) — Redundant with package cards. Remove.
3. **Payments section** (lines 806-899) — Not a discovery concern. Remove from homepage.
4. **Security section** (lines 1075-1129) — Move to /about. Remove from homepage.

---

## 11. MERGE LIST

1. **LabPage HERO + WHAT IS BİÞIŞ** — Merge the "What Is" explanation and 4 value cards into the hero section as concise bullets.
2. **LabPage SERVICES + LIFE PLAN** — Merge life plan showcase into the services section header or below packages.
3. **LabPage SERVICE ANATOMY + ORDER JOURNEY** — Merge into a single "How it works" section with 3-4 combined steps.
4. **FAQPage + LabPage FAQ section** — Consolidate to one FAQ source (API-driven). FAQPage should render the same FAQs as LabPage.
5. **LoginPage + Register** — Already merged (mode-based). Good. No change needed.
6. **PaymentSuccess + PaymentCancelled CTA destinations** — Both navigate to `/dashboard` → merge these to navigate to `/portal` (the actual client portal route).

---

## 12. MOVE LIST

1. **Stat cards from hero** → System status stays at bottom of homepage; service/package counts move to `/packages`.
2. **Security section** → Move from homepage to `/about` page.
3. **Payment explanation** → Move from homepage to `/packages` (near checkout) or `/payment`.
4. **Order journey (5 steps)** → Move from homepage to `/about` or keep 2-3 condensed steps in homepage.
5. **FAQs (3 items)** → Keep on homepage but reduce to 1-2 most critical. Full FAQ on `/faq`.
6. **Admin sub-functions** → Split AdminPanel into sub-pages: `/admin/orders`, `/admin/analytics`, `/admin/templates`. WorkbenchPage stays as `/workbench`.

---

## 13. FINAL CANONICAL PAGE MAP

| Purpose | Page | Route | Primary CTA |
|---------|------|-------|-------------|
| A — Discovery | VerifyPage | `/verify` | "Continue" (reCAPTCHA) |
| A — Discovery | HomePage (LabPage) | `/` | "Explore services" → `/packages` |
| A — Discovery | AboutPage | `/about` | "Learn more" (internal anchor) |
| A — Discovery | FAQPage | `/faq` | (none — informational) |
| A — Discovery | ContactPage | `/contact` | "Chat now" → `/chat` |
| A — Discovery | ChatPage | `/chat` | (AI interaction) |
| F — Auth | LoginPage | `/login` | "Sign in" / "Sign up" |
| F — Auth | VerifyEmailPage | `/verify-email` | "Sign in" → `/login` |
| B — Decision | PackagesPage | `/packages` | "Select" → `/payment` (or `/login` first) |
| B — Decision | LifePlanPage | `/life-plan` | "Continue to payment" → `/payment` |
| D — Transaction | PaymentPage | `/payment` | "Pay with crypto" |
| D — Transaction | PaymentSuccess | `/payment/success` | "Open portal" → `/portal` |
| D — Transaction | PaymentCancelled | `/payment/cancelled` | "Try again" → `/payment` / "Portal" → `/portal` |
| E — Customer Ops | ClientPortal | `/portal` | "View order" → `/projects/:id` |
| E — Customer Ops | ProjectWorkspacePage | `/projects/:id` | "Submit requirements" / "Chat" |
| G — Internal | AdminPanel | `/admin` | (admin functions) |
| G — Internal | WorkbenchPage | `/workbench` | "Open project" → `/projects/:id` |
| G — Internal | Client360Page | `/clients` | "View projects" → `/projects/:id` |
| C — Error | NotFoundPage | `*` | "Back to home" / "Explore packages" |

**Total: 15 routed pages (down from 21 routes including duplicates)**

### Page structure after cleanup:

```text
HOME (/) — LabPage
  [HERO]
  Headline
  Subtext
  Primary CTA → /packages
  Secondary CTA → #how-it-works

  [HOW IT WORKS] (merged from Service Anatomy + Order Journey)
  3-step flow: Choose → Order → Workspace

  [PACKAGES]
  3 package cards → CTA on each → /payment

  [LIFE PLAN] (subscription highlight)
  CTA → /life-plan

  [WORKSPACE PREVIEW] (condensed to 2 cards)
  CTA → /portal

  [FAQ] (1-2 critical items)
  Link → /faq

  [SYSTEM STATUS] (simplified)
  3 data points

  [FINAL START]
  Primary CTA → /packages
  Secondary → /chat

ABOUT (/about)
  Brand story
  4 value props (merged from What Is + Security)
  Stats (18 services, 3 packages)

PACKAGES (/packages)
  Package cards
  Scope calculator
  Service catalog (secondary)

PAYMENT (/payment)
  Order review
  Crypto payment form
```

---

## 14. IMPLEMENTATION ORDER

**Phase 1 — Critical bugs (highest impact)**
1. Fix all `navigate('/dashboard')` → `navigate('/portal')` in LoginPage, PaymentSuccess, PaymentCancelled, PaymentPage
2. Remove duplicate `/services/life-plan` route
3. Remove `/services` redirect (either real page or delete)

**Phase 2 — Homepage reduction (highest impact)**
4. Remove stat cards from hero (keep only system status at bottom)
5. Merge WHAT IS BİÞIÞ into hero (condense to bullets)
6. Remove Service Anatomy section (redundant with packages)
7. Move Payments section from homepage to `/packages`
8. Move Security section from homepage to `/about`
9. Condense Order Journey to 3 steps

**Phase 3 — Page cleanup (medium impact)**
10. Simplify ContactPage — add contact form or chat link
11. Consolidate FAQ — make FAQPage the single source
12. Simplify LifePlanPage — ensure consistent with PackagesPage

**Phase 4 — Admin simplification (medium impact)**
13. Split AdminPanel into sub-pages OR simplify its scope
14. Ensure WorkbenchPage and AdminPanel don't duplicate functions

**Phase 5 — Dead code removal (low impact, cleanup)**
15. Delete 5 orphan page files
16. Delete 5 orphan section files

**Phase 6 — Navigation fix (medium impact)**
17. Add About and FAQ to header navigation
18. Simplify navigation to max 5 items

---

## 15. DO NOT TOUCH

- **Payment logic** — `PaymentPage.tsx`, `PaymentSuccess.tsx`, `PaymentCancelled.tsx` business logic
- **RLS / database policies** — All migration files
- **Authentication** — `AuthContext.tsx`, `LoginPage.tsx` auth flow, Supabase integration
- **Backend contracts** — All API routes and service files
- **Database** — All migration and seed files (except personas.json i18n fix already applied)
- **NOWPayments integration** — `nowpayments.service.js` and payment callback handling
- **Human verification gate** — `VerifyPage.tsx` and its reCAPTCHA flow
- **Supabase configuration** — `supabase.config.js`, client setup
- **Security hardening** — Any security-related code in migrations or middleware
- **Email verification flow** — `VerifyEmailPage.tsx`

---

## APPENDIX: ADDITIONAL FINDINGS

### i18n Consistency
- Homepage (LabPage) uses inline hardcoded copy with `t('key', 'default')` pattern — Arabic defaults
- PackagesPage uses a `serviceCopy` object with proper ar/en/tr translations
- FAQPage uses i18n keys
- LifePlanPage uses inline copy object with ar/en/tr
- **Recommendation**: Standardize on one approach (i18n keys with fallback translations in seeds)

### Component Size Summary
- Largest files: Dashboard.tsx (1211), LabPage.tsx (1339), AdminPanel.tsx (1004), PaymentPage.tsx (845)
- These 4 files account for ~4,400 lines — the core bloat of the application

### Route Complexity
- `/services` is a dead redirect (→ `/packages`)
- `/services/life-plan` is a duplicate of `/life-plan`
- `/register` reuses LoginPage with mode toggle
- `/dashboard` is referenced 4x but has no route
- Only 15 of 25 page files are actually routed (60% are dead code)
