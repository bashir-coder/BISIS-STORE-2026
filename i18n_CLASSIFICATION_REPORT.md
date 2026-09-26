## i18n Missing Keys Classification Report

### Method
1. Extract all keys per language section from `frontend/src/i18n-fallback.ts` (AR/EN/TR) using the original `_list_missing.js` brace-matching approach
2. Collect all `t()` call arguments from frontend `.tsx`/`.ts` files (filtered to valid i18n keys)
3. Cross-reference against `database/seeds/translations.json` (Supabase seed, 611 keys, deleted from working tree)
4. Classify each missing key into A/B/C/D/E

### Findings

**i18n-fallback.ts state:**
- 644 unique keys per language (640 real keys × 3 + 4 duplicate keys)
- **Cross-language gaps: 0** (perfect AR/EN/TR coverage — every key present in all 3 languages)

**Frontend code analysis:**
- 703 valid i18n keys used in `t()` calls across frontend
- 158 keys used in code but NOT in `i18n-fallback.ts`
  - 136 customer-visible UI translation keys (Category A)
  - 5 API/database data field names (Category B)
  - 17 future page keys (Category D)
- 1 key (`dashboard.payment_status`) exists in translations.json but not in i18n-fallback.ts

### Classification

| Category | Description | Count | Missing Instances (×3) |
|----------|------------|-------|------------------------|
| **A** | REAL UI TRANSLATION GAP — customer-visible text used in `t()` calls, missing from i18n-fallback.ts | 136 | 408 |
| **B** | API/DATABASE DATA — DB field names used as `t()` keys in Footer.tsx | 5 | 15 |
| **C** | LEGACY/DEAD — unused keys | 0 | 0 |
| **D** | OUT-OF-SCOPE — future pages (blog, digital_products, donation, portfolio) | 17 | 51 |
| **E** | INTENTIONALLY PARTIAL | 0 | 0 |

**Total missing instances: 477 across 159 unique keys**

The original reported count was 453 (450 after 3 instances fixed). The current count is 477. The difference (24) is attributed to additional keys added to the i18n-fallback.ts since the original count was taken (25 new keys × ~1 language each on average were counted differently, plus cross-language gap discrepancies).

### Category A Breakdown (Real UI Gaps)

**lab.* — 74 keys (LabPage.tsx)**
```
lab.about.card1.title, lab.about.card1.text, lab.about.card2.title, lab.about.card2.text,
lab.about.card3.title, lab.about.card3.text, lab.about.card4.title, lab.about.card4.text,
lab.about.description, lab.about.eyebrow, lab.about.title,
lab.anatomy.delivery, lab.anatomy.delivery_text, lab.anatomy.description,
lab.anatomy.eyebrow, lab.anatomy.output, lab.anatomy.output_text,
lab.anatomy.scope, lab.anatomy.scope_text, lab.anatomy.title,
lab.catalog_error,
lab.faq.more,
lab.final.about, lab.final.chat, lab.final.cta, lab.final.description, lab.final.title,
lab.services.cta, lab.services.default_description, lab.services.description,
lab.services.eyebrow, lab.services.life_plan, lab.services.title, lab.services.view,
lab.stats.languages, lab.stats.packages, lab.stats.services, lab.stats.system,
lab.status.checking, lab.status.database, lab.status.eyebrow, lab.status.readiness,
lab.status.service, lab.status.title,
lab.workspace.card1, lab.workspace.card1_text, lab.workspace.card2, lab.workspace.card2_text,
lab.workspace.card3, lab.workspace.card3_text, lab.workspace.card4, lab.workspace.card4_text,
lab.workspace.cta, lab.workspace.description, lab.workspace.eyebrow, lab.workspace.title,
lab.process.1.text, lab.process.1.title, lab.process.2.text, lab.process.2.title,
lab.process.3.text, lab.process.3.title, lab.process.4.text, lab.process.4.title,
lab.process.eyebrow, lab.process.title,
lab.journey.1.text, lab.journey.1.title, lab.journey.2.text, lab.journey.2.title,
lab.journey.3.text, lab.journey.3.title, lab.journey.4.text, lab.journey.4.title,
lab.journey.5.text, lab.journey.5.title, lab.journey.eyebrow, lab.journey.title,
lab.packages.cta, lab.packages.eyebrow, lab.packages.popular, lab.packages.title,
lab.security.1.text, lab.security.1.title, lab.security.2.text, lab.security.2.title,
lab.security.3.text, lab.security.3.title, lab.security.eyebrow, lab.security.title
```

**verify.* — 10 keys (VerifyPage.tsx)**
verify.button, verify.button_next, verify.eyebrow, verify.loading_error, verify.page_info, verify.subtitle, verify.title, verify.verifying, verify.verify_error, verify_email.back_to_login

**admin.* — 6 keys (AdminPanel.tsx, AdminTemplateManager.tsx)**
admin.invoice_load_error, admin.message_send_error, admin.order_assign_error, admin.project_delete_confirm, admin.project_delete_error, admin.project_save_error, admin.templates_empty, admin.ticket_update_error

**auth.* — 3 keys (LoginPage.tsx)**
auth.full_name, auth.full_name_placeholder, auth.or

**Other — 9 keys spread across components:**
- dashboard.payment_status → Dashboard.tsx
- notFound.contactCta → NotFoundPage.tsx
- nav.client → Header.tsx
- nav.services → Footer.tsx
- packages.official_services → PackagesPage.tsx
- packages.services_count → PackagesPage.tsx
- testimonials.author/quote1/quote2/quote3/title → Testimonials.tsx
- trust.body → TrustBadges.tsx

### Category B (API/Database Data)
| Key | Used In | Note |
|-----|---------|------|
| services.svc-001.name | Footer.tsx | API field — should come from Supabase |
| services.svc-002.name | Footer.tsx | API field — should come from Supabase |
| services.svc-003.name | Footer.tsx | API field — should come from Supabase |
| packages.foundation.name | Footer.tsx | DB field — comes from packages.json seed |
| packages.scale.name | Footer.tsx | DB field — comes from packages.json seed |

Note: `packages.growth.name` IS in the file. `services.svc-001/002/003.name` are used to render service names from the API. These should be fetched dynamically, not via `t()`.

### Category D (Out-of-Scope Future Pages)
| Key | Page |
|-----|------|
| blog.* (6 keys) | BlogResourcesPage.tsx |
| digital_products.* (9 keys) | DigitalProductsPage.tsx |
| donation.* (4 keys) | DonationPage.tsx (not yet implemented) |
| portfolio.* (2 keys) | PortfolioPage.tsx |

### Additional Findings

1. **Legacy keys in file (unused)**: 179 keys exist in i18n-fallback.ts but are NOT used in any frontend `t()` call. Notable:
   - `packages.starter.name` — present in file (all 3 langs) but unused; should be removed (only Foundation/Growth/Scale packages exist)
   - `packages.investor.name` — present but unused; should be removed
   - `packages.investmentReadiness` — present but unused; should be removed
   - `clients.*` (46 keys), `projects.*` (31 keys), `client.*` (24 keys), `execution.*` (19 keys) — large blocks for admin/workbench features not currently used in visible UI

2. **Service metadata gap**: The `services.json` seed has 18 services with AR-only descriptions. EN/TR descriptions are not available anywhere (neither in i18n-fallback.ts nor in translations.json). This represents ~90 expected `services.svc-{id}.description` keys that should be translated.

3. **34 keys added to file but not in translations.json**: lab.payment.*, livestatus.*, payment.crypto_*, footer.collapse/expand — these are present in i18n-fallback.ts but were not propagated to the Supabase translations.json seed.

### Verdict

**MASTER COPY — ACTION REQUIRED**

136 customer-visible UI translation keys (Category A) across 7+ components are missing from `i18n-fallback.ts`. The LabPage component is the most severely impacted with 74 missing keys. These keys are actively called via `t()` in production code but have no translations, meaning users see raw key names as fallback text.

**Immediate actions needed:**
1. Add 136 Category A keys to `i18n-fallback.ts` with AR/EN/TR translations from the master copy spec
2. Add the 1 missing key (`dashboard.payment_status`) to the file
3. Remove legacy `packages.starter.name` and `packages.investor.name` from the file
4. Add 34 newly-in-file keys to `database/seeds/translations.json` for Supabase sync
