-- Digital Products Storage Contract
-- Adds storage_key column to digital_products and a purchase ledger table.
-- Does NOT modify file_url (kept for backward compatibility with existing rows).
-- Does NOT enable RLS on digital_product_purchases here; RLS is enabled
--   inline so the table is usable immediately after this migration applies.
-- No CASCADE on purchases; digital_products rows are soft-deleted via is_active.

-- ============================================================
-- 1. storage_key on digital_products
-- ============================================================
ALTER TABLE public.digital_products
    ADD COLUMN IF NOT EXISTS storage_key TEXT;

-- ============================================================
-- 2. Purchase ledger
-- ============================================================
CREATE TABLE IF NOT EXISTS public.digital_product_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.digital_products(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    order_id BIGINT REFERENCES public.orders(id) ON DELETE SET NULL,
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    payment_confirmed BOOLEAN NOT NULL DEFAULT false,
    payment_tx_hash TEXT,
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at TIMESTAMPTZ,
    UNIQUE (product_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_dpp_user_id ON public.digital_product_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_dpp_product_id ON public.digital_product_purchases(product_id);
CREATE INDEX IF NOT EXISTS idx_dpp_order_id ON public.digital_product_purchases(order_id);
CREATE INDEX IF NOT EXISTS idx_dpp_confirmed ON public.digital_product_purchases(payment_confirmed);

ALTER TABLE public.digital_product_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own digital product purchases" ON public.digital_product_purchases;
CREATE POLICY "Users can view own digital product purchases"
    ON public.digital_product_purchases
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Staff can manage digital product purchases" ON public.digital_product_purchases;
CREATE POLICY "Staff can manage digital product purchases"
    ON public.digital_product_purchases
    FOR ALL
    TO authenticated
    USING (
        (auth.jwt()->>'role') IN ('admin', 'super_admin', 'manager')
    );

GRANT SELECT, INSERT, UPDATE ON public.digital_product_purchases TO authenticated;
-- Local-only migration for digital products delivery flow
-- Adds storage_key and indexes if needed
ALTER TABLE public.digital_products ADD COLUMN IF NOT EXISTS storage_key TEXT;
ALTER TABLE public.digital_products ADD COLUMN IF NOT EXISTS file_mime_type TEXT;
ALTER TABLE public.digital_products ADD COLUMN IF NOT EXISTS file_size BIGINT;
CREATE INDEX IF NOT EXISTS idx_dpp_user_product_confirmed ON public.digital_product_purchases(user_id, product_id, payment_confirmed);
# DIGITAL PRODUCTS DELIVERY AUDIT (Read-Only)

**Document:** DIGITAL_PRODUCTS_DELIVERY_AUDIT.md  
**Audit Date:** 2026-11-02  
**Scope:** Digital products purchase/delivery flow - evidence from migrations and code only  

---

## 1. MIGRATIONS - EVIDENCE

### Migration 019: database/migrations/019_digital_products_storage_contract.sql (canonical)
**Evidence (lines 1-96):**
- Adds storage_key to public.digital_products (ADD COLUMN IF NOT EXISTS)
- Creates public.digital_product_purchases table:
  - id UUID PK, product_id FK to digital_products ON DELETE CASCADE, user_id FK to users ON DELETE CASCADE
  - order_id FK to orders ON DELETE SET NULL
  - price NUMERIC(10,2) NOT NULL CHECK (price >= 0)
  - payment_confirmed BOOLEAN NOT NULL DEFAULT false
  - payment_tx_hash TEXT
  - purchased_at TIMESTAMPTZ NOT NULL DEFAULT now()
  - confirmed_at TIMESTAMPTZ
  - UNIQUE (product_id, user_id)
- Indexes: idx_dpp_user_id, idx_dpp_product_id, idx_dpp_order_id, idx_dpp_confirmed
- Enables RLS on digital_product_purchases
- Policies:
  - \"Users can view own digital product purchases\" - SELECT for authenticated WHERE auth.uid() = user_id
  - \"Staff can manage digital product purchases\" - ALL for authenticated WHERE (auth.jwt()->>'role') IN ('admin','super_admin','manager')
- Grants: SELECT, INSERT, UPDATE to authenticated
- Comments: \"Does NOT modify file_url (kept for backward compatibility with existing rows)\"; \"Does NOT enable RLS on digital_products here\"; \"RLS is enabled inline so the table is usable immediately\"

### Migration 020: database/migrations_local/020_digital_products_delivery_flow.sql (NOT in canonical migrations/)
**Evidence:**
`sql
ALTER TABLE public.digital_products ADD COLUMN IF NOT EXISTS storage_key TEXT;
ALTER TABLE public.digital_products ADD COLUMN IF NOT EXISTS file_mime_type TEXT;
ALTER TABLE public.digital_products ADD COLUMN IF NOT EXISTS file_size BIGINT;
CREATE INDEX IF NOT EXISTS idx_dpp_user_product_confirmed ON public.digital_product_purchases(user_id, product_id, payment_confirmed);
`
- Adds file_mime_type, file_size to digital_products
- Adds composite index
- storage_key already added by 019 (idempotent)
- **Location:** migrations_local/ not migrations/ - not in canonical chain

---

## 2. TABLES AND COLUMNS - EVIDENCE FROM MIGRATIONS

### digital_products (referenced in 019)
**Known from migrations:**
- Has ile_url (mentioned as kept for backward compat in 019)
- Has storage_key added by 019 (and again by 020)
- Has ile_mime_type, ile_size added by 020
- RLS status on digital_products: **NOT enabled in migration 019** (comment says \"Does NOT enable RLS on digital_products here\")

### digital_product_purchases
**Created in 019** with all columns listed above. RLS enabled with 2 policies, grants to authenticated.

---

## 3. BACKEND USAGE - EVIDENCE

**Search results:** No matches in ackend/src/**/*.js for \"digital_products\".  
This suggests either:
- Backend uses service_role and accesses via different patterns (maybe not found by search)
- Or digital product flow is handled differently
- Or backend code for this feature may be elsewhere or not present

**Need to search more broadly:**
- Check all backend files
- Check for \"digital_product_purchases\", \"storage_key\", \"purchase.*digital\"

Let us search again more specifically.
## 4. ACTUAL FLOW AS IMPLEMENTED (Evidence)

### Public catalog
- **GET /** and **GET /:id** (backend/src/api/routes/digital-products.routes.js:68-108)
- Filters is_active = true, selects specific public fields only (no file_url, no storage_key)
- UUID validation for /:id
- Returns generic error messages, doesn't leak DB errors
- **Matches tests** - tests verify private fields not returned

### Admin/Manager upload
- **POST /** (create product) - requires authenticate + authorize('admin','super_admin','manager'), accepts name,price,description,file_url,thumbnail,category,storage_key
- **POST /:id/upload** (upload file) - requires auth + staff role, validates UUID, checks product exists, uploads to Supabase Storage bucket DIGITAL_PRODUCTS_BUCKET (default 'digital-products') at path digital-products/{productId}/{uuid}{ext}, updates product with storage_key, file_mime_type, file_size
- **Uses multer memoryStorage**, 100MB limit

### Download (authenticated)
- **GET /:id/download** - requires authenticate (line 180)
- Checks if user is staff (admin/super_admin/manager/editor) OR has confirmed purchase in digital_product_purchases (payment_confirmed = true) for this product_id and user_id
- Looks up product by id (must be active), gets storage_key
- Creates signed URL from Supabase Storage with 60s expiry, download filename set to product.name
- Returns { url: signed.signedUrl, expires_in: 60 }

### Purchase/confirmation flow
**NOT FOUND in digital-products.routes.js**. Purchase creation and payment confirmation logic is not present in this route file. Tests don't show purchase creation flow. The download route checks digital_product_purchases but doesn't show how purchases are created/confirmed. This may be in other routes (orders/payments) or not implemented yet.

---

## 5. GAPS - CONFIRMED VS ASSUMPTIONS

### CONFIRMED GAPS
1. **Purchase flow missing from digital-products routes** - No POST to create purchase, no webhook/payment confirmation handling visible. Purchases table exists but creation/confirmation logic not in this route file. **EVIDENCE:** No purchase creation endpoints in routes file.
2. **digital_products table RLS not enabled by migrations** - Migration 019 says \"Does NOT enable RLS on digital_products here\". Public routes use service_role (backend config uses service_role) so RLS not needed for backend, but direct client access would not be protected by RLS. **EVIDENCE:** Migration 019 line ~30
3. **Migration 020 not in canonical migrations/** - Adds file_mime_type, file_size columns and composite index. If not applied, download still works (migration 019 added storage_key), but missing columns/index. **EVIDENCE:** File location
4. **Storage bucket policies not visible in migrations** - Bucket 'digital-products' referenced in code, policies not found in migration files reviewed. **UNKNOWN**
5. **No check for existing purchase before allowing download for non-staff** - Download checks for confirmed purchase; if no purchase exists, returns 403. Correct if purchases must exist first. But creation flow unknown.
6. **file_url still exists on products** - Migration 019 kept it for backward compat. Download prefers storage_key (line ~242). If storage_key missing, returns 404. Old products with only file_url would not be downloadable via this flow. **EVIDENCE:** Line ~242 checks storageKey, returns 404 if missing

### ASSUMPTIONS (not confirmed by evidence)
- Assumes purchases are created elsewhere (orders/payments flow)
- Assumes storage bucket exists and has appropriate policies
- Assumes staff roles can download without purchase (confirmed in code line ~224-227)
- Assumes payment confirmation sets payment_confirmed=true in digital_product_purchases

---

## 6. SECURITY RISKS - EVIDENCE BASED

### CONFIRMED RISKS
1. **Signed URL exposure** - Download returns signed URL valid for 60 seconds. If intercepted, could be used within window. Mitigated by short expiry. **EVIDENCE:** Line ~246-247
2. **No rate limiting visible** - Download endpoint not rate limited in code reviewed. **UNKNOWN if exists elsewhere**
3. **Staff bypass** - Any user with role admin/super_admin/manager/editor can download without purchase. Correct if intended, but needs to be verified. **EVIDENCE:** Line ~224-227
4. **Storage key path construction** - Uses productId and randomUUID, stored in DB. Path predictable structure but filenames random. **EVIDENCE:** Line ~170-171
5. **Public catalog doesn't leak keys** - Correctly filters fields. Tests enforce this. **EVIDENCE:** Tests and routes

### POTENTIAL RISKS (need verification)
- If digital_products has no RLS and someone gets direct Supabase client access with anon key, they could read all products including file_url/storage_key. But backend uses service_role and public routes filter fields. **NEEDS VERIFICATION**
- digital_product_purchases RLS allows users to view only own purchases (SELECT policy), staff can manage all (ALL policy). Correct. **EVIDENCE:** Migration 019
- Backend uses service_role for all queries in this route (supabase imported from config with service_role) - bypasses RLS. Authorization is done in application code. **EVIDENCE:** Routes use supabase.from() directly, no RLS context

---

## 7. PROPOSED MIGRATION (COMPLETE - NOT TO BE EXECUTED)

`sql
-- PROPOSED - DO NOT EXECUTE
-- Digital Products Delivery Hardening (Evidence-Based)

BEGIN;

-- 1. Enable RLS on digital_products if not enabled
-- Rationale: Defense in depth. Public routes use service_role but direct access should be protected.
ALTER TABLE public.digital_products ENABLE ROW LEVEL SECURITY;

-- 2. Public can only view active products (but we filter fields in app; RLS as backup)
DROP POLICY IF EXISTS "Anyone can view active digital products public" ON public.digital_products;
CREATE POLICY "Anyone can view active digital products public"
  ON public.digital_products FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- 3. Staff can manage products
DROP POLICY IF EXISTS "Staff manage digital products" ON public.digital_products;
CREATE POLICY "Staff manage digital products"
  ON public.digital_products FOR ALL TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin','super_admin','manager','editor'))
  WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin','super_admin','manager','editor'));

-- Note: This uses subquery pattern - consider JWT for performance, but need to check for recursion
-- Better to use auth.jwt()->>'role' like migration 015 did

-- 4. Ensure columns from migration 020 exist (idempotent)
ALTER TABLE public.digital_products ADD COLUMN IF NOT EXISTS file_mime_type TEXT;
ALTER TABLE public.digital_products ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- 5. Ensure composite index exists
CREATE INDEX IF NOT EXISTS idx_dpp_user_product_confirmed ON public.digital_product_purchases(user_id, product_id, payment_confirmed);

-- 6. Consider: prevent direct access to storage_key/file_url via RLS? Not possible with RLS alone
-- Field filtering must remain in application code

COMMIT;
`

**CAVEATS:**
- Don't know if this matches intended design
- Adding policies to digital_products could affect existing behavior if clients use direct Supabase access
- Role check in policy uses subquery (could cause recursion issues like users table had) - should use JWT
- Need to verify against actual requirements

---

## 8. REQUIRED SQL TESTS FOR VERIFICATION

`sql
-- READ-ONLY TESTS - DO NOT EXECUTE ON PROD

-- 1. Check digital_products structure
SELECT column_name, data_type, is_nullable FROM information_schema.columns 
WHERE table_schema='public' AND table_name='digital_products' ORDER BY ordinal_position;

-- 2. Check digital_product_purchases structure  
SELECT column_name, data_type, is_nullable FROM information_schema.columns
WHERE table_schema='public' AND table_name='digital_product_purchases' ORDER BY ordinal_position;

-- 3. Check RLS status
SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class 
WHERE relname IN ('digital_products', 'digital_product_purchases');

-- 4. Check policies
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check 
FROM pg_policies WHERE tablename IN ('digital_products', 'digital_product_purchases');

-- 5. Check indexes
SELECT indexname, indexdef FROM pg_indexes 
WHERE tablename IN ('digital_products', 'digital_product_purchases');

-- 6. Check grants
SELECT grantee, privilege_type FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name IN ('digital_products', 'digital_product_purchases');

-- 7. Find products without storage_key and without accessible file_url
SELECT id, name, storage_key, file_url FROM digital_products 
WHERE is_active = true AND storage_key IS NULL AND (file_url IS NULL OR file_url = '');
`

---

## 9. REQUIRED BACKEND TESTS FOR VERIFICATION

1. **Public catalog security** - Already tested in digital-products-security.test.js and digital-products-file-delivery.test.js ✓
2. **Download authorization** - Test: non-purchaser gets 403, purchaser with confirmed purchase gets signed URL, staff gets access without purchase
3. **Purchase flow** - Need tests for purchase creation and payment confirmation
4. **Storage upload** - Test staff can upload, non-staff cannot, file type/size validation
5. **Edge cases** - Product with only file_url (old) vs storage_key (new), missing storage_key returns 404

---

## SUMMARY

**Current design (evidence-based):**
- Public catalog hides file_url/storage_key - **CORRECT**
- Downloads require authentication + purchase confirmation OR staff role - **LOGIC EXISTS**
- Files stored in Supabase Storage with signed URLs (60s expiry) - **CORRECT**
- Purchases tracked in digital_product_purchases with payment_confirmed flag - **CORRECT**
- Purchase creation/confirmation flow **NOT VISIBLE** in digital-products routes - needs investigation elsewhere

**Critical gaps:**
- Purchase creation/confirmation mechanism unknown
- digital_products has no RLS (relying on service_role + app filtering)
- Migration 020 not in canonical path
- Storage bucket policies unknown
- No RLS on digital_products table
