# Remediation Roadmap — rabea.art

Each item lists: Priority · Finding ID · Action · Expected impact · Dependencies · Complexity
(Small / Medium / Large) · Verification method.

**Status key:** ✅ done in this audit · 🔧 needs code work · 🖐️ needs manual/console action

---

## Phase 0 — Immediate critical fixes (before removing `COMING_SOON`)

### 0.1 🖐️ Close the PostgREST path to the database
- **Priority:** P0 — highest in the entire audit
- **Finding:** SEC-01 · ✅ **COMPLETE AND VERIFIED 2026-07-21**
- `docs/rls-lockdown.sql` applied to the production project. Verified by
  `SELECT relrowsecurity FROM pg_class …` → **22 rows, all `true`**. `SELECT current_user` returns
  `postgres`, so the application bypasses RLS and is unaffected.
- **Why verified this way:** an empty `[]` from the REST API is ambiguous while the tables hold no
  rows, and `customers` and `products` are both currently empty — the first probe returned `[]`
  for that reason, not because the lock was working. Reading `pg_class` cannot be fooled by it.
  (A first attempt also hit the wrong Supabase project entirely; the `PGRST205` hint naming an
  unrelated `meters` table is what exposed that.)
- **Still open, non-blocking:** remove `public` from Supabase → Settings → API → Exposed schemas.
  PostgREST is unused here, so disabling it removes the surface altogether — and protects any
  table added later before someone remembers to enable RLS on it.

### 0.2 🖐️ Establish and prove backups
- **Priority:** P0
- **Findings:** AVL-01, AVL-02
- **Action:** Confirm the plan tier supports backups; enable PITR; **perform one real restore into
  a scratch project** and time it.
- **Impact:** Converts "we assume we can recover" into a measured RTO. Today a single bad
  migration is unrecoverable.
- **Dependencies:** May require a Supabase plan upgrade.
- **Complexity:** Medium (~2h including the restore)
- **Verification:** Restored project passes the row-count and `order_ref_seq` checks in
  `AVAILABILITY-RECOVERY.md`, and a test order submits end-to-end against it.

### 0.3 ✅ Close the public API during the coming-soon gate
- **Priority:** P0 — **DONE**
- **Finding:** API-01
- **Action:** `src/proxy.ts` — public API paths added to the matcher; refused with 503 +
  `Retry-After` while gated. Admin API routes deliberately excluded so the back office still works.
- **Impact:** Closes a confirmed live exposure — anonymous writes into production `orders` and
  `customers` while the site presented as closed.
- **Complexity:** Small
- **Verification:** 15 tests in `tests/unit/coming-soon-gate.test.ts`, including the exact
  regression. Re-probe after deploy: `curl -X POST https://www.rabea.art/api/orders` → 503.

### 0.4 🖐️ Audit production data for pre-fix junk
- **Priority:** P0
- **Finding:** API-01 (consequence)
- **Action:** Review `orders` and `customers` for rows created via the previously open endpoint.
  ```sql
  SELECT id, ref, "createdAt", "estTotal" FROM orders ORDER BY "createdAt" DESC LIMIT 100;
  SELECT count(*) FROM customers;
  ```
- **Impact:** Establishes whether the exposure was exploited.
- **Dependencies:** 0.1 first (do not add access paths before closing them)
- **Complexity:** Small
- **Verification:** Manual review against known legitimate orders.

### 0.5 🖐️ Confirm storage bucket visibility
- **Priority:** P0
- **Finding:** STO-01
- **Action:** Supabase → Storage — confirm `order-uploads` is **private**, `product-images` public.
- **Impact:** A public `order-uploads` exposes customer-submitted reference photos.
- **Complexity:** Small (2 min)
- **Verification:** Fetch an `order-uploads` object URL without a signature — must fail.

---

## Phase 1 — Security and data protection

### 1.1 ✅ Trustworthy client IP for rate limiting
- **Finding:** RL-01 · **Complexity:** Small · **DONE**
- Extracted the triplicated `clientIp` into `src/lib/client-ip.ts`, preferring Vercel's
  unspoofable header and the last XFF hop; refuses to trust XFF off-Vercel.
- **Verification:** 14 tests in `tests/unit/client-ip.test.ts` covering the spoofing cases.

### 1.2 🔧 Rate-limit the login endpoint
- **Priority:** P1 · **Finding:** AUTH-01 · **Complexity:** Small
- **Action:** Call `checkRateLimit({ key: \`login:${ip}\`, limit: 5, windowSeconds: 900 })` on the
  sign-in path. The schema already documents this exact key format (`schema.prisma:439`); it was
  planned and never wired.
- **Impact:** Closes unbounded credential stuffing against the admin.
- **Dependencies:** 1.1 (a limiter keyed on a spoofable IP is worthless)
- **Verification:** Unit test; manually confirm the 6th attempt is refused.

### 1.3 🖐️ Enable MFA for OWNER and ADMIN
- **Priority:** P1 · **Finding:** AUTH-05 · **Complexity:** Small
- These accounts can export the full customer database; a password alone is thin.
- **Verification:** Sign in and confirm the TOTP challenge.

### 1.4 🔧 Raise financial mutations to ADMIN
- **Priority:** P1 · **Finding:** PM-04 · **Complexity:** Small · **DONE**
- Both raised to `requireRole(ADMIN)` (`orders/[id]/actions.ts:160,196`). The order-detail page
  now passes `canEditFinancials` through `OrderDetailView` to `ManagePanel`, which disables both
  controls for STAFF and renders a short explanation — otherwise a STAFF admin sees two
  greyed-out fields with no reason why, which reads as a broken page rather than a deliberate
  permission boundary.
- Operational actions (status, ETA, archive, internal notes, WhatsApp log) deliberately remain
  STAFF — that is the day-to-day job.
- **Verified:** typecheck + lint clean, 348 tests pass, production build succeeds. Server-side
  enforcement is unconditional in `requireRole` and independent of the UI gating.

### 1.5 ✅ Constrain `bucketPath` to its canonical shape
- **Finding:** API-02 · **Complexity:** Small · **DONE**
- **Verification:** 7 new cases in `tests/unit/order-schemas.test.ts` (traversal, wrong bucket,
  non-UUID segments, extra depth, missing extension, smuggled query string).

### 1.6 ✅ Validate `setAdminLocaleAction`; ✅ constant-time `PREVIEW_KEY`
- **Findings:** AUTH-02, AUTH-03 · **Complexity:** Small · **DONE**
- **Verification:** Covered by the preview-key prefix test in `coming-soon-gate.test.ts`.

### 1.7 🔧 Protect `order_ref_seq` from `prisma db push`
- **Priority:** P1 · **Finding:** DB-06 · **Complexity:** Medium
- **Action:** Move the sequence and the `stock >= 0` CHECK into a tracked migration; baseline
  `_prisma_migrations` in the production database.
- **Impact:** Today an ordinary `prisma db push` silently produces a database where order
  submission fails, and Prisma cannot warn because it models neither object.
- **Verification:** Apply to a scratch database, run `prisma db push`, confirm order submission
  still works.

### 1.8 🔧 Implement a customer erasure path
- **Priority:** P1 · **Findings:** DB-08, PM-06 · **Complexity:** Medium
- **Action:** Either a soft-delete with PII nulling, or an OWNER-only hard delete that reassigns
  orders to an anonymised customer (`orders.customerId` is `ON DELETE RESTRICT`, so a naive delete
  fails).
- **Verification:** Integration test; confirm order history survives with PII removed.

---

## Phase 2 — Stability and observability

### 2.1 ✅ Structured logging · 🖐️ wire an error tracker
- **Finding:** LOG-01 · **Complexity:** Small (code done) + Small (manual)
- **Done:** `src/lib/log.ts` emits one JSON object per line with stable event names, request-id
  correlation and key redaction. The two silent failures are now alertable events:
  `ratelimit.fail_open` and `order.email.failed`.
- **Remaining (manual):** install `@sentry/nextjs`, add a DSN, and forward from `emit()`. Needs an
  external account, so it was not faked here.
- **Verification:** Trigger a failure; confirm it appears in the tracker with its request id.

### 2.2 🖐️ Uptime monitoring and alerts
- **Priority:** P1 · **Finding:** LOG-03/04 · **Complexity:** Small
- **Action:** Monitor `GET /` and `POST /api/orders`. Alert on `ratelimit.fail_open`,
  `order.email.failed`, and any cron failure.
- **Impact:** Detection currently depends on a customer complaining.
- **Verification:** Trigger a synthetic failure; confirm the alert fires.

### 2.3 ✅ CI hardening
- **Finding:** CI-02 · **DONE**
- `permissions: contents: read`; a separate `audit` job gating at `--audit-level=high` plus an
  unconditional full advisory report; `.github/dependabot.yml` with grouped updates.

### 2.4 🖐️ Branch protection
- **Priority:** P1 · **Finding:** CI-01 · **Complexity:** Small
- **Action:** Require `verify`, `audit` and `e2e` to pass on `main`; require PR review; enable
  secret scanning and push protection.
- **Impact:** CI is currently advisory — nothing stops an unreviewed push, and Vercel deploys on
  push regardless of CI status.
- **Verification:** Open a PR with a deliberate type error; confirm merge is blocked.

### 2.5 🔧 Make E2E cover the order flow in CI
- **Priority:** P2 · **Finding:** CI-03 · **Complexity:** Medium
- 15 of 34 E2E tests self-skip without `E2E_HAS_DB` — including the entire order flow. The green
  badge covers 19 tests against a database-less build.
- **Action:** Add an ephemeral Postgres service container, run `migration.sql` + `seed.sql`, set
  `E2E_HAS_DB=1`.
- **Verification:** CI reports 34 passed, 0 skipped.

### 2.6 🔧 Add `COMING_SOON`/`PREVIEW_KEY` to the env schema; write `lastLoginAt`
- **Priority:** P2 · **Findings:** HOST-04, AUTH-04 · **Complexity:** Small

### 2.7 🔧 Content sniffing on upload verify
- **Priority:** P2 · **Finding:** API-03 · **Complexity:** Small
- Check magic bytes rather than trusting the uploader's Content-Type header.

---

## Phase 3 — Performance

### 3.1 🔧 Foreign-key indexes
- **Priority:** P1 · **Finding:** DB-03 · **Complexity:** Small · **CODE DONE — needs manual apply**
- `prisma/migrations/20260721000000_add_missing_indexes/migration.sql` adds **21 indexes**, with
  `schema.prisma` updated to match. Every one is tied to a query that exists in the codebase
  today; none is speculative.
- **No drift:** the index set generated from `schema.prisma` is identical to the union of both
  migrations — 39 names, exact match, verified with `prisma migrate diff --from-empty`.
- Written with `IF NOT EXISTS` and wrapped in a transaction, so it is idempotent and safe to
  paste into the Supabase SQL Editor — which is how schema changes actually reach this database
  (`docs/SETUP-DATABASE.md`). Index names follow Prisma's convention so a future `migrate diff`
  sees schema and database as consistent.
- **Impact:** removes sequential scans from every admin join. The highest-value single entry is
  `order_files(bucketPath)`: the nightly cron did one unindexed lookup per stored object, so its
  cost grew with the number of files *kept*, not the number of orphans deleted.
- ⚠️ **ACTION REQUIRED:** paste that file into Supabase and run it, then run the verification
  query at the bottom of the file (expect 21 rows). Locking note is in the file header — plain
  `CREATE INDEX` is fine at current table sizes; switch to `CONCURRENTLY` if these ever grow large.

### 3.2 🔧 Cache the catalog
- **Priority:** P2 · **Findings:** CACHE-01, CACHE-02 · **Complexity:** ~~Medium~~ **Large — blocked**

⚠️ **ATTEMPTED AND REVERTED 2026-07-21. Do not retry with `force-static` alone.**

Adding `export const dynamic = "force-static"` to about/contact/legal *does* prerender them —
the build emitted all 8 pages (2 locales × 4 routes) as `●` SSG. **But it silently breaks the
English locale.** Verified in the generated HTML:

```
.next/server/app/en/about.html  →  <html lang="ar" dir="rtl">   ← English content, Arabic shell
```

**Root cause:** `src/app/layout.tsx:62` resolves the locale with `await getLocale()`, which needs
a request context. Under static generation there isn't one, so it falls back to
`routing.defaultLocale` (`"ar"`) and stamps `lang="ar" dir="rtl"` onto every prerendered page
regardless of locale. English pages then render LTR text inside an RTL document — worse than the
per-request rendering this was meant to optimise away.

**Why it can't be fixed locally:** the root layout owns `<html>` because `/admin` lives *outside*
the `[locale]` segment, and Next.js permits only one `<html>` per app. next-intl's documented
static-rendering pattern puts `<html>` in `app/[locale]/layout.tsx`, which this architecture
cannot do without restructuring the admin subtree.

**Options, none small:**
1. Move `/admin` under `[locale]` so `[locale]/layout.tsx` can own `<html>` — largest change,
   but unlocks static rendering for the whole storefront.
2. Keep `<html>` neutral and set `lang`/`dir` on an inner wrapper per subtree. There is precedent
   — `admin/layout.tsx` already does exactly this — but `<html dir>` affects scrollbar side and
   document-level direction defaults, so this needs real RTL testing, not just a passing build.
3. Leave these four pages dynamic. They are cheap (no DB, no I/O) and the site is low-traffic;
   this is the honest default until 1 or 2 is worth doing.

**CACHE-01 (catalog caching) is unaffected by this** and remains the larger win: `revalidate` +
tag invalidation on home/shop/product, where the ~30 `revalidatePath` sites already exist with
nothing to invalidate. It does not touch `<html>`, so it can proceed independently.

- **Verification if retried:** `prerender-manifest.json` listing the pages is **not** sufficient.
  Grep the emitted HTML for `lang=`/`dir=` on **both** `/ar/...` and `/en/...` before believing it.

### 3.3 🔧 Bound `listProducts`
- **Priority:** P2 · **Finding:** PERF-01 · **Complexity:** Medium
- Push filtering, sorting and pagination into SQL instead of loading the full catalog with 4-deep
  includes and slicing in JS.
- **Dependencies:** 3.1 · **Verification:** Query count and timing on `/shop` under load.

### 3.4 🔧 Fix the cleanup cron
- **Priority:** P2 · **Findings:** DB-04, DB-05, HOST-03 · **Complexity:** Medium
- Batch the ownership check into one `findMany` per prefix (currently one `findFirst` per object
  against an unindexed column); extend it to `product-images`, which has **no cleanup at all**;
  set `maxDuration` in `vercel.json`.
- **Verification:** Run against a seeded bucket; confirm it completes within the limit.

### 3.5 ✅ SEO essentials — robots + sitemap DONE, JSON-LD open
- **Priority:** P2 · **Findings:** SEO-01, FE-04 · **Complexity:** Medium
- **Done:** `src/app/robots.ts` and `src/app/sitemap.ts`. The sitemap emits correct
  `localePrefix: "as-needed"` URLs (`/shop` for Arabic, `/en/shop` for English — emitting
  `/ar/...` would have filled it with redirects) and carries `alternates.languages` on every
  entry, which closes the hreflang half of FE-04. `robots.ts` is `force-dynamic` so flipping
  `COMING_SOON` in Vercel takes effect without a redeploy — otherwise the site would open while
  robots.txt still said `Disallow: /`.
- **Still open:** JSON-LD `Product` schema (the data is already computed in `generateMetadata`
  at `product/[slug]/page.tsx:16-32`), a web manifest, and per-page metadata for the six
  storefront pages that currently share one generic title/description.
- ⚠️ **Depends on `NEXT_PUBLIC_SITE_URL` being the real domain in Vercel** — both files derive
  every URL from it, and locally it resolves to `http://localhost:3000`.

### 3.6 🔧 Batch order pricing; reconcile the archived-orders discrepancy
- **Priority:** P3 · **Findings:** API-05, OBS-01 · **Complexity:** Small

---

## Phase 4 — Scalability

### 4.1 🔧 Enforce and size the connection pool
- **Priority:** P2 · **Finding:** DB-07 · **Complexity:** Small
- `.refine()` on `DATABASE_URL` asserting `:6543` or `pgbouncer=true`; set `PrismaPg({ max: 3 })`.
- The two Supabase connection strings sit adjacent in the dashboard; pasting the direct one gives
  10 direct connections per warm lambda.

### 4.2 🖐️ Pin regions
- **Priority:** P2 · **Finding:** HOST-02 · **Complexity:** Small
- `vercel.json` has no `regions`, so functions default to `iad1` regardless of the DB's region.
- **Verification:** Compare query latency before and after.

### 4.3 🔧 Move email off the request path
- **Priority:** P3 · **Complexity:** Large — **only at ~100× traffic**
- A queue with retry and a dead-letter. Today a Resend outage silently loses confirmations.

### 4.4 🔧 Retention for unbounded tables
- **Priority:** P3 · **Findings:** DB-10, and `email_logs`/`audit_logs` · **Complexity:** Medium
- `rate_limit_buckets` grows one row per unique IP forever with no TTL; `email_logs` and
  `audit_logs` grow without retention.

---

## Phase 5 — Reliability and recovery

### 5.1 🔧 Guard `docs/rollback.sql`
- **Priority:** P1 · **Finding:** DB-02 · **Complexity:** Small
- Add an abort-unless-confirmed clause. It currently drops all 22 tables and is protected only by
  a comment, in a workflow whose normal mode is pasting SQL into a production console.

### 5.2 🖐️ Storage and auth backups
- **Priority:** P2 · **Complexity:** Medium
- Scheduled copy of both buckets to independent storage; periodic Auth user export.

### 5.3 🖐️ Quarterly restore test
- **Priority:** P2 · **Complexity:** Medium
- **Verification:** Each test updates the recorded RTO in `AVAILABILITY-RECOVERY.md`.

### 5.4 🔧 Migration discipline
- **Priority:** P2 · **Complexity:** Medium
- Baseline `_prisma_migrations`, adopt `prisma migrate deploy`, require a tested reverse script per
  migration. Today every schema change is one-way.

### 5.5 🖐️ Runbooks
- **Priority:** P3 · **Complexity:** Small
- Secret rotation; DNS/registrar recovery; incident response (a draft checklist is already in
  `AVAILABILITY-RECOVERY.md`).

### 5.6 🔧 Drift check between `seed.ts` and `seed.sql`
- **Priority:** P3 · **Finding:** DB-11 · **Complexity:** Small
- Two hand-maintained copies of the same catalog data with nothing comparing them.

---

## Summary

| Phase | Items | Done | Manual | Remaining code work |
|---|---|---|---|---|
| 0 — Immediate critical | 5 | 2 | 3 | 0 |
| 1 — Security & data | 8 | 3 | 1 | 4 |
| 2 — Stability & observability | 7 | 1 | 3 | 3 |
| 3 — Performance | 6 | 0 | 0 | 6 |
| 4 — Scalability | 4 | 0 | 1 | 3 |
| 5 — Reliability & recovery | 6 | 0 | 3 | 3 |
| **Total** | **36** | **5** | **12** | **19** |

**Phase 0 is the launch gate.** As of 2026-07-21 two of its five items are complete: the public
API is closed (0.3) and **RLS is enabled and verified on all 22 tables (0.1)** — the audit's most
serious finding.

**Backups (0.2) are now the top risk and the main remaining blocker.** They are dashboard work,
not engineering: confirm the plan tier supports PITR, enable it, then actually restore once and
time it. Until a restore has been performed, recovery is a hypothesis.

Two items surfaced while verifying 0.1 and belong here:
- **Seed the catalog.** `products` is empty, so `/shop` renders nothing and `settings` (WhatsApp
  number, contact email — read by the storefront and by order emails) is unpopulated. Run
  `docs/seed.sql`, or add products through the admin once login is confirmed.
- **Confirm Vercel's `NEXT_PUBLIC_SUPABASE_URL` points at the project that was hardened.** This
  account holds more than one Supabase project, and a mismatch here is invisible: the site keeps
  working, nothing looks wrong, and the hardening simply applies to the wrong database.
