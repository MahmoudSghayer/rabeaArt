# Continuation Prompt — rabea.art

Copy everything below the line into a fresh Claude Code session on any device.
Last updated: 2026-07-23 (session 3 — independent 13-layer re-audit).

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

## P0 — do now (regardless of gate status)

1. **Gate decision: RESOLVED — intentional soft-launch (owner-confirmed 2026-07-23), staying live.**
   Do not re-gate. Instead, decide on crawl policy: consider setting `robots.txt` to disallow-all /
   `noindex` until the catalog is real, so Google doesn't index the empty shop. (OPS-01/HOST-05)
2. **Rotate `PREVIEW_KEY`.** It is committed in plaintext in git history (SEC-04) — this doc used
   to contain the literal value; it has been redacted here, but rotation is still required because
   the old value survives in history. Store the new value ONLY in Vercel env, never in a repo file.
3. **Fix the order-confirmation email (API-07/CLOUD-01).** It's an un-awaited `void (async()=>{})()`
   in `src/app/api/orders/route.ts:44-75` with no `after()`/`waitUntil` — on Vercel the send (and
   its `EmailLog` write) can be dropped when the function freezes. This is the likely cause of the
   session-2 "email doesn't send" mystery. Fingerprint: run
   `SELECT at,"to",template,status,error FROM email_logs ORDER BY at DESC LIMIT 10;` — **no row at
   all** for a test order = this bug; a `failed` row = missing `RESEND_API_KEY`/unverified domain.
   Fix: `import { after } from "next/server"` and wrap the block (same for `dispatchStatusEmail`).
4. **Product pages soft-404 (FE-09).** `/product/<any-unknown-slug>` returns HTTP 200 "temporary
   error", not 404. Get Vercel function logs for one such request; suspect the `unstable_cache`
   wrap of `getProductBySlug`. This may also break *real* product pages once the catalog is seeded.
5. **Fix the recovery runbook before trusting any backup (AVL-06/AVL-07).** `docs/SETUP-DATABASE.md`
   never applies `docs/rls-lockdown.sql` or the index migration, and `docs/verify-restore.sql` has
   no UTF-8 encoding check — so a rebuild is insecure+under-indexed and a WIN1255 restore silently
   mangles Arabic while passing every check. Fix these, THEN do the timed rebuild drill (AVL-02).

## P1 — before a deliberate (re)launch or real order volume

- **Wire the product-image render path (FE-08).** The storefront renders CSS-gradient placeholders
  unconditionally; `queries.ts` already fetches+types `product.images`/`primaryImage` — nothing
  renders them. Branch `ProductCard`/`Gallery`/`ProductView` to `next/image`, gradient as fallback.
- **Error tracking + uptime (LOG-01/02).** Wire `@sentry/nextjs` into `src/lib/log.ts`'s `emit()`
  (all `log.error` sites report with zero call-site change) + one uptime check. Do **LOG-04 first**:
  `notify.ts:39` logs a customer email in cleartext and `REDACT_PATTERNS` has no PII coverage.
- **Login brute-force + MFA (AUTH-01/AUTH-05).** Sign-in is client-side, so add an app-level
  failed-attempt lockout and enable Supabase TOTP for OWNER/ADMIN. Admin is the crown jewel.
- **Upload verification bypass (API-06/SEC-07).** A direct `POST /api/orders` accepts a never-verified
  `bucketPath`. Require server-side verify (or inline `getObjectMetadata`) + magic-byte sniff.
- **Migration-drift guard (DB-13)** + **customer-erasure path (DB-08, `Customer.anonymizedAt`)**.
- **Branch protection (CI-01)** + **DB-gated E2E in CI (CI-03)** — the commerce path is untested.
- **Region pin (HOST-02)** `regions` in `vercel.json`; **connection pool cap (DB-07)** `max: 3`.
- **Confirm env scoping (HOST-06):** are Vercel Preview deploys pointed at a SEPARATE database, or
  can a PR-branch preview write production data? Verify in the dashboard.
- **Canonical domain (FE-13):** `NEXT_PUBLIC_SITE_URL=https://www.rabea.art` (currently apex, which
  308-redirects — every sitemap/OG/JSON-LD URL redirects).
- **Add the 6 missing FK indexes (DB-03)** — the prior "FIXED" was inaccurate.
- **Ship CSP report-only → enforce (SEC-02).**

## Blockers that need the site owner (not code)

- Add real products (catalog is empty). · Confirm daily backups + consider PITR (AVL-03). · Confirm
  production points at the RLS-hardened Supabase project, not another on the account (AVL-08). ·
  Storage buckets have no backup (AVL-04).

## Verification

`npm run lint && npm run typecheck && npm run test && npm run build`

Baseline to beat (HEAD `89ec89e`): lint **0 errors** (3 warnings — 1 real at `ProductForm.tsx:85`,
tripled by stale worktrees per CI-06), typecheck clean, **369 tests**, build compiles. `npx
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
