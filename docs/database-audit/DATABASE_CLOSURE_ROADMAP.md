# DATABASE CLOSURE ROADMAP (Updated with Evidence)

**Document:** DATABASE_CLOSURE_ROADMAP.md  
**Audit Date:** 2026-11-02  
**Status:** EVIDENCE VALIDATED (READ-ONLY) - Implementation NOT started

---

## PRIORITY ORDER (Evidence-Based)

### PHASE 0 - GATHER EVIDENCE (BLOCKING) - 1-2 days
**Must complete before any changes**

| ID | Task | Severity | Evidence Needed | Method |
|---|------|----------|-----------------|--------|
| EV-001 | Get read-only access to Production DB | CRITICAL | Migration history, schema, policies, functions, grants | Use approved read-only credentials |
| EV-002 | Get read-only access to Staging DB | CRITICAL | Same as above for comparison | Use approved read-only credentials |
| EV-003 | Run audit SQL packs against both DBs | CRITICAL | Complete evidence | Use PROD_READ_ONLY_SCHEMA_AUDIT.sql |
| EV-004 | Check migration tracking tables | CRITICAL | Actual applied migrations | Query _BISI_migrations, _bisis_migration_attempts |

### PHASE 1 - CRITICAL SECURITY (After evidence) 
| ID | Finding | Confidence | Evidence | Action | Risk |
|---|---------|------------|----------|--------|------|
| DB-SEC-001 | Execution helpers in public (Prod) vs private (Staging) | MEDIUM | Requirements confirm difference. Functions are properly secured. | Decide canonical location. If moving to private, update all policy references. | HIGH if done incorrectly |
| DB-SEC-002 | table_name RLS no policies | HIGH | Migration 010 shows fail-closed (service_role only) | Verify table is unused. If unused and not needed, consider dropping. | MEDIUM |
| DB-SEC-003 | faqs/portfolio/bisis_ai_os_task_dedup RLS no policies | MEDIUM | Requirements state this for Prod | Verify if these need public access. faqs/portfolio likely need public read policies if used on public site. | MEDIUM |

### PHASE 2 - MIGRATION RECONCILIATION
| ID | Finding | Confidence | Evidence | Action | Risk |
|---|---------|------------|----------|--------|------|
| DB-MIG-001 | History drift (Prod 24, Staging 9, Local 21) | CONFIRMED | Requirements | Reconcile - determine which migrations actually applied | HIGH |
| DB-MIG-002 | Personas exist in Prod only | CONFIRMED | Migration 018 removes them, intended for Staging | If Prod needs personas, don't apply 018. If not needed, remove carefully. Check code dependencies first. | HIGH |
| DB-MIG-003 | 020 in migrations_local/ | CONFIRMED | File location | Determine if needs to be applied. Add to canonical migrations/ if yes. | MEDIUM |
| DB-MIG-004 | Duplicate 005 prefix | CONFIRMED | Both files exist | Ensure correct deployment order or rename | LOW |

### PHASE 3 - RLS OPTIMIZATION (Performance)
| ID | Finding | Confidence | Evidence | Action | Risk |
|---|---------|------------|----------|--------|------|
| DB-PERF-RLS-001 | auth_rls_initplan (21 in Prod) | CONFIRMED | Supabase advisor | Wrap auth.uid()/auth.jwt() in (SELECT ...) in affected policies | LOW |
| DB-PERF-RLS-002 | Multiple permissive policies (75 Prod, 36 Staging) | CONFIRMED | Supabase advisor | Audit for true duplicates only. Don't consolidate if changes semantics. | MEDIUM |

### PHASE 4 - INDEXES & CLEANUP
| ID | Finding | Confidence | Evidence | Action | Risk |
|---|---------|------------|----------|--------|------|
| DB-PERF-001 | Unused indexes (30 Prod, 45 Staging) | CONFIRMED | Supabase advisor | Analyze pg_stat_user_indexes before dropping | MEDIUM |
| DB-CLEAN-001 | RLS recursion already fixed | CONFIRMED | Migration 015 | Verified - no action needed | NONE |

---

## EVIDENCE-BASED CLOSURE CRITERIA
- [ ] Read-only DB access obtained for both environments
- [ ] All SECURITY DEFINER functions inventoried with grants and search_path verified
- [ ] Complete RLS policy matrix for all tables in both environments
- [ ] Migration history reconciled against actual schema
- [ ] All tables with RLS enabled without policies investigated and justified
- [ ] Backend contract verified against actual schema
- [ ] Data integrity checks completed (where safe)
- [ ] All HIGH/CRITICAL findings have evidence and verified fixes
- [ ] Regression tests pass

---

## NOTES
- **No changes made in this phase** - evidence validation only
- **Public schema SECURITY DEFINER functions are not automatically vulnerabilities** - all have proper search_path and auth checks
- **Multiple permissive policies are not security issues** - OR semantics are correct by design
- **Focus on confirmed issues with evidence, not advisor warning counts**
