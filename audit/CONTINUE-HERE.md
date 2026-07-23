# Continuation Prompt — rabea.art

Copy everything below the line into a fresh Claude Code session on any device.
Last updated: 2026-07-23 (session 3 — re-audit complete + first remediation batch: 8 findings shipped to `main`).

---

I'm continuing work on rabea.art — Next.js 16 + Prisma 7 + Supabase + Vercel, Arabic-first RTL
storefront with a role-gated admin. An independent 13-layer re-audit is complete.

**Read `audit/SESSION-3-REAUDIT.md` first, then `audit/EXECUTIVE-SUMMARY.md`. Do not redo the
audit.** All CRITICAL/HIGH findings passed an adversarial refutation pass (0 refuted). Work is on
`main`.

## 🚨 THE ONE THING THAT CHANGED EVERYTHING

**The `COMING_SOON` gate is OFF in production right now.** Session 2 said "do not remove the gate
until the blockers are done." It was removed anyway. Verified 2026-07-23:

```
GET https://www.rabea.art/       → 200, real storefront (not /coming-soon)
GET https://www.rabea.art/admin  → 307 → /admin/login  (real login)
robots.txt                       → Allow: /  (un-gated) + live sitemap
```

The catalog is empty, product pages soft-404, product images don't render, there's no error
tracking, and the DB restore has never been tested. **The owner confirmed (2026-07-23) this is an
intentional soft-launch** — so do NOT re-gate; the P0/P1 list below is a live-production priority
queue, worked in order. One soft-launch nuance: `robots.txt` currently says `Allow: /` with a live
sitemap, inviting Google to index the empty catalog — a direct-link soft-launch doesn't need to be
indexed, so consider robots disallow-all/noindex until real products exist.

## Session-3 scores (derivation in SESSION-3-REAUDIT.md)

Frontend 5 · API 7 · Database 6 · Auth 8 · Hosting 5 · Cloud 6 · CI/CD 7 · Security 6 ·
Rate Limiting 6 · Caching 7 · Scaling 6 · **Error Tracking 4** · **Availability 4** · Overall **58/100**.

## ✅ SHIPPED in session 3 remediation (all merged to `main`, deployed via Vercel)

Each went through `tsc` + full unit suite (378 passing) + `next build` before merge; each is its
own merge commit on `main`.

1. **API-07 / CLOUD-01** — order + admin status emails now use `after()` from `next/server` (no more
   silent drops on serverless freeze). `src/app/api/orders/route.ts`, `admin/orders/[id]/actions.ts`.
2. **LOG-04 / SEC-08** — customer PII no longer logged in cleartext; `log.ts` `REDACT_PATTERNS` now
   covers email/phone/whatsapp/address/street/postal/instructions/notes; `notify.ts` routes through
   `log.error`. Test: `tests/unit/log-redaction.test.ts`.
3. **AUTH-06** — owner-floor mutations (`changeAdminRoleAction`, `setAdminUserActiveAction`) run at
   `SERIALIZABLE` isolation, closing the two-different-owners write-skew.
4. **DB-03** — the 6 missing FK indexes: `@@index` lines added + migration
   `prisma/migrations/20260723000000_add_remaining_fk_indexes/`. **Owner already ran the SQL in
   Supabase — indexes are live.**
5. **RL-03 / API-04** — the 5 admin cost endpoints (3 CSV exports, file download, product-image sign)
   are rate-limited per-admin with `Retry-After`; `productId` constrained to `[A-Za-z0-9_-]`.
6. **DB-07** — Prisma pool capped `max: 3` + non-fatal warning if `DATABASE_URL` isn't pooled.
7. **LOG-02 (monitor half)** — `GET /api/health` readiness probe (200 / 503 on DB reachability),
   unauthenticated, ungated. **Owner action: point an uptime monitor (Better Uptime / UptimeRobot /
   Vercel Monitoring) at `https://www.rabea.art/api/health`.**

## P0 — still open

- **Gate: RESOLVED — intentional soft-launch (owner-confirmed), staying live.** Not a task; context.
- **Crawl policy** — `robots.txt` says `Allow: /` + live sitemap, inviting Google to index the empty
  catalog. Consider disallow-all/`noindex` until real products exist (a `robots.ts` change, or leave
  as-is if SEO-now is intended). (OPS-01)
- **Rotate `PREVIEW_KEY`** (SEC-04) — committed in git history; redacted from docs but the old value
  survives in history. Rotate in Vercel env only. **Owner/dashboard.**
- **FE-09 product-page soft-404** — `/product/<unknown-slug>` returns HTTP 200 "temporary error", not
  404. Pull Vercel function logs for one such request; prime suspect is the `unstable_cache` wrap of
  `getProductBySlug`. May also break *real* product pages once the catalog is seeded. **Code.**
- **AVL-06/07 recovery runbook** — `docs/SETUP-DATABASE.md` never applies `docs/rls-lockdown.sql` or
  the index migrations (rebuild = insecure + under-indexed), and `docs/verify-restore.sql` has no
  UTF-8 check (a WIN1255 restore mangles Arabic and passes every check). Fix the docs, THEN do the
  timed rebuild drill (AVL-02). **Docs + owner drill.**
- **Confirm the email fix worked** — after the deploy, place a test order and check
  `SELECT at,"to",template,status,error FROM email_logs ORDER BY at DESC LIMIT 10;`. A `sent`/`failed`
  row now appears reliably (the row-drop bug is fixed); a `failed` row with `EMAIL_DISABLED`/provider
  error = still need `RESEND_API_KEY`/`EMAIL_FROM` set + a verified Resend domain.

## P1 — next code work (all clear of the storefront-redesign files except FE-08)

- **LOG-01 error tracking (Sentry)** — the seam is ready (`log.ts` `emit()` is the single forward
  point). Needs a **`SENTRY_DSN` from the owner**. Use `@sentry/nextjs` (not `@sentry/node`) because
  it handles the serverless-flush problem; init gated on the DSN so it's a no-op until set; forward
  from `emit()` on `level==="error"`. Verify events actually arrive before calling it done.
- **AUTH-01 / AUTH-05** — app-level login failed-attempt lockout + Supabase TOTP MFA for OWNER/ADMIN
  (sign-in is client-side `signInWithPassword`, so add a thin server path to throttle).
- **API-06 / SEC-07 upload-verify bypass** — `POST /api/orders` accepts a never-verified `bucketPath`
  (`submit.ts` builds `OrderFile` rows straight from the client payload). Require server-side verify
  or inline `getObjectMetadata`, + magic-byte sniff.
- **DB-08 customer erasure** — `orders.customerId` is `ON DELETE RESTRICT`, no delete/anonymize
  action. Add `Customer.anonymizedAt` + an in-place PII-null action (don't touch the FK).
- **FE-08 product-image render path** (HIGHEST product value) — storefront renders CSS gradients
  unconditionally; `queries.ts` already fetches+types `product.images`/`primaryImage`. Branch
  `ProductCard`/`Gallery`/`ProductView` to `next/image`, gradient as fallback. **COORDINATE with the
  storefront-redesign workstream — these are the files that session actively edits.**
- **SEC-02 CSP** — ship `Content-Security-Policy-Report-Only` (nonce via `proxy.ts`) → enforce.
- **RL-04** — make the fixed-window limiter atomic (`INSERT ... ON CONFLICT`) + `Retry-After` on the
  public routes. Touches the order hot path — get a throwaway Postgres to test the concurrency
  before rewriting.

## CI hardening (one ephemeral-Postgres job unlocks three findings — CI-only, no prod risk)

- **CI-03** — 4 E2E specs (order-flow, shop-browse, duplicate-submit, mobile) `test.skip` without
  `E2E_HAS_DB`; CI never sets it, so the whole commerce path is untested. Add a Postgres service to
  the `e2e` job, apply the migration SQL + seed, set `E2E_HAS_DB=1`.
- **DB-13** migration-drift guard (`prisma migrate diff --exit-code` against the shadow DB in the
  same job) and **SEC-06** RLS-coverage check (assert every `public` table has `relrowsecurity`).
- **CI-01** branch protection on `main` — **owner/dashboard** (require `verify`+`e2e`, 1 review).

## Owner / dashboard only (no code)

- Seed real products (catalog is empty). · **NEXT_PUBLIC_SITE_URL → `https://www.rabea.art`** (FE-13;
  currently apex, which 308-redirects every sitemap/OG/JSON-LD URL). · Confirm Vercel **Preview**
  deploys use a SEPARATE database, not production (HOST-06). · Confirm prod points at the
  RLS-hardened Supabase project (AVL-08). · Pin `regions` in `vercel.json` to Supabase's region
  (HOST-02). · Enable PITR (AVL-03) + Storage bucket backup (AVL-04). · Point an uptime monitor at
  `/api/health`.

## Verification

`npm run lint && npm run typecheck && npm run test && npm run build`

Baseline to beat (`main` at the last remediation commit): lint **0 errors** (3 warnings — 1 real at
`ProductForm.tsx:85`, tripled by stale worktrees per CI-06), typecheck clean, **378 tests**, build
compiles. Every remediation commit is on `main`; branch each new fix off `main`, gate with
`tsc`+`test`+`build`, then merge (owner said "merge to main, don't ask"). `npx
playwright test` shows ~5 local failures from parallelism on Windows — pre-existing, pass with
`--workers=1`, CI pins `workers: 1`. Don't chase them. `npm audit` reports 5 moderate transitives
only fixable by downgrading `next`; accepted, CI gates at `--audit-level=high`.

## Ground rules

- **Multiple sessions edit this repo concurrently.** Run `git status` and check file mtimes before
  editing; don't modify files you didn't create if they're actively changing. Expect push races —
  pull and retry. (At session-3 time there was uncommitted WIP: `loader-preview/`, `loading.tsx`,
  `BrandLoader.*`, `motion/{env,math}.ts` — note `loader-preview/page.tsx` is an UNAUTH debug route
  marked "delete after review"; do not let it ship.)
- Don't mark anything PASS without a cited `file:line` or command output. If you can't verify it,
  say so plainly and score it as unresolved.
- Don't touch the production database, and don't ask the user to paste production credentials.
- **Never put a live-looking secret value in a repo file, even in a handoff/audit doc** (SEC-04 is
  the case study). Placeholders only.
- The user works entirely through the Supabase dashboard and **cannot open local files** — give SQL
  inline in chat, and point at GitHub's Raw view for repo files.
- Read `AGENTS.md`. This is Next.js 16 with breaking changes from training data: `src/proxy.ts` not
  `middleware.ts`; `revalidateTag` takes two arguments; `use cache` requires `cacheComponents: true`.
  Check `node_modules/next/dist/docs/` before writing routing, caching or middleware code.
