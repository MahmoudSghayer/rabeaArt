# Session 3 — Independent 13-Layer Re-Audit

**Date:** 2026-07-23 · **Commit re-audited:** `89ec89e` · **Method:** independent (audited from
code/config/live probes first, then diffed against sessions 1–2). Every CRITICAL and HIGH finding
was put through an adversarial refutation pass; **0 were refuted.**

> Read alongside `EXECUTIVE-SUMMARY.md` (updated dashboard) and `CONTINUE-HERE.md` (session-4
> handoff). This document supersedes the layer scores in `FULL-TECHNICAL-AUDIT.md`; the ID-keyed
> detail in `FINDINGS.md` / `SECURITY-AUDIT.md` / `AVAILABILITY-RECOVERY.md` remains valid except
> where a finding below marks it closed, regressed, or wrong.

---

## THE HEADLINE — the site is LIVE (intentional soft-launch, owner-confirmed)

Sessions 1–2 ended with a hard instruction: *"Do not remove `COMING_SOON` until items 1–5 are
done."* The gate is now off — and the owner confirmed (2026-07-23) this is an **intentional
soft-launch**, not a misconfiguration. Re-gating is therefore NOT the action; the entire P0/P1 list
below is a **live-production priority queue**, worked in order, with no pre-launch cushion left.
Confirmed six independent ways (five sub-audit agents + a direct orchestrator probe) on 2026-07-23:

```
GET https://www.rabea.art/            → 200, X-Matched-Path: /[locale], <title>Rabea.art</title>   (real storefront, NOT /coming-soon)
GET https://www.rabea.art/admin       → 307 → /admin/login?next=%2Fadmin                            (real login, not gated)
GET https://www.rabea.art/robots.txt  → Allow: /   (un-gated branch of robots.ts) + live Sitemap
GET https://rabea.art/                → 308 → https://www.rabea.art/
```

The gate is down while, per sessions 1–2's own still-open list and this session's findings, the
launch blockers are **not** resolved: the catalog is empty (`/shop` renders "لا نتائج هنا"),
product pages soft-404, product images have no render path, there is no error tracking, the DB
restore has never been tested, and the recovery runbook itself is broken. Every finding previously
softened as "fix before the gate drops" is now a **live production exposure**.

**OPS-01 (Critical, P0):** production is a live soft-launch (owner-confirmed 2026-07-23) with
sessions-1–2 blockers unresolved and zero observability, so no one is watching. Because staying live
is the intended state, the fixes below are worked as production priorities, not as a re-gate. Two
soft-launch-specific consequences to handle immediately: (a) `robots.txt` currently emits `Allow: /`
plus a live sitemap, so search engines are actively invited to crawl and index the **empty**
catalog — a soft-launch reachable by direct link does not require being indexed. Consider keeping
the site publicly reachable while setting robots to disallow-all (or noindex) until the catalog is
real, so the first Google impression isn't an empty shop. (b) With no error tracking and a
possibly-dropping order email, the first real customer's failure is invisible — LOG-01/02/04 and
API-07 move to the very top of the queue.

---

## Layer dashboard (this session)

| # | Layer | Score | Status | Δ vs S1–2 | Launch-blocking? |
|---|-------|:-----:|:------:|:---------:|:----------------:|
| 01 | Frontend | 5/10 | 🚨 CRITICAL | ↓ from 86/100 | **YES** |
| 02 | API & Backend | 7/10 | ⚠️ WARNING | ~ 85 | YES (API-06/07) |
| 03 | Database & Storage | 6/10 | ⚠️ WARNING | ~ 64 | no (DB-08/13 soon) |
| 04 | Auth & Permissions | 8/10 | ⚠️ WARNING | ~ 84 | YES (AUTH-01) |
| 05 | Hosting & Deployment | 5/10 | 🚨 CRITICAL | ↓ from 70 | **YES** |
| 06 | Cloud & Compute | 6/10 | ⚠️ WARNING | ~ 65 | YES (CLOUD-01) |
| 07 | CI/CD & Version Control | 7/10 | ⚠️ WARNING | ~ 74 | no |
| 08 | Security & RLS | 6/10 | ⚠️ WARNING | ↓ from 80 | YES (SEC-04/05) |
| 09 | Rate Limiting | 6/10 | ⚠️ WARNING | ~ 62 | YES (login) |
| 10 | Caching & CDN | 7/10 | ⚠️ WARNING | ~ 68 | no |
| 11 | Load Balancing & Scaling | 6/10 | ⚠️ WARNING | ~ 60 | no |
| 12 | Error Tracking & Logging | 4/10 | 🚨 CRITICAL | ~ 45 | **YES** |
| 13 | Availability & DR | 4/10 | 🚨 CRITICAL | ↓ from 66 | **YES** |

**Overall production readiness: 58/100 — 🚨 NOT READY FOR LAUNCH (and currently live regardless).**
The readiness verdict is gated by the weakest blocking items, not averaged: a live storefront with
an empty catalog, no product imagery, soft-404ing product pages, no failure visibility, and an
unproven+broken recovery path is below soft-launch quality — while being served to the public.

The application's *engineering* remains genuinely strong (server-side price authority, real
per-request RBAC, idempotent orders, no injection, SSRF-pinned image proxy, disciplined
audit-logging) — this verdict is about **product-completeness, operability, and recovery**, not
code quality.

---

## Findings by layer

### 01 — Frontend · 5/10 · CRITICAL
- **FE-07 (Critical, P0)** — coming-soon gate off; empty catalog live & crawlable (== OPS-01/HOST-05/SEC-05).
- **FE-08 (Critical, P0)** — no storefront code path renders DB-backed product images. `ProductCard.tsx:48`, `ProductView.tsx:162` unconditionally render `grainedArt(artKeyForSlug(slug))`; `Gallery.tsx` renders only gradients. The data *is* fetched and typed (`queries.ts` `images:true`, `sortedImages()`, `CatalogProductDetail.images`) but never rendered. Admin photo uploads can never reach a customer. **Fix:** branch `ProductCard`/`Gallery`/`ProductView` to `next/image` on `product.images` (sorted by `isPrimary`), gradient only as fallback. 1–2 days.
- **FE-09 (Critical, P0)** — `/product/[slug]` returns HTTP 200 "temporary error" instead of 404 for unknown slugs (verified 3/3; genuine bad route correctly 404s). Soft-404 + risks masking real product-page failures at launch. **Fix:** get Vercel function logs for one such request, seed a product and add an end-to-end test; `unstable_cache` wrapping of `getProductBySlug` is the prime suspect.
- **FE-10 (High, P1)** — cart-badge hydration gate applied in `OrderFlow` but not `SiteHeader` (`SiteHeader.tsx:51,145`), so every page can mismatch for a returning visitor with a saved cart. **Fix:** extract `useMounted()` and apply to the header. 30 min.
- **FE-11 (High, P1)** — `CustomWizard.tsx` (764 lines, the primary conversion flow) has zero focus management (WCAG 2.4.3). **Fix:** per-step `ref` + `.focus()` on step change; focus error on validation failure. 3–4 h.
- **FE-12 (Medium, P2)** — `--color-sienna` used as text color against the project's own documented WCAG rule (fails AA 4.68/4.35:1; `--color-sienna-deep` exists), incl. persistent `.navLinkActive`. **Fix:** sweep text uses to `-deep` + stylelint guard. 2–3 h.
- **FE-13 (Medium, P2)** — no page-level canonical/hreflang; sitemap/robots/OG/JSON-LD all emit the apex domain that 308-redirects to www. **Fix:** `NEXT_PUBLIC_SITE_URL=https://www.rabea.art` + per-page `alternates`. env 5 min / code 2–3 h.
- **FE-14 (Low, P3)** single static OG image (WhatsApp shares show generic card). **FE-16 (Low, P3)** admin thumbnails `alt=""`. **FE-15 (Info)** uncommitted WIP includes an unauth debug route `loader-preview/` ("delete after review") — do not commit as-is.
- *Strengths:* self-hosted fonts w/ preload, correct RTL at root (both locales, live), `ArtMarquee` zero-JS + correct aria, Product JSON-LD conservative Offer logic, per-request robots/sitemap flip, on-brand empty states.

### 02 — API & Backend · 7/10 · WARNING
- **API-06 (High, P1)** — upload verification is bypassable: `submitOrder` (`submit.ts:179-215`, txn `388-393`) builds `OrderFile` rows straight from the client payload with no storage re-check; `/api/orders` never requires `/api/uploads/verify` to have run. A direct POST with a well-formed but never-verified `bucketPath` is accepted. **Fix:** require server-side verification (verified-paths gate) or call `getObjectMetadata` inline at submit. 0.5–1 day.
- **API-07 (High, P1)** — order-confirmation email is dispatched via an un-awaited `void (async()=>{})()` before the response returns, with no `after()`/`waitUntil` anywhere (`route.ts:44-75`). Next 16.2.10 ships `after()`; the docs state serverless needs `waitUntil` or post-response work is not guaranteed to run. Silent drops of both the email *and* its `EmailLog` row. **Likely root cause of the session-2 "email doesn't send" mystery** — fingerprint: no `EmailLog` row at all (vs a `failed` row). **Fix:** wrap in `after()`; same for `dispatchStatusEmail`. 1–2 h.
- **API-03 (Medium, P2)** upload MIME trusted from declared value, not sniffed (root of API-06). **API-04 (Low, P2)** `/api/admin/product-images/sign` unmetered + `productId` not uuid-validated. **API-05 (Low, P3)** order pricing N+1. **API-08 (Info)** inconsistent error envelope (`error` vs `code`).
- *Strengths:* server-side re-pricing is authoritative (no client price field; qty bounded); idempotency race-safe (unique + P2002 refetch); order write fully transactional; all 7 admin actions follow requireRole→Zod→txn+AuditLog→revalidate; no route leaks stack/Prisma errors; CSV formula-injection defended.

### 03 — Database & Storage · 6/10 · WARNING
- **DB-13 (High, P1)** — zero migration-drift detection; deploy is 100% manual SQL-paste (`README:257-261`), CI has no `migrate`/`migrate diff`; the schema header itself warns a `prisma db push` silently drops `order_ref_seq` + the stock CHECK → total order-submission outage with no error. **Fix:** CI `prisma migrate diff --exit-code`; document never-`db push`. 2–4 h.
- **DB-08 (Medium, P1)** — customer erasure impossible: `orders.customerId` is `ON DELETE RESTRICT` and no delete/anonymize action exists. GDPR-style exposure once real PII accrues. **Fix:** `Customer.anonymizedAt` + in-place PII-nulling action. 1 day.
- **DB-03 (Medium, P2)** — the "FK indexes fixed" claim (`FINDINGS.md:29`) is **inaccurate**: 6 FK columns remain without a usable standalone index — `product_colors.colorId`, `product_sizes.sizeId`, `product_variants.colorId/sizeId` (all non-leading in composite uniques), `order_items.productId/variantId` (no index). Live seq-scan at `options/actions.ts:139-140`. **Fix:** idempotent index migration. 30 min.
- **DB-07 (Medium, P2)** `DATABASE_URL` not validated as pooled + Prisma pool `max` unset (default 10) → exhaustion risk (see Scaling). **DB-14 (Medium, P3)** N+1 write loop in variant sync. **DB-09/10/15/16 (Low)**, **DB-17/18/19 (Info)**: EmailLog FK missing, rate-bucket unbounded growth, unbounded `listProducts` pass, unpaginated customer orders, no log retention, JS-float money arithmetic over Decimal storage, TIMESTAMP-not-TIMESTAMPTZ.
- *Strengths:* Decimal money throughout (no Float); order txn well-built; LTV `$queryRaw` injection-safe; **DB-04 & DB-05 genuinely closed** (both-bucket orphan sweep + batched indexed lookup, commit `39bfa5f`); rollback arm-guard real.

### 04 — Auth & Permissions · 8/10 · WARNING
- **AUTH-01 (High, P1)** — no app-level login brute-force protection; sign-in is client-side `signInWithPassword`, so no route in this repo can rate-limit it. Supabase's own throttle is UNVERIFIABLE. Admin is the crown jewel (no payment gateway). **Fix:** app-level failed-attempt lockout + enable TOTP MFA. 0.5–1 day + 1–2 days.
- **AUTH-06 (High, P2)** — the "at least one active OWNER" invariant is **not** race-safe against concurrent removal of two *different* owners (textbook write-skew under READ COMMITTED; no `Serializable`/`FOR UPDATE`/advisory lock/CHECK). Contradicts `PERMISSIONS-MATRIX.md`'s "race-safe" claim (true only same-row). **Fix:** `isolationLevel: Serializable` or advisory lock on the owner set. 1–2 h.
- **AUTH-05 (Medium, P1)** no MFA. **AUTH-07 (Low-Med, P3)** Supabase session cookie not `httpOnly`/no explicit `secure` (mitigated by live HSTS). **AUTH-08 (Low)** `getClaims()` doesn't check `aud`/`iss` (SDK-level). **AUTH-09 (Low, P3)** `create-owner.ts` silently promotes an existing account to OWNER on rerun.
- *Strengths:* complete `requireRole` coverage (re-enumerated); 401→login / 403→no-access loop fix verified live; immediate revocation (fresh DB check every request); Server-Action CSRF on by default (vendored-docs confirmed, no `allowedOrigins`); global-scope logout; sound `?next=` open-redirect guard; STAFF cannot reach pricing or OWNER-only actions.

### 05 — Hosting & Deployment · 5/10 · CRITICAL
- **HOST-05 (Critical, P0)** — `COMING_SOON` off in production (== OPS-01/FE-07/SEC-05). **Fix:** confirm intent; re-gate if unintended (5 min).
- **HOST-06 (High, P0-verify)** — no environment-separation code (`VERCEL_ENV` never referenced). If `DATABASE_URL`/Supabase keys were scoped "All Environments" in Vercel, every Preview deploy (incl. dependabot/PR branches) reads and can **write production data**. UNVERIFIABLE from repo — **direct question for the owner.** **Fix:** confirm Production-only scoping; separate preview project; optional boot guard.
- **HOST-02 (High, P1)** — `vercel.json` has no `regions`; live `X-Vercel-Id: fra1::iad1` → every DB round-trip is cross-region (edge EU / function US-East). **Fix:** pin `regions` to Supabase's region. 15 min.
- **HOST-07 (Medium, P2)** deploy + schema migration are not atomic (Vercel auto-deploys; SQL pasted manually; code-rollback doesn't roll back schema). **HOST-04 (Low, P3)** `COMING_SOON`/`PREVIEW_KEY` absent from env Zod schema. **HOST-08 (Low, P2)** no `engines` pin (CI Node 22 not enforced on Vercel).
- *Strengths:* HSTS + 4 security headers live; apex 308→www; static assets immutable; cron `maxDuration:300` fixed; rollback arm-guard; build runs without secrets.

### 06 — Cloud & Compute · 6/10 · WARNING
- **CLOUD-01 (High, P0)** — same fire-and-forget email defect as API-07, framed as a *cloud* concern: Vercel can freeze the function before the send executes at all. Dual-confirmed. **Fix:** `after()`. 20 min + test order.
- **DB-07 (High, P2)** pool `max` unset (see Scaling).
- *Strengths:* `server-only` guard on service-role client; moderate lock-in (Prisma portable, thin Supabase wrappers); cron cost negligible; image-opt cost ~0 (no real photos yet). Vercel plan tier UNVERIFIABLE (Pro is a hint from the working 300 s `maxDuration`).

### 07 — CI/CD & Version Control · 7/10 · WARNING
- **CI-01 (High, P1)** — `main` branch protection **confirmed off** (`gh api … /branches/main` → `protected:false`, public repo); no in-repo gate ties Vercel deploys to CI. **Fix:** protect `main`, require `verify`+`e2e` + 1 review. 15 min.
- **CI-03 (High, P1)** — 4/12 E2E specs (`order-flow`, `shop-browse`, `duplicate-submit`, `mobile`) self-skip without `E2E_HAS_DB`, which CI never sets → the entire commerce path is untested on every push. **Fix:** ephemeral seeded Postgres + `E2E_HAS_DB=1`. 0.5–1 day.
- **CI-06 (Medium, P2)** `.claude/worktrees/**` not eslint-ignored → the one known warning is triple-counted; two fully-merged worktrees + 3 merged-but-undeleted branches. **Fix:** `git worktree remove` + `branch -d` + add ignore. 15 min.
- **CI-07 (Low, P2)** dependabot backlog at npm cap (8 open). **CI-05 (Low, P3)** actions on mutable `@v4` tags.
- *Strengths:* sound pipeline (typecheck/lint/unit/build + separate audit + Chromium e2e), least-privilege `permissions`, baseline at HEAD green (typecheck clean, **369/369 unit tests**, lint 0 errors).

### 08 — Security & RLS · 6/10 · WARNING · (Security Score 6/10, down from 80/100)
- **SEC-05 (Critical, P0)** production gate inactive (== OPS-01).
- **SEC-04 (High, P0)** — the real `PREVIEW_KEY` value is **committed in plaintext** in a tracked file (`audit/CONTINUE-HERE.md`, present at HEAD), not merely "leaked in chat" as previously framed — rotating the env var won't remove it from git history. **Fix:** rotate the key; redact the literal from the doc (done in this session's CONTINUE-HERE rewrite); standing rule = placeholders only. 20 min.
- **SEC-06 (Medium, P1)** `rls-lockdown.sql` has no future-tables enforcement; the next migration that adds a table ships with RLS off by default. **Fix:** CI check that every `public` table has `relrowsecurity=true`. 1–2 h.
- **SEC-07 (Medium, P1)** upload verify trusts the client-declared Content-Type, not real bytes (== API-06). **Fix:** magic-byte sniff. 2–3 h.
- **SEC-02 (Medium, P1)** no CSP (confirmed absent live) — today's XSS surface is ~zero (the one `dangerouslySetInnerHTML` in `ProductJsonLd` is provably escaped), but CSP is defense-in-depth vs a future regression/compromised dep. **SEC-08 (Low-Med, P2)** PII absent from log redaction + a cleartext-email log site (== LOG-04). **SEC-03 (Low, P3)** 5 accepted moderate transitive advisories.
- *Strengths (fresh evidence, several live):* no anon-key data access; service-role key `server-only` + build-enforced; no secrets in git history values; no SQLi (both `$queryRaw` tagged/static); CSRF framework-default; **SSRF pinning verified live** (`/_next/image?url=evil` → 400); path-traversal prevented; RLS uses `ENABLE` not `FORCE`, 22 tables match schema 1:1; all `target=_blank` carry `noopener`.

### 09 — Rate Limiting · 6/10 · WARNING
- **RL-07/AUTH-01 (High, P1)** login has no server-side path in this repo → app-level brute-force defense is structurally impossible; `AdminUser` has no lockout field. **Fix:** app-level lockout. 0.5–1 day.
- **RL-03 (Medium, P1/P2)** login + 5 admin cost endpoints (3 CSV exports, file download, product-image sign) are unmetered (role-gated only). **Fix:** `checkRateLimit` on the 5 admin routes. 1–2 h.
- **RL-04 (Medium, P2)** fixed-window reset is a TOCTOU race (boundary burst); 429s omit `Retry-After`; limiter has no unit test. **RL-05 (Low-Med, P3)** bucket table unbounded (== DB-10). **RL-06 (Low, P3)** off-Vercel shared "untrusted" bucket risks flaky CI.
- *Strengths:* RL-01 IP-spoofing fix genuinely holds (`client-ip.ts`, 10 tests — prior audit's "14 tests" citation is wrong but the fix is sound); fail-open is the correct direction for a non-security-boundary control; steady-state increment is atomic. No AI endpoints, no inbound webhooks.

### 10 — Caching & CDN · 7/10 · WARNING
- **CACHE-02 (Medium, P2)** still architecturally blocked (`force-static` breaks `/en` via `getLocale()` in the shared root layout). Cache Components does **not** unblock it, but **multiple root layouts** do (split the shared `layout.tsx` along the existing `[locale]`/`admin` boundary — admin needn't move). Roadmap Option 1 overstated the cost. 1–2 days incl. RTL regression.
- **CACHE-03 (Low, P3)** `productTag(slug)` is dead code; every product edit dumps the whole product cache (not a correctness bug — global tag is consistent — but a stale comment + missed optimization). **CACHE-04 (Info)** all storefront HTML is dynamic SSR (acceptable to launch; compute-only cost).
- *Strengths:* tag-typo risk structurally eliminated (shared `CATALOG_TAGS`, TS-checked, 29 sites); static assets immutable HIT; sitemap ISR HIT; robots force-dynamic MISS — all verified live. Doc drift: `FULL-TECHNICAL-AUDIT.md:484` still says "Caching 45/100" vs the rescored 68.

### 11 — Load Balancing & Scaling · 6/10 · WARNING
- **DB-07 (High, P1)** — `PrismaPg({connectionString})` with no `max` → default 10 connections/instance, uncapped across Vercel's autoscaled instances; `DATABASE_URL` not asserted as the pooled `:6543` form. Passive approach to whatever Supavisor's ceiling is. **Fix:** `max: 3` + `.refine()` for `:6543`/`pgbouncer=true`. 30 min.
- **SCALE-01 (Low, P3)** limiter's read-then-write adds 2 sequential DB round-trips per protected request + hot-IP row contention (+ HOST-02 cross-region tax). Non-issue at current traffic.
- *Strengths:* genuinely stateless (JWT cookies, no FS writes, uploads→Storage, Postgres-backed limiter); DB-04/05 storage scaling fixed; catalog caching covers 3/4 hot reads; queue/multi-region correctly not-yet-needed for an art shop.

### 12 — Error Tracking & Logging · 4/10 · CRITICAL
- **LOG-01 (High, P1)** no Sentry/error tracker anywhere; `log.ts`'s `emit()` and `instrumentation.ts` are ready-made unused hook points. **Fix:** wire `@sentry/nextjs` into `emit()` (all `log.error` sites report with zero call-site change) + CI source-map upload. ~4–6 h.
- **LOG-02 (High, P1)** no uptime monitoring or alerting; detection = someone noticing. **Fix:** one external uptime check + optional `/api/health`. 0.5–1.5 h.
- **LOG-04 (High, P1)** — customer email logged in plaintext via unstructured `console.error` (`notify.ts:39`); `log.ts` `REDACT_PATTERNS` is credential-only with **zero PII coverage** (name/phone/address never redacted). Widens the moment LOG-01 forwards logs off-platform. **Fix:** route through `log.error` + add PII patterns. 1 h — **land before Sentry.**
- **LOG-03 (Medium, P2)** ~40 raw `console.*` bypass the structured logger. **OBS-01 (Low)** carried.
- *Strengths:* `log.ts` design is good (depth-capped redaction, stable events, requestId correlation); the 6 real sites are PII-clean; `EmailLog`/`AuditLog` are a genuine pull-based domain trail.

### 13 — Availability & Disaster Recovery · 4/10 · CRITICAL
- **AVL-02 (Critical, P0)** — restore never tested; the only attempt on record failed before reaching data (`initdb` >10 min). An untested backup is a hypothesis. **Fix:** timed dashboard rebuild drill — but fix AVL-06/07 first, or it's a false-positive.
- **AVL-06 (High, P0)** — the official rebuild runbook (`docs/SETUP-DATABASE.md`) never applies `rls-lockdown.sql` or the index migration, so a from-zero rebuild reproduces the RLS-disabled hole SEC-01 closed + is under-indexed. **Fix:** add the missing steps (doc-only, 1 h).
- **AVL-07 (High, P0)** — `verify-restore.sql`'s 10 checks include no database-encoding check; a WIN1255-mangled restore of this Arabic-first site (a failure mode the team already hit) passes all 10 silently. **Fix:** add a `pg_encoding_to_char = 'UTF8'` check. 30 min.
- **AVL-04 (High, P1)** Storage buckets have no backup at all (Supabase DB backups exclude Storage). **AVL-03 (High, P1)** RPO 24 h, no PITR confirmed. **AVL-05 (Medium, P2)** no secret-rotation/DNS runbook — SEC-04 is a ready-made case study. **AVL-08 (Info, UNVERIFIABLE)** Supabase project-mismatch risk (would silently invalidate the whole RLS/backup story).
- **RTO/RPO:** bad deploy RTO ~5 min/RPO 0 (Vercel rollback); single-row corruption RTO unbounded (no PITR)/RPO ≤24 h; full DB loss RTO unproven (~half–full day, and would regress RLS+indexes if "fixed" per the runbook)/RPO ≤24 h; Storage loss = no recovery, total; regional outage = single-region, provider-dependent.
- *Strengths:* rollback arm-guard real; `verify-restore.sql` well-designed as far as it goes; storage buckets correctly private/public; orphan cron bounded.

---

## Prior-audit corrections (things sessions 1–2 got wrong or missed)

- **DB-03 "FIXED"** — inaccurate; 6 FK columns still unindexed.
- **"Race-safe owner floor"** (`PERMISSIONS-MATRIX.md`) — only true same-row; write-skew across two owners is live (AUTH-06).
- **`SECURITY-AUDIT.md` "no `dangerouslySetInnerHTML` anywhere"** — stale; `ProductJsonLd.tsx` (added after the doc) has one (verified safe, but the claim is false).
- **`PREVIEW_KEY` "leaked in chat"** — it's committed to the repo (SEC-04), a worse exposure.
- **"14 tests" for RL-01** — actually 10 (fix still sound).
- **CSS-gradient art framed as a temporary content gap** — there is no render path at all (FE-08), a core-product gap.
- **The rebuild-drill "quick win" (66→76)** — would currently produce a false all-clear (AVL-06/07).
- **The gate was assumed up** — it is down; the prior audit couldn't have known, but it changes everything.
- **Doc drift:** `FULL-TECHNICAL-AUDIT.md:484` still reads "Caching 45/100" post-rescore.

## Verification method note

Baseline at HEAD `89ec89e`: `tsc --noEmit` clean, `vitest run` **369/369**, `eslint` 0 errors / 3
warnings (the single `ProductForm.tsx:85` React-Compiler warning triple-counted from stale
worktrees — CI-06). All CRITICAL/HIGH findings passed an adversarial refutation pass (three
skeptic agents, 0 refuted). Production claims were verified with GET-only probes against
`www.rabea.art` / `rabea.art`. Dashboard-only facts (RLS live state, backups, branch-protection
detail, Vercel env scoping, Supabase region/project) are marked UNVERIFIABLE and scored as
unresolved.
