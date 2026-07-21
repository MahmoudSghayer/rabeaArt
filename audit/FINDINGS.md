# Findings Register — rabea.art

Audit date: 2026-07-20 · Commit: `ec8d610` · Auditor: automated full-stack review
Evidence convention: every finding cites `file:line` or a reproducible command. Findings marked
**UNVERIFIED** could not be reached from the codebase and require console access.

**Totals: 5 CRITICAL (2 closed, 3 open) · 24 WARNING · 19 PASS · 17 fixed**

_Update 2026-07-21: **SEC-01 CLOSED AND VERIFIED** — RLS enabled on all 22 tables, confirmed by
reading `pg_class.relrowsecurity` directly (22/22 true). The three remaining CRITICAL items are
AVL-01, AVL-02 (backups) and DB-02 (unguarded rollback script)._

_Update 2026-07-21 (session 2): branches reconciled onto `main`; PM-04 (financial actions raised STAFF→ADMIN) and DB-03 (21 missing indexes) fixed. See REMEDIATION-ROADMAP.md._

| ID | Layer | Finding | Status | Severity | Impact | Fix Status | File or Service |
|----|-------|---------|--------|----------|--------|------------|-----------------|
| SEC-01 | Security & RLS | RLS disabled on all 22 tables; anon key + Data API may expose all customer PII | CRITICAL | Critical | Full read of names, phones, emails, addresses by anyone with the public anon key | ✅ **CLOSED & VERIFIED 2026-07-21** — `pg_class` reports `relrowsecurity = true` on all 22 | `docs/rls-lockdown.sql` |
| API-01 | API & Backend | Coming-soon gate excluded `/api/**` — public write endpoints live to the internet | CRITICAL | Critical | Anonymous writes into production `orders`/`customers` while site appears closed | **FIXED** | `src/proxy.ts:114` |
| AVL-01 | Availability | No backup configuration documented or verified anywhere in the repo | CRITICAL | Critical | Total data loss is unrecoverable; no evidence PITR exists | **Manual action** | Supabase dashboard |
| AVL-02 | Availability | No restore has ever been tested | CRITICAL | Critical | An untested backup is a hypothesis, not a recovery plan | **Manual action** | Supabase dashboard |
| DB-02 | Database | Only recovery artifact in-repo is `rollback.sql`, which *drops everything*, with no guard | CRITICAL | High | One paste into the wrong SQL editor destroys production | Open | `docs/rollback.sql:12` |
| RL-01 | Rate Limiting | Client IP read from first `x-forwarded-for` hop — fully spoofable | WARNING | High | One header per request defeats every rate limit in the app | **FIXED** | `src/lib/client-ip.ts` (new) |
| LOG-01 | Error Tracking | No error tracking, RUM, alerting or uptime monitoring of any kind | WARNING | High | Failures are invisible; nobody is paged, ever | Partially fixed (structured logging) | `src/lib/log.ts` (new) |
| FE-01 | Frontend | No `error.tsx`, `global-error.tsx` or `not-found.tsx` anywhere | WARNING | High | Live `notFound()` rendered Next's English LTR default on an Arabic RTL site | **FIXED** | `src/app/[locale]/not-found.tsx` (new) |
| SEC-02 | Security | No Content-Security-Policy | WARNING | High | No defence-in-depth against injected script | Open (roadmap P1) | `next.config.ts:7-10` |
| HOST-01 | Hosting | `images.remotePatterns` allowed `*.supabase.co` — every Supabase tenant on earth | WARNING | High | `/_next/image` usable as an open image proxy on your bill | **FIXED** | `next.config.ts:28` |
| AUTH-01 | Auth | No application-level login brute-force protection | WARNING | High | Only Supabase's project-wide limits stand between an attacker and the admin | Open (roadmap P1) | `src/app/admin/login/LoginForm.tsx:45` |
| CI-01 | CI/CD | Branch protection / required checks status unknown | WARNING | High | CI may be advisory only; unreviewed code could reach `main` | **UNVERIFIED — manual** | GitHub repo settings |
| DB-03 | Database | Zero foreign-key indexes across the entire schema | WARNING | Medium | Seq scans on every join; degrades sharply with order volume | **FIXED** (migration written, needs manual apply) | `prisma/migrations/20260721000000_add_missing_indexes/` |
| DB-04 | Storage | `product-images` orphans are never collected by any process | WARNING | Medium | Permanent, unbounded storage leak on every abandoned product form | Open (roadmap P3) | `src/app/api/cron/cleanup-uploads/route.ts:53` |
| DB-05 | Database | Cleanup cron does one `findFirst` per object against an unindexed `bucketPath` | WARNING | Medium | Cost grows with total files retained, not orphans; compounds with HOST-03 | **Partially fixed** — `bucketPath` now indexed (DB-03); batching still open | `.../cleanup-uploads/route.ts:68-71` |
| DB-06 | Database | `order_ref_seq` + stock CHECK exist only in raw migration SQL, not `schema.prisma` | WARNING | Medium | A `prisma db push` silently breaks order submission | Open (roadmap P1) | `prisma/migrations/0_init/migration.sql:465-471` |
| DB-07 | Database | `DATABASE_URL` not validated as pooled; `PrismaPg` pool `max` unset (defaults to 10) | WARNING | Medium | A port-5432 paste in Vercel exhausts Supabase connections in the low tens of instances | Open (roadmap P4) | `src/lib/env.ts:9`, `src/lib/prisma.ts:22` |
| DB-08 | Database | `Customer` has no soft-delete and no deletion path; `orders.customerId` is RESTRICT | WARNING | Medium | A data-erasure request currently has no implementation | Open (roadmap P1) | `prisma/schema.prisma` |
| PERF-01 | Performance | `listProducts` is an unbounded `findMany` with 4-deep includes, paginated in JS | WARNING | Medium | Full catalog + relations loaded per anonymous `/shop` hit, uncached | Open (roadmap P3) | `src/lib/catalog/queries.ts:248-274` |
| CACHE-01 | Caching | No caching anywhere: no `revalidate`, `unstable_cache`, or `"use cache"` | WARNING | Medium | Near-static catalog re-queried on every request | Open (roadmap P3) | all of `src/app` |
| CACHE-02 | Caching | Nothing is prerendered — about/contact/legal have zero dynamic inputs yet SSR per hit | WARNING | Medium | Wasted compute on pure-content pages | **BLOCKED — architectural**, see note below | `src/app/layout.tsx:62` |
| HOST-02 | Hosting | `vercel.json` sets no `regions` — functions default away from the DB | WARNING | Medium | Cross-region round trip on every query | **UNVERIFIED — manual** | `vercel.json` |
| HOST-03 | Hosting | Cron has no `maxDuration`; 500 serial deletions cannot finish in the plan default | WARNING | Medium | Nightly job times out mid-pass every run | Open (roadmap P3) | `vercel.json`, `.../cleanup-uploads/route.ts:22` |
| SEO-01 | Frontend | No `sitemap.ts`, `robots.ts`, manifest, or JSON-LD structured data | WARNING | Medium | No crawl map and no `Product` rich results for an e-commerce site | **Partially FIXED** — `robots.ts` + `sitemap.ts` shipped with hreflang; JSON-LD and manifest still open | `src/app/robots.ts`, `src/app/sitemap.ts` |
| CI-02 | CI/CD | No `permissions:` block; no dependency or secret scanning | WARNING | Medium | Over-scoped `GITHUB_TOKEN`; advisories land unnoticed | **FIXED** | `.github/workflows/ci.yml`, `.github/dependabot.yml` |
| CI-03 | CI/CD | 15 of 34 E2E tests self-skip in CI (no `E2E_HAS_DB`) | WARNING | Medium | Green badge over a suite that never exercises the order flow | Open (roadmap P2) | `tests/e2e/order-flow.spec.ts:12` |
| SEC-03 | Security | 5 moderate transitive advisories (postcss via `next`, `@hono/node-server` via `@prisma/dev`) | WARNING | Medium | Only resolvable by downgrading `next`; accepted and now tracked | Documented, CI gate at `high` | `npm audit` |
| RL-02 | Rate Limiting | Limiter fails open on DB error, previously with no alertable signal | WARNING | Medium | Protection silently disappears exactly when the DB is stressed | Logging **FIXED**; behaviour retained by design | `src/lib/rate-limit.ts:38` |
| RL-03 | Rate Limiting | Login, admin exports and `product-images/sign` have no rate limit | WARNING | Medium | Unbounded credential stuffing and export abuse | Open (roadmap P1) | `src/app/api/admin/**` |
| RL-04 | Rate Limiting | Read-then-write is non-transactional; 429 responses carry no `Retry-After` | WARNING | Low | Burst limits are soft under concurrency | Open (roadmap P3) | `src/lib/rate-limit.ts:21-37` |
| API-02 | API & Backend | `OrderFile.bucketPath` accepted with only a `startsWith` check | WARNING | Medium | Arbitrary paths attachable to an order; storage-pinning against cleanup cron | **FIXED** | `src/lib/orders/schemas.ts:57` |
| API-03 | API & Backend | Upload MIME is taken from the uploader's own PUT header; no content sniffing | WARNING | Low | Arbitrary bytes storable labelled `image/png` | Open (roadmap P2) | `src/lib/storage/validation.ts:38-42` |
| API-04 | API & Backend | `product-images/sign` has no rate limit and `productId` is not a UUID | WARNING | Low | ADMIN-only, so low severity; asymmetric with the public route | Open (roadmap P2) | `src/app/api/admin/product-images/sign/route.ts:19` |
| API-05 | API & Backend | Order pricing is N+1: 1–2 queries per cart item | WARNING | Low | A 10-item cart can occupy up to 20 of 10 pool slots | Open (roadmap P3) | `src/lib/orders/submit.ts:346` |
| PM-04 | Auth & Permissions | STAFF (the default role for new invitees) could set final prices and payment status | WARNING | Medium | Financial mutation available to the least-privileged role | **FIXED** | `src/app/admin/orders/[id]/actions.ts:160,196` |
| AUTH-02 | Auth | `setAdminLocaleAction` ungated with no runtime validation of its argument | WARNING | Low | Arbitrary string into a cookie via a public POST endpoint | **FIXED** | `src/app/admin/actions.ts:25` |
| AUTH-03 | Auth | `PREVIEW_KEY` compared with `===` and accepted from a query string | WARNING | Low | Timing-comparable; key lands in access logs and Referer | **FIXED** (constant-time) | `src/proxy.ts:26` |
| AUTH-04 | Auth | `AdminUser.lastLoginAt` is declared and rendered but never written | WARNING | Low | Admin UI always shows "n/a"; no signal for account compromise | Open (roadmap P2) | `prisma/schema.prisma:80` |
| FE-02 | Frontend | Three `setTimeout`→`setState` calls with no cleanup | WARNING | Low | State updates against unmounted components | **FIXED** | `src/components/admin/useFlash.ts` (new) |
| FE-03 | Frontend | `X-Powered-By: Next.js` served in production | WARNING | Low | Free reconnaissance | **FIXED** | `next.config.ts` |
| FE-04 | Frontend | No `hreflang`/`alternates.languages`; six storefront pages share one generic title | WARNING | Low | Duplicate-content signals across two live locales | Open (roadmap P3) | `src/app/[locale]/layout.tsx` |
| CI-04 | CI/CD | `.gitignore:57` duplicate `.env*` nullified the `!.env.example` negation | WARNING | Low | `.env.example` would vanish if ever untracked | **FIXED** | `.gitignore` |
| HOST-04 | Hosting | `COMING_SOON` / `PREVIEW_KEY` absent from the `env.ts` Zod schema | WARNING | Low | A typo silently leaves the site gated; fails closed, but silently | Open (roadmap P2) | `src/lib/env.ts` |
| DB-09 | Database | `EmailLog.orderId` has no relation and no foreign key | WARNING | Low | No referential integrity on email→order linkage | Open (roadmap P3) | `prisma/schema.prisma:426` |
| DB-10 | Database | `rate_limit_buckets` grows unboundedly; no TTL or cleanup | WARNING | Low | One row per unique IP forever | Open (roadmap P3) | `src/lib/rate-limit.ts` |
| DB-11 | Database | `prisma/seed.ts` and `docs/seed.sql` duplicated with no drift check | WARNING | Low | Silent divergence between the two install paths | Open (roadmap P5) | both files |
| OBS-01 | Error Tracking | Overview page counts archived orders; Reports excludes them | WARNING | Low | Two pages report different values for the same metric | Open (roadmap P3) | `src/app/admin/page.tsx:16-25` |

## PASS findings (verified, with evidence)

| ID | Layer | Verified behaviour | Evidence |
|----|-------|--------------------|----------|
| P-01 | Auth | Every admin route and server action calls `requireRole` as its first DB-touching act | 25 actions + 5 API routes; `src/lib/auth/requireRole.ts:27-36` |
| P-02 | Auth | Role check re-reads the DB row per request — deactivation is immediate, no stale-JWT window | `requireRole.ts:30-34` |
| P-03 | Auth | Owner-floor invariant is race-safe — count runs inside the same transaction as the update | `src/app/admin/users/actions.ts:48-55,126` |
| P-04 | Auth | Open-redirect guard on `?next=` rejects absolute and protocol-relative URLs | `src/app/admin/login/page.tsx:17` |
| P-05 | Auth | Login errors are generic — no account enumeration | `LoginForm.tsx:49-53` |
| P-06 | API | Client-supplied prices are structurally impossible: no price field exists in any item schema | `src/lib/orders/schemas.ts` |
| P-07 | API | Every price re-derived from a fresh DB read at submit time | `src/lib/orders/submit.ts:113,156` |
| P-08 | API | Consents use `z.literal(true)` — cannot be forged false | `schemas.ts:142-143` |
| P-09 | API | Idempotency backed by a unique constraint with a P2002 catch, not a read | `submit.ts:343,404-407` |
| P-10 | API | Order ref allocated via `nextval()` inside the transaction — refs cannot collide | `submit.ts:357` |
| P-11 | Security | Cron auth uses `timingSafeEqual` with a length pre-check, and fails closed if unset | `.../cleanup-uploads/route.ts:30-40` |
| P-12 | Security | Service-role key is `server-only` guarded — client import is a build error, not a leak | `src/lib/supabase/admin.ts:1` |
| P-13 | Security | **No secret has ever been committed** — verified across all refs and full history | `git log --all --full-history -- .env .env.local` → empty |
| P-14 | Security | SVG deliberately excluded from the upload allowlist, with documented XSS rationale | `src/lib/storage/validation.ts:10-16` |
| P-15 | Security | Upload object keys are server-minted UUIDs; client filename never reaches the key | `validation.ts:68-72` |
| P-16 | Frontend | Every motion listener, observer and rAF is released; reduced-motion honoured in JS *and* CSS | `src/components/motion/**` (all 8 files) |
| P-17 | Frontend | Fonts self-hosted via `next/font` with explicit Arabic subsets and `display: swap` | `src/app/layout.tsx:7-28` |
| P-18 | Observability | `AuditLog` written inside the same transaction as every admin mutation, and on every CSV export | 25 action sites + 2 export routes |
| P-19 | CI/CD | CI uses zero secrets by design — a fork PR cannot exfiltrate anything | `.github/workflows/ci.yml` |
