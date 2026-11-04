# Phase 03C — Visual Audit (READ-ONLY) & Selective Redesign Plan

**Product:** BİŞİŞ frontend  
**Scope:** 6 new UI components (Button, Card, Badge, Alert, Input, Table) + shell/layout (Header, Footer, AppShell) + design tokens (`frontend/src/index.css`, `frontend/src/design-system/tokens.ts`)  
**Constraint:** READ-ONLY — no visual/component code changes in this phase. Findings are documented; remediation is planned for a follow-up phase.

---

## 1. Design system summary

- **Palette:** Gold (`#D4AF37`) primary brand accent; Electric Blue (`#2F7BFF`) secondary technology accent. Dark theme default (`navy-0 #02040A`) with `[data-theme="light"]` overrides.
- **Neon ladder:** Levels 0–4 for glow/border/text/drop-shadow, resolved through `--neon-*-N` CSS variables (single source of truth, folded from legacy classes).
- **Card system:** Shared foundation (`--card-surface`, `--card-shadow`, `--card-wash-*`, `--card-sheen`), one radius (`--radius-card = var(--radius-xl)`), pads `--card-pad`/`--card-pad-lg`.
- **Button system:** `btn-primary`, `btn-secondary`, `btn-ghost-gold`, `btn-blue` with hover/active/disabled states per level ladder.
- **Typography:** Outfit/Cairo (display), Inter/Cairo (body), Cairo (Arabic), Bebas Neue, Fraunces.
- **RTL:** Supported in Header, Footer, Table (`dir` prop).

---

## 2. Visual findings (READ-ONLY observations)

### F-01 · Button unconditionally applies all four variant base classes (P0 — visual defect risk)
`frontend/src/components/ui/Button.tsx:48` always concatenates `'btn-primary btn-secondary btn-ghost-gold btn-blue'` alongside `variantClasses[variant]`. Because CSS source order places `btn-ghost-gold` last among conflicting rules (`index.css:1934` after `btn-blue:1849`, `btn-secondary:1894`, `btn-primary:1781`), ghost-gold properties can override primary/secondary/blue on every button. This is a specificity/override hazard that can make buttons render the wrong variant.

### F-02 · Footer uses arbitrary inline colors outside the token system (P1)
`Footer.tsx` uses arbitrary values not defined in `design-system/tokens.ts` or `--*` CSS variables:
- Social brand chips: `bg-[#25D366]` (WhatsApp), `bg-[#229ED9]` (Telegram), `bg-[#E4405F]` (Instagram), `bg-[#FF0000]` (YouTube), plus `border-[#25D366]/40` etc.
- Gradient `/from-gold/15 via-white/[0.04] to-transparent` on the CTA card.

These bypass the gold/blue token ladder and cannot be themed via `[data-theme="light"]`.

### F-03 · Header uses arbitrary shadows outside the token system (P1)
`Header.tsx` uses `shadow-black/40`, `shadow-black/80`, `shadow-black/50` (scrolled header, user menu, mobile menu) which are not in `--shadow-*` tokens. These do not respond to theme switches.

### F-04 · Red semantic colors used without a token (P2)
Logout actions use `text-red-400` / `hover:bg-red-500/10` (`Header.tsx:290`, `Header.tsx:413`). Red is not part of the gold/blue palette; no `--status-danger` token exists.

### F-05 · Brand URLs contain non-ASCII Turkish characters (identity note — not a defect)
`Footer.tsx` social links use `BİŞİŞ.com`, `BİŞİŞHQ`, `BİŞİŞ-2030` in `href` values. These match the brand orthography but are non-ASCII in URLs; an identity decision, not a visual defect.

### F-06 · Positives (no action needed)
- Neon ladder + `focus-visible` focus rings on interactive surfaces.
- `aria-current="page"` on active nav links; `aria-expanded`/`aria-haspopup` on menus; `aria-label` on logo/icon buttons.
- Card `interactive` variant is keyboard-accessible (`role="button"`, `tabIndex={0}`, Enter/Space).
- RTL handled in Header, Footer, Table.

---

## 3. Selective redesign plan

Priority order. All items are planned only — no implementation in this READ-ONLY phase.

| Priority | Item | File | Proposed remediation |
|----------|------|------|----------------------|
| P0 | Button variant-class override bug | `frontend/src/components/ui/Button.tsx:48` | Remove the unconditional `'btn-primary btn-secondary btn-ghost-gold btn-blue'` string; apply only the resolved variant base class plus shared button reset. Verify each variant renders correctly in dark + light themes. |
| P1 | Footer social brand chips → tokens | `frontend/src/components/Footer.tsx` | Replace arbitrary `bg-[#XXXXXX]`/`border-[#XXXXXX]` with design-token classes or CSS variables; add social-brand tokens if a themed variant is desired. |
| P1 | Header arbitrary shadows → tokens | `frontend/src/components/Header.tsx` | Replace `shadow-black/40|80|50` with `--shadow-*` token classes or CSS variables. |
| P2 | Red semantic → token | `frontend/src/components/Header.tsx` | Add a `--status-danger` token (or reuse `--status-*` pattern) and apply it to logout actions instead of raw `red-*` utilities. |
| P3 | Brand URL ASCII normalization | `frontend/src/components/Footer.tsx` | Decide with brand owner whether to keep non-ASCII `BİŞİŞ.*` URLs or use ASCII equivalents; document the decision. |

**Verification after remediation (follow-up phase):** visual regression check in dark + light themes; confirm each Button variant renders its intended colors; confirm Header/Footer respond to `[data-theme="light"]`; confirm no new lint/typecheck errors.

---

## 4. Phase 03B status (completed)

All 6 new UI components have accessibility coverage:
- `Button.test.tsx` (10 tests), `Card.test.tsx` (9), `Input.test.tsx` (9), `Table.test.tsx` (8) — pre-existing, all pass.
- `Badge.test.tsx` (8) and `Alert.test.tsx` (7) — added in this session, all pass.
- `npm run typecheck` clean; ESLint clean on new test files.
