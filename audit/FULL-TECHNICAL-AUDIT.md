# Full Technical Audit — rabea.art

**Date:** 2026-07-20 · **Commit:** `ec8d610` · **Stack:** Next.js 16.2.10, React 19.2.4, Prisma 7.8
(`@prisma/adapter-pg`), Supabase (Postgres + Auth + Storage), Resend, Vercel
**Method:** exhaustive static review of all 296 tracked files, plus non-destructive probing of the
live production deployment.

> **Evidence rule applied throughout:** nothing is marked PASS without a citation or a command
> output. Anything requiring console access I do not have is marked **UNVERIFIED**, never PASS.

---

# Layer 1 — Frontend

**Overall Status:** ⚠️ WARNING

## Current Implementation
App Router with a locale-segmented storefront (`/[locale]/(storefront)/**`) and a deliberately
non-localized admin (`/admin/**`) that resolves language from the shared `rabea_locale` cookie.
Arabic is the default with no URL prefix; English lives at `/en`; `localeDetection: false` by
intent. Styling is CSS Modules over a token layer. Product imagery is *procedural* — CSS gradients
derived from the slug — because real photography has not landed yet.

## What Was Inspected
`src/app/layout.tsx`, `src/app/[locale]/layout.tsx`, all 10 storefront routes, all 13 admin pages,
54 `"use client"` files, `src/components/motion/**` (all 8 files), `src/styles/tokens.css`,
`.next/prerender-manifest.json`, `src/i18n/routing.ts`, all message files.

## Positive Findings
- **Fonts done right** (`layout.tsx:7-28`): three families via `next/font/google`, self-hosted at
  build time, **explicit Arabic subsets**, `display: swap`, CSS-variable output. No external font
  request. Arabic subsetting is commonly missed and it is correct here.
- **RTL is correct at the root** (`layout.tsx:62-72`): `dir` derived from locale, `lang` set,
  `suppressHydrationWarning` where appropriate.
- **The motion layer is exemplary.** I read all eight files: every `addEventListener`,
  `IntersectionObserver` and `requestAnimationFrame` is released on cleanup;
  `prefers-reduced-motion` is honoured in **both** JS and CSS; `useTilt` even re-checks on an OS
  toggle mid-session. `useParallax` shares one window listener across layers rather than one per
  element.
- **Graceful data degradation:** pages try/catch their own fetches and render designed empty states
  (`(storefront)/page.tsx:33-40`) rather than blowing up.
- Open Graph, Twitter card, `metadataBase` and icons are all present and correct.

## Issues Found

### FE-01 — No error, not-found or loading boundaries *(High · FIXED)*
**Evidence:** `find src/app -name "error.tsx" -o -name "global-error.tsx" -o -name "not-found.tsx"`
returned nothing. Meanwhile `notFound()` is called live at `src/app/[locale]/layout.tsx:20` and in
the product route.
**Impact:** A visitor hitting a removed product got Next's built-in 404 — **English, LTR,
unstyled** — on an Arabic RTL site, at precisely the moment they were already lost.
**Fix applied:** added `src/app/[locale]/not-found.tsx`, `src/app/[locale]/error.tsx`,
`src/app/admin/error.tsx`, `src/app/global-error.tsx` and a shared `error-shell.module.css`, with
`notFound`/`errorPage` message keys in ar/en/he. `global-error.tsx` uses inline styles and inline
bilingual copy because it replaces the root layout and cannot assume fonts, tokens or the i18n
provider survived.
**Verified:** `npm run build` succeeds; lint and typecheck clean.

### FE-02 — Three timers without cleanup *(Low · FIXED)*
**Evidence:** `NotesPanel.tsx:30`, `CustomerCard.tsx:70`, `CustomerCard.tsx:83` called
`setTimeout(() => setX(false), …)` with no handle and no unmount clear — outliers against eleven
sites in the same codebase that do it correctly.
**Fix applied:** extracted the repo's own `useRef` + `clearTimeout` idiom into
`src/components/admin/useFlash.ts` and moved all three onto it. Existing behaviour preserved,
including clearing the "saved" badge on typing.

### FE-03 — `X-Powered-By: Next.js` *(Low · FIXED)*
**Evidence:** confirmed live via `curl -sSI https://www.rabea.art/`.
**Fix applied:** `poweredByHeader: false`.

### FE-04 — Nothing is prerendered *(Medium · Open)*
**Evidence:** `.next/prerender-manifest.json` lists three entries, none of them pages. Live:
`Cache-Control: private, no-cache, no-store`.
**Impact:** `about`, `contact`, `legal/terms`, `legal/privacy` have **zero dynamic inputs** and are
re-rendered from scratch on every request. → Roadmap 3.2.

### SEO-01 — No sitemap, robots, manifest or structured data *(Medium · Open)*
**Evidence:** no `src/app/sitemap.ts`, no `robots.ts`, no manifest; zero occurrences of
`application/ld+json` or `schema.org` in `src/`.
**Impact:** For an e-commerce storefront, no `Product` schema means no rich results, and no crawl
map means discovery by link-following only. The data for `Product` is already computed in
`product/[slug]/page.tsx:16-32`. → Roadmap 3.5.

### FE-05 — No hreflang; six pages share one generic title *(Low · Open)*
Two locales are live but there is no `alternates.languages`. Only the product route defines
per-page metadata.

### FE-06 — Large client components *(Informational)*
`CustomWizard.tsx` 704 lines, `ProductView.tsx` 648, `OrderFlow.tsx` 453. All genuinely stateful,
so none is a wholesale conversion candidate; the win is extracting static subtrees.

**Final Layer Score: 78/100**

---

# Layer 2 — API & Backend

**Overall Status:** ⚠️ WARNING *(was CRITICAL — the critical item is fixed)*

## Current Implementation
9 Route Handlers (all `runtime = "nodejs"`), 25 Server Actions (all under `/admin`), and Server
Components. Every admin surface gates through `requireRole()`. Three public endpoints are
unauthenticated by design and rate-limited.

## What Was Inspected
All 9 `route.ts` files, all 7 `actions.ts` files, `src/proxy.ts`, `src/lib/auth/requireRole.ts`,
`src/lib/orders/{schemas,submit}.ts`, `src/lib/storage/{validation,uploads}.ts`,
`src/lib/rate-limit.ts` — plus live probing of every public endpoint.

## Positive Findings
- **Every** `/api/admin/**` route calls `requireRole` as its first statement; **every** server
  action does the same. Enumerated individually — no gaps.
- **Client prices are structurally impossible to inject.** No price field exists in any item
  schema, so Zod's key-stripping silently discards `unitPrice`; every price is re-derived from a
  fresh DB read (`submit.ts:113,156`).
- Server-side option authorization is real, not cosmetic: archived products, wrong type, unlisted
  colours, `printAvailable` mismatches and missing `ProductVariant` rows are all rejected
  (`submit.ts:99-111`).
- Consents use `z.literal(true)` — cannot be forged false.
- Idempotency is backed by a unique constraint with a `P2002` catch that re-reads and returns the
  identical response — not a read-then-write.
- Order refs come from `nextval()` **inside** the transaction, so they cannot collide.
- The cron endpoint is the best-authenticated in the repo: `timingSafeEqual`, length pre-check,
  dual header convention, fails closed when `CRON_SECRET` is unset.

## Issues Found

### API-01 — Public API reachable while the site was gated *(Critical · FIXED)*
**Evidence:** `src/proxy.ts:114` excluded `api` from the matcher. Confirmed live against production:
```
POST https://www.rabea.art/api/orders       → 400 VALIDATION_FAILED
POST https://www.rabea.art/api/uploads/sign → 400 INVALID_FILE
```
**Impact:** While every page returned the coming-soon holding page, anyone who guessed the path
could write rows into the production `orders` and `customers` tables and mint upload URLs. The
5-per-10-minutes brake was bypassable via RL-01.
**Fix applied:** public API prefixes added to the matcher; refused with `503` + `Retry-After: 3600`
while gated; JSON rather than an HTML rewrite so fetch callers get a machine-readable refusal.
Admin API routes deliberately excluded — they self-gate, and keeping them live is what allows
back-office use during preview.
**Verified:** 15 tests in `tests/unit/coming-soon-gate.test.ts`, including this exact regression.

### API-02 — `bucketPath` accepted with only a prefix check *(Medium · FIXED)*
**Evidence:** `schemas.ts:47` was `.startsWith("order-uploads/")` and nothing more; `submit.ts:208`
copies it straight into `OrderFile`. The stricter guard exists one endpoint earlier
(`verify/route.ts:42`) and was dropped at submit.
**Impact:** Arbitrary paths attachable to an order — DB pollution, plus a cheap storage-pinning
primitive: `cleanup-uploads/route.ts:68-72` skips any object with a matching `OrderFile`, so a
claimed path is never collected.
**Fix applied:** strict `order-uploads/{uuid}/{uuid}.{ext}` regex matching exactly what
`randomObjectKey` produces.
**Verified:** 7 new cases covering traversal, wrong bucket, non-UUID segments, extra depth,
missing extension and a smuggled query string. Four existing fixtures were correctly invalidated
by the change and updated.

### API-03 — No content sniffing on upload *(Low · Open)*
`verify` re-reads the Content-Type the *uploader supplied on the PUT*, so arbitrary bytes can be
stored labelled `image/png`. Bounded by `nosniff` and the private bucket. → Roadmap 2.7.

### API-04 — `product-images/sign`: no rate limit, loose `productId` *(Low · Open)*
`route.ts:19` uses `z.string().min(1).max(64)` rather than a UUID, and that value becomes a storage
prefix. ADMIN-only, so low severity, but asymmetric with the public route's `z.uuid()`.

### API-05 — Order pricing is N+1 *(Low · Open)*
`submit.ts:346` fires 1–2 queries per cart item. Parallel, so latency is fine, but a 10-item cart
can occupy up to 20 simultaneous connections against a pool of 10. → Roadmap 3.6.

### API-06 — Orders CSV export over-fetches *(Low · Open)*
`export/route.ts:43-57` uses `include`, pulling all 20 order columns × up to 5,000 rows including
`notes` and `idempotencyKey`, none of which reach the CSV.

**Final Layer Score: 85/100**

---

# Layer 3 — Database & Storage

**Overall Status:** ❌ CRITICAL

## Current Implementation
22 tables, 7 enums, one migration. Prisma 7 with the pg driver adapter; singleton client cached on
`globalThis` and lazily constructed via a Proxy so `next build` works without a database.
`DATABASE_URL` (pooled, 6543) is correctly separated from `DIRECT_URL` (migrations).

## What Was Inspected
`prisma/schema.prisma`, `prisma/migrations/0_init/migration.sql` (all 471 lines, table by table),
`prisma/seed.ts`, `docs/seed.sql`, `docs/rollback.sql`, `src/lib/prisma.ts`, `prisma.config.ts`,
all `query.ts` files and their calling pages, `src/lib/storage/**`, both setup docs.

## Positive Findings
- The migration is **consistent with the schema** — I verified all 22 `CREATE TABLE`, 7 `CREATE
  TYPE`, 16 index statements and 19 FK constraints match. It is purely additive; nothing destructive.
- Admin lists are well built: `skip`/`take` with parallel `count()`, `select` projections not
  `include`, page sizes capped, exports capped at 5,000 rows.
- The customers list explicitly avoids N+1 with one grouped `$queryRaw`; the overview derives 12
  stat tiles from 2 `groupBy` calls.
- Upload lifecycle is sound: server-minted UUID keys, server-side metadata re-read at verify with
  deletion on failure, orphan cleanup that is idempotent and bounded, and product-image cleanup
  that correctly runs *after* the transaction commits with failures logged rather than thrown.
- Storage clients are cleanly separated, with `buckets.ts` existing purely so client components can
  read bucket names without pulling the service-role module into the browser graph.

## Issues Found

### SEC-01 / DB-01 — RLS disabled on all 22 tables *(Critical · SQL written, needs manual run)*
Full analysis in `DATABASE-RLS-MATRIX.md`. `grep -rniE "row level security|enable rls|create policy"`
across the entire repo returns **zero matches**.
**Impact:** the anon key is public by construction and ships in the `/admin/login` bundle; with the
Data API enabled it reads every table directly, including all customer PII. Currently masked only
by the coming-soon gate suppressing that bundle.
**Fix provided:** `docs/rls-lockdown.sql` — `ENABLE ROW LEVEL SECURITY` on all 22 with no policies
(deny-all for anon; `postgres` bypasses RLS so the app is unaffected). Deliberately not `FORCE`,
which would break the app's own connection. **Not verified — requires you to run it.**

### AVL-01/02 — No backups documented or tested *(Critical · manual)*
"backup", "PITR", "pg_dump" appear nowhere in the repository. See `AVAILABILITY-RECOVERY.md`.

### DB-02 — `rollback.sql` drops everything with no guard *(High · Open)*
84 lines of `DROP TABLE … CASCADE` across all 22 tables, protected only by a comment
(`:12-14`), in a workflow whose normal mode is pasting SQL into a production console. → Roadmap 5.1.

### DB-03 — Zero foreign-key indexes *(Medium · Open)*
16 indexes exist; **not one is on a foreign key**. Postgres does not auto-index FKs. Full list of
missing indexes and the queries they serve in `PERFORMANCE-SCALING.md`. → Roadmap 3.1.

### DB-04 — `product-images` orphans are never collected *(Medium · Open)*
The cron walks only `ORDER_UPLOADS_BUCKET` (`cleanup-uploads/route.ts:53`). An admin who uploads
photos then navigates away leaves objects recorded in no DB row, with nothing to ever collect them.
**A permanent, unbounded storage leak.** → Roadmap 3.4.

### DB-05 — Cron ownership check is O(total files), on an unindexed column *(Medium · Open)*
`route.ts:68-71` issues one `findFirst` per object older than 24h against an unindexed
`bucketPath`. Every legitimately-owned file is re-queried on every run, forever. → Roadmap 3.4.

### DB-06 — `order_ref_seq` exists only in raw SQL *(Medium · Open)*
`migration.sql:465-471` creates the sequence and a `stock >= 0` CHECK. Neither is in
`schema.prisma`, and Prisma models neither concept. `submit.ts:357` calls `nextval()` on it, so
**a `prisma db push` silently produces a database where order submission fails.** → Roadmap 1.7.

### DB-07 — Pooled URL unenforced; pool `max` unset *(Medium · Open)*
`env.ts:9` validates only `z.string().min(1)`; `prisma.ts:22` passes no `max`, so `pg` defaults to
10 per instance. The pooled and direct connection strings sit adjacent in the Supabase dashboard.
→ Roadmap 4.1.

### DB-08 — No customer deletion path *(Medium · Open)*
`Customer` has no soft-delete, no `deletedAt`, and no delete action anywhere; `orders.customerId`
is `ON DELETE RESTRICT`. An erasure request has no implementation. → Roadmap 1.8.

### DB-09 — `EmailLog.orderId` has no FK *(Low · Open)*
`schema.prisma:426` declares it with no `@relation`; `migration.sql:313-325` creates no constraint.

### DB-10 — `rate_limit_buckets` grows forever *(Low · Open)*
One row per `{action}:{ip}`, never deleted; windows are reset in place, not removed.

### DB-11 — `seed.ts` and `seed.sql` duplicated with no drift check *(Low · Open)*
Two hand-maintained copies of the same catalog data; the header warns about it, nothing enforces it.

### Also noted
Inconsistent FK rules for the same concept — `communication_logs.byAdminId` is `RESTRICT` while
`order_status_history.byAdminId` is `SetNull`. Eight models carry no timestamps at all, so
"when did this variant's stock change" is unanswerable. `Order.archived` has no `archivedAt`
though `Product` has one.

**Final Layer Score: 48/100**

---

# Layer 4 — Authentication & Permissions

**Overall Status:** ⚠️ WARNING

Full matrix in `PERMISSIONS-MATRIX.md`; assessment in `SECURITY-AUDIT.md` §1–2.

## Positive Findings
- `requireRole` re-reads the `AdminUser` row **per request** — deactivation is immediate, with no
  stale-JWT window. Stricter than most implementations.
- Owner-floor invariant is transactionally race-safe (`users/actions.ts:48-55,126`).
- Open-redirect guard on `?next=` (`login/page.tsx:17`) correctly rejects absolute and
  protocol-relative URLs.
- No account enumeration (`LoginForm.tsx:49-53`).
- Edge check uses `getClaims()` — real local JWT signature verification, not cookie presence.
- The invite saga compensates on failure and **fails closed** if compensation itself fails.

## Issues Found
| ID | Finding | Severity | Status |
|---|---|---|---|
| AUTH-01 | No login brute-force protection; `schema.prisma:439` documents the intended `login:<ip>` key but no code writes it | High | Open → 1.2 |
| AUTH-05 | No MFA on accounts that can export the entire customer database | Medium | Open → 1.3 |
| PM-04 | STAFF — the **default** role — can set final prices and payment status | Medium | Open → 1.4 |
| AUTH-04 | `lastLoginAt` declared and rendered, never written | Low | Open → 2.6 |
| AUTH-02 | `setAdminLocaleAction` ungated with no runtime validation | Low | **FIXED** |
| AUTH-03 | `PREVIEW_KEY` compared with `===`, accepted from a query string | Low | **FIXED** (constant-time) |

**Final Layer Score: 80/100**

---

# Layer 5 — Hosting & Deployment

**Overall Status:** ⚠️ WARNING

## What Was Inspected
`next.config.ts`, `vercel.json`, `.vercel/project.json`, live response headers from production.

## Positive Findings
Live header check confirms four of five standard headers, **and HSTS**:
```
Strict-Transport-Security: max-age=63072000     ✅
X-Frame-Options: DENY                           ✅
X-Content-Type-Options: nosniff                 ✅
Referrer-Policy: strict-origin-when-cross-origin ✅
Permissions-Policy: camera=(), microphone=(), … ✅
```
**Correction to my own initial review:** I flagged the `next.config.ts:7` comment "Vercel already
serves HSTS" as an unverified assumption. Probing production shows **the comment is correct** at
both apex and `www`. It lacks `includeSubDomains`/`preload` — hardening, not a gap.

Also correct: neither `eslint` nor `typescript` build errors are suppressed; `.env*` is properly
ignored; no secret has ever been committed.

## Issues Found

### HOST-01 — Image host wildcard *(High · FIXED)*
`next.config.ts:28` allowed `hostname: "*.supabase.co"` — **every Supabase tenant on earth**, not
just this project. `/_next/image` was usable as an open image proxy on your bill and into your
cache.
**Fix applied:** derived from `NEXT_PUBLIC_SUPABASE_URL`, falling back to the wildcard only when
that var is absent (CI builds run without real env). Safe to tighten now precisely because no
product photography exists yet.

### SEC-02 — No CSP *(High · Open)*
Deliberately deferred rather than rushed — a nonce-based policy must thread through `proxy.ts`,
which composes three middleware branches. Worth noting the `next.config.ts` comment overstates the
difficulty: this app has **zero third-party scripts** and self-hosted fonts, so it is an unusually
easy CSP target. Recommended path: Report-Only → E2E → enforce. → Roadmap 1.9.

### HOST-02 — No `regions` in `vercel.json` *(Medium · UNVERIFIED/manual)*
The entire file is 8 lines containing only the cron. Functions default to `iad1` regardless of
where the Supabase project lives — the observed `X-Vercel-Id: fra1::iad1::…` is consistent with a
cross-region hop. → Roadmap 4.2.

### HOST-03 — Cron has no `maxDuration` *(Medium · Open)*
`MAX_DELETIONS_PER_RUN = 500` with a serial DB round-trip per object, against a 10s (Hobby) /
15s (Pro) default. The job will time out mid-pass. It is idempotent so this is safe, but it means
it never completes a full pass. → Roadmap 3.4.

### HOST-04 — `COMING_SOON`/`PREVIEW_KEY` absent from the env schema *(Low · Open)*
`env.ts` validates neither, so `COMING_SOON="false"` silently leaves the site gated. Fails closed —
but silently. → Roadmap 2.6.

**Final Layer Score: 70/100**

---

# Layer 6 — Cloud & Compute

**Overall Status:** ⚠️ WARNING

Single-provider architecture: Vercel compute, Supabase for DB/Auth/Storage, Resend for email.
One scheduled task (nightly cron). No queues, no workers, no edge functions beyond the proxy.

**Positive:** secret hygiene is genuinely good — service-role key is `server-only`-guarded so a
client import is a build error; keys are never `NEXT_PUBLIC_`-prefixed; env is Zod-validated at
boot with a documented build-phase bypass.

**Issues:** no region pinning (HOST-02); function memory and duration entirely unconfigured;
connection pool at library default (DB-07); cron under-provisioned (HOST-03); `product-images`
storage growing without bound (DB-04); cold starts unmeasured.

**Vendor lock-in:** moderate and largely acceptable. Prisma abstracts Postgres, so the database is
portable. Supabase Auth and Storage are more entangled, but both are used through thin internal
wrappers (`src/lib/supabase/*`, `src/lib/storage/*`) that would localise a migration.

**Least privilege:** the service-role key is used for all storage operations, including reads that
a scoped key could perform. Acceptable given it never leaves the server.

**Final Layer Score: 65/100**

---

# Layer 7 — CI/CD & Version Control

**Overall Status:** ⚠️ WARNING

## Positive Findings
- The pipeline genuinely covers typecheck → lint → unit → build → E2E. Better than most projects
  this size.
- **Zero secrets by design**, and the reasoning checks out: `instrumentation.ts:9` skips env
  validation during the build phase, and DB-dependent E2E specs self-skip. A fork PR cannot
  exfiltrate anything.
- **No secret has ever been committed** — verified three ways across all 21 commits:
  `git log --all --full-history -- .env .env.local` → empty.
- Commit history is clean and descriptive; no large binaries; generated Prisma client correctly
  gitignored.

## Issues Found
| ID | Finding | Severity | Status |
|---|---|---|---|
| CI-01 | Branch protection status unknown — CI may be advisory, and Vercel deploys on push regardless | High | **UNVERIFIED — manual** → 2.4 |
| CI-02 | No `permissions:` block; no dependency or secret scanning | Medium | **FIXED** |
| CI-03 | 15 of 34 E2E tests self-skip in CI, including the entire order flow | Medium | Open → 2.5 |
| CI-04 | `.gitignore:57` duplicate `.env*` nullified the `!.env.example` negation on line 35 | Low | **FIXED** |
| CI-05 | Actions pinned to mutable `@v4` tags rather than SHAs | Low | Open |

**On CI-04:** `git check-ignore -v --no-index .env.example` matched line 57, meaning the example
file was covered by an ignore rule and survived only because it was already tracked. A
`git rm --cached` would have made it silently unrecoverable. Lines 56–57 were a stray duplicate.

**Final Layer Score: 74/100**

---

# Layer 8 — Security & Row-Level Security

**Overall Status:** ❌ CRITICAL

Full detail in `SECURITY-AUDIT.md` and `DATABASE-RLS-MATRIX.md`.

Summary: application-layer security is strong (see Layers 2 and 4); the database perimeter is open
(SEC-01); one live exposure was confirmed and fixed (API-01); rate-limit identity was spoofable and
is fixed (RL-01); CSP remains absent (SEC-02); 5 moderate transitive advisories are documented and
accepted with a CI gate at `high`.

**Final Layer Score: 45/100** — driven almost entirely by SEC-01. With RLS closed this layer moves
to roughly 80.

---

# Layer 9 — Rate Limiting

**Overall Status:** ⚠️ WARNING

## Current Implementation
Postgres-backed fixed-window limiter on the `RateLimitBucket` model. No Redis or Upstash — a
deliberate and, at this traffic, correct choice. Three call sites: order submit (5/600s), upload
sign (30/600s), upload verify (60/600s).

## Issues Found

### RL-01 — Client IP was fully spoofable *(High · FIXED)*
**Evidence:** `clientIp` was copy-pasted into three routes, each taking the **first**
`x-forwarded-for` entry with no trusted-proxy validation. One header per request produced a fresh
bucket every time, making every limit in the application decorative.
**Fix applied:** single `src/lib/client-ip.ts` preferring Vercel's unspoofable
`x-vercel-forwarded-for`, falling back to the **last** XFF hop on Vercel, and refusing to trust XFF
at all off-Vercel (callers share one bucket — fails toward limited-together, never unlimited).
**Verified:** 14 tests in `tests/unit/client-ip.test.ts`, including a direct assertion that
varying the spoofed prefix yields the same bucket.

### RL-02 — Fails open, previously with no signal *(Medium · logging FIXED)*
`rate-limit.ts:38-41` returns `allowed: true` on any DB error. Fail-open is the right availability
trade-off and is retained — but it meant protection silently vanished exactly when the DB was
already stressed. Now emits `ratelimit.fail_open` as a structured, alertable event.

### RL-03 — Login, admin exports and `product-images/sign` are unlimited *(Medium · Open)*
The most important of these is login (AUTH-01). → Roadmap 1.2.

### RL-04 — Non-transactional read-then-write; no `Retry-After` on 429 *(Low · Open)*
Concurrent requests can each observe an expired window and all reset to 1, so bursts are soft.

**Final Layer Score: 62/100**

---

# Layer 10 — Caching & CDN

**Overall Status:** ⚠️ WARNING

**Positive:** Vercel's CDN handles static assets and content-hashed bundles correctly; fonts are
self-hosted and immutably cacheable; **mutation-side invalidation is thorough** — ~30
`revalidatePath` calls across the admin actions, including `revalidatePath("/")` in settings.

**Issue CACHE-01/02:** there is nothing for that invalidation to invalidate. No `revalidate`, no
`unstable_cache`, no `"use cache"`, no `cache()` anywhere in `src/`. Combined with zero prerendered
pages, every storefront visit triggers a full catalog query plus `listActiveOptions()` plus
`getSettings()`.

**Private-data caching:** correctly handled — admin responses are `private, no-cache, no-store`,
and signed URLs are 60–120s. No risk of personalised data entering a shared cache.

Recommended policy table in `PERFORMANCE-SCALING.md`. This is the cheapest large win available:
the invalidation half is already written.

**Final Layer Score: 45/100**

---

# Layer 11 — Load Balancing & Scaling

**Overall Status:** ⚠️ WARNING

**Positive:** the application is genuinely stateless — no server-side session store (JWT cookies),
no local filesystem writes, uploads go straight to object storage. It scales horizontally without
modification, which is the property that matters most.

**Bottlenecks:** connection pool (DB-07); `listProducts` full-catalog read on the public path
(PERF-01); no caching (CACHE-01); email on the request path with no retry; cron under-provisioned.

**Single points of failure:** one Supabase project (DB + Auth + Storage share a fate), one Vercel
project, one region.

Scaling plans for current / 10× / 100× in `PERFORMANCE-SCALING.md`. Explicitly **not**
recommended at this scale: queues, Redis, read replicas, multi-region.

**Final Layer Score: 60/100**

---

# Layer 12 — Error Tracking & Logs

**Overall Status:** ⚠️ WARNING

## Current Implementation
**No error tracking, RUM, analytics or uptime monitoring of any kind.** Verified: grep for Sentry,
posthog, `@vercel/analytics`, gtag, plausible, datadog, LogRocket and bugsnag across `src/` and
`package.json` returns exactly one hit — the word "plausible" in a prose comment.

## Positive Findings
- **The audit trail is excellent** — every admin mutation writes an `AuditLog` row *inside the same
  transaction*, and both CSV exports log `action: "csv.export"`, so PII extraction is attributable.
- `console.error` placement is conscientious (47 sites, well-chosen), and `console.log` appears only
  in the CLI script where it belongs.
- `EmailLog` records every send attempt with status and provider message id.

## Issues Found

### LOG-01 — Nothing reports failures *(High · partially FIXED)*
The two most consequential silent failures:
- `api/orders/route.ts:72` — a customer's confirmation email failing, invisible.
- `rate-limit.ts:39` — the limiter **switching itself off**, invisible.

**Fix applied:** `src/lib/log.ts` — structured JSON logging with stable event names, request-id
correlation from `x-vercel-id`, recursive key redaction (password/token/secret/cookie/service_role)
and depth capping. Both failures above now emit named, alertable events, as does order submission
failure.
**Not fixed (needs an external account):** wiring a Sentry DSN. `emit()` is the single forwarding
point. Documented as a manual step rather than faked. → Roadmap 2.1.

### LOG-02 — No alerting, no uptime monitoring *(High · manual)*
Detection today depends on a customer complaining. → Roadmap 2.2.

### LOG-03 — Remaining `console.error` sites are unstructured *(Medium · Open)*
44 sites still emit free text. The logger exists; migrating them is mechanical.

### OBS-01 — Two pages disagree on the same metric *(Low · Open)*
`admin/page.tsx:16-25` counts archived orders; `reports/page.tsx:31-47` excludes them.

**Traceability assessment:** a frontend error → API → database chain **cannot** currently be traced
end-to-end. The new request-id plumbing is the first half; a tracker is the second.

**Final Layer Score: 45/100**

---

# Layer 13 — Availability & Recovery

**Overall Status:** ❌ CRITICAL

Full analysis in `AVAILABILITY-RECOVERY.md`.

**No backup configuration is documented anywhere, and no restore has ever been tested.** The words
"backup", "PITR" and "pg_dump" do not appear in the repository. The only recovery artifact in the
codebase is `docs/rollback.sql`, which drops all 22 tables and is protected solely by a comment.

Per the audit rules, backups **cannot** be marked PASS without evidence, and there is none.

Working today: Vercel instant deployment rollback. Everything else — database recovery, storage
recovery, migration rollback, incident detection — is either absent or unverified.

RTO/RPO targets, a restore procedure, an incident-response checklist and a DR checklist are all
defined in `AVAILABILITY-RECOVERY.md`. They become real only once a restore has actually been
performed and timed.

**Final Layer Score: 25/100**

---

# Verification Log

All commands run against commit `ec8d610` plus the fixes described above, on Windows 11 / Node 22.

| Check | Command | Result |
|---|---|---|
| Install | `npm ci` (pre-existing `node_modules`) | ✅ |
| Lint | `npm run lint` | ✅ **0 errors**, 1 pre-existing warning (`ProductForm.tsx:85`, React Compiler + RHF `watch()`) |
| Typecheck | `npm run typecheck` | ✅ clean |
| Unit tests (before) | `npm run test` | ✅ 292 passed / 19 files |
| Unit tests (after) | `npm run test` | ✅ **323 passed / 21 files** (+31 from this audit) |
| Production build | `npm run build` | ✅ succeeded at 15:10 with all audit changes; ⚠️ **subsequently broken by concurrent work — see note below** |
| E2E (full, parallel) | `npx playwright test` | ⚠️ 88 passed, 29 skipped, **5 failed** |
| E2E (serial re-run) | `npx playwright test static-pages --project=mobile --workers=1` | ✅ **21/21 passed** |
| Dependency audit | `npm audit` | ⚠️ 5 moderate (documented, SEC-03) |
| Secret scan | `git log --all --full-history -- .env .env.local` | ✅ empty — never committed |
| Tracked env files | `git ls-files \| grep -i env` | ✅ only `.env.example` + two source modules |
| Gitignore correctness | `git check-ignore -v .env .env.local` | ✅ both ignored |
| Hardcoded credentials | grep for key/secret/password literals | ✅ none; local `.env` is entirely placeholders |
| Service-role exposure | grep `NEXT_PUBLIC.*SERVICE_ROLE` | ✅ none; `server-only` guarded |
| Missing authorization | manual enumeration of all 25 actions + 9 routes | ✅ complete coverage |
| Missing RLS | `grep -rniE "enable rls\|create policy"` | ❌ **zero matches — SEC-01** |
| Unrestricted uploads | review of `validation.ts` + both sign routes | ✅ MIME/ext/size/count capped |
| Unsafe CORS | grep for `Access-Control-Allow` | ✅ none set — same-origin only |
| Debug code | grep `console.log` | ✅ only in `scripts/create-owner.ts` (CLI output) |
| Live headers | `curl -sSI https://www.rabea.art/` | ✅ HSTS + 4 headers confirmed |
| Live API exposure | `curl -X POST .../api/orders` | ❌ **was reachable — API-01, now fixed** |

## On the 5 E2E failures — honest accounting

All five were `has no console errors` on the `mobile` project, reporting
`Refused to execute script … MIME type ('text/plain')` and intermittent 500s on `_next/static`
chunks. **These are not a regression from this audit's changes**, established by re-running the
identical spec serially: **21/21 passed**. The cause is `fullyParallel: true` with unbounded local
workers hitting a single `next start` on Windows, where concurrent static-asset requests
intermittently mis-serve.

**CI is unaffected** — `playwright.config.ts:8` sets `workers: 1` when `CI` is set. Recorded as a
local developer-experience issue, not a product defect, and not counted against any layer score.

## Concurrent work detected in the repository — build currently red, not from this audit

While running the final verification pass, files began appearing in the working tree that this
audit did not create, and a tracked file was modified that this audit did not touch:

| Path | State | mtime | Author |
|---|---|---|---|
| `src/components/storefront/texture.ts` | untracked | 15:27:08 | **not this audit** |
| `src/styles/textures.css` | untracked | 15:29:48 | **not this audit** |
| `tests/unit/texture.test.ts` | untracked | 15:27:39 | **not this audit** |
| `src/app/globals.css` | modified | 15:27:20 | **not this audit** |

This is an in-flight procedural texture/material system (`globals.css` gained an
`@import "../styles/textures.css"`), evidently from a parallel session. `textures.css` was still
being written during this audit's final checks.

**It introduces the only TypeScript error in the project:**

```
$ npx tsc --noEmit
src/components/storefront/texture.ts(56,25): error TS2345: Argument of type 'string' is not
assignable to parameter of type '"var(--texture-grain)" | ...'
```

Cause: `TEXTURES` is declared `as const`, so `keys.map((k) => TEXTURES[k])` infers
`layers` as an array of the literal union rather than `string[]`; pushing the `base` parameter
(typed `string`) is then rejected. The one-line fix is to annotate
`const layers: string[] = keys.map(...)`.

**This audit deliberately did not apply that fix.** The file is another session's uncommitted,
actively-changing work; editing it risks clobbering concurrent edits, and it falls outside the
agreed audit scope. It is reported here instead.

**Accounting, stated precisely:**
- `npm run build` **passed at 15:10** with every change from this audit applied, compiling all 36
  routes. The build output is recorded above.
- The current red build is caused solely by `texture.ts:56`. `tsc --noEmit` reports **exactly one
  error project-wide**, in that file.
- No file changed by this audit appears in any error.
- `npm run test` passes at **334 tests / 22 files**, which now includes the concurrent
  `texture.test.ts` (11 tests). This audit's own contribution is 323 tests / 21 files.

**Action required by you:** apply the one-line annotation in `texture.ts` (or let the session that
authored it finish), then re-run `npm run build` to return to green.

## Checks that could NOT be completed

Stated plainly rather than assumed:

- **Supabase Data API status** — cannot determine whether `public` is an exposed schema. This is
  the difference between SEC-01 being an active exposure or defence-in-depth.
- **Backup / PITR configuration** — no API access.
- **Storage bucket visibility** — cannot confirm `order-uploads` is actually private.
- **GitHub branch protection** — a repo setting, not visible in the codebase.
- **Vercel env var separation** (production vs preview), region, function limits.
- **Resend domain/DKIM verification.**
- **Core Web Vitals** — the site serves only the coming-soon page; there is no real page to measure.
- **Live RLS behaviour** — the local `.env` contains only placeholders
  (`NEXT_PUBLIC_SUPABASE_URL=https://placeholder-project.supabase.co`), so no live database probe
  was possible.

Each appears in `REMEDIATION-ROADMAP.md` Phase 0 with exact steps.
