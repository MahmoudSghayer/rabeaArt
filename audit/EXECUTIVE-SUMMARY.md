# Executive Summary — rabea.art Technical Audit

**Audit date:** 2026-07-20 · **Commit audited:** `ec8d610` · **Scope:** all 13 layers
**Deployment:** Vercel `prj_R538d9e1dVISeWWFL1X6azbbRcH5` → `www.rabea.art` (`fra1`/`iad1`)

---

## Layer Dashboard

| Layer | Status | Score | Critical | Warnings | Passed |
| ------------------------ | :----: | ----: | -------: | -------: | -----: |
| Frontend                 | ⚠️ WARNING  |  78/100 | 0 | 6 | 3 |
| API & Backend            | ⚠️ WARNING  |  85/100 | 0 | 5 | 6 |
| Database & Storage       | ⚠️ WARNING  |  64/100 | 1 | 10 | 2 |
| Auth & Permissions       | ⚠️ WARNING  |  84/100 | 0 | 3 | 6 |
| Hosting & Deployment     | ⚠️ WARNING  |  70/100 | 0 | 4 | 1 |
| Cloud & Compute          | ⚠️ WARNING  |  65/100 | 0 | 3 | 1 |
| CI/CD & Version Control  | ⚠️ WARNING  |  74/100 | 0 | 4 | 2 |
| Security & RLS           | ⚠️ WARNING  |  80/100 | 0 | 3 | 6 |
| Rate Limiting            | ⚠️ WARNING  |  62/100 | 0 | 4 | 0 |
| Caching & CDN            | ⚠️ WARNING  |  45/100 | 0 | 2 | 1 |
| Load Balancing & Scaling | ⚠️ WARNING  |  60/100 | 0 | 3 | 0 |
| Error Tracking & Logs    | ⚠️ WARNING  |  45/100 | 0 | 3 | 1 |
| Availability & Recovery  | ❌ CRITICAL |  25/100 | 2 | 2 | 0 |

**Overall system health:** ⚠️ **Application solid; data perimeter now closed, recovery still unproven**
**Overall production readiness:** ⚠️ **NOT YET — backups are the remaining blocker**

> **Update 2026-07-21 — SEC-01 CLOSED AND VERIFIED.** RLS is enabled on all 22 tables, confirmed
> by reading `pg_class.relrowsecurity` directly (22/22 `true`) rather than inferring it from an
> empty API response. With no policies defined this is deny-all for `anon`/`authenticated`, and
> `current_user` is `postgres`, so the application is unaffected. The single most serious finding
> in this audit is shut. **Backups (AVL-01/02) are now the top risk and the remaining launch
> blocker.**

- **Total PASS findings:** 19 (each with cited evidence)
- **Total WARNING findings:** 24
- **Total CRITICAL findings:** 5 — **2 now closed**, 3 open (AVL-01, AVL-02, DB-02)
- **Fixed:** 17

---

## How the scores are derived

These are **calibrated judgements, not a formula** — but they follow a consistent rubric, so a
score can be argued with rather than just accepted. Each layer starts at 100 and loses points per
finding by severity:

| Severity | Deduction | Rationale |
|---|---:|---|
| Critical | −25 to −35 | Can cause data loss, breach, or extended outage |
| High | −10 to −15 | Real exposure or failure mode, but bounded |
| Medium | −4 to −8 | Degrades security, performance or maintainability |
| Low | −1 to −3 | Worth fixing; no material risk today |
| Informational | 0 | Recorded for context only |

Three modifiers then apply:

- **Compensating controls reduce a deduction.** A finding whose blast radius is already limited by
  something else costs less. Example: `product-images` being a public bucket is normally a
  Medium — here it holds only public product photography and is never used for customer uploads,
  so it lands at the low end.
- **Verified strengths earn points back**, but only with cited evidence. Layer 2's 85 is not "few
  problems found" — it reflects positively confirmed properties like server-side price derivation
  and unique-constraint-backed idempotency.
- **Unverifiable items are scored as if unresolved.** Nothing gets credit for being *probably*
  fine. This is why Availability sits at 25 despite backups plausibly existing: absence of
  evidence is scored as absence.

**Worked example — Security & RLS, 45 → 80:**

```
100  start
−35  SEC-01: RLS disabled on all 22 tables (Critical)    → CLOSED 2026-07-21, restored
−12  SEC-02: no Content-Security-Policy (High)
 −6  SEC-03: 5 moderate transitive advisories (Medium)
 −2  X-Powered-By header leak (Low)                      → FIXED, restored
 = 45 at audit time  →  80 after SEC-01 and the header fix
```

The remaining 20 points are held back almost entirely by the missing CSP; it returns to the low
90s once that ships.

**Worked example — Availability & Recovery, 25:**

```
100  start
−35  AVL-01: no evidence backups exist (Critical)
−30  AVL-02: no restore ever tested (Critical)
−10  DB-02: rollback.sql drops all 22 tables, guarded only by a comment (High)
 = 25
```

Deliberately harsh. Two Criticals in one layer compound rather than average, because an untested
backup and a destructive unguarded script are the *same* failure waiting to happen. This is the
one layer where a single bad afternoon ends the business, and the score says so.

**Overall readiness is not an average of the layers.** A 64 in Database does not offset a 25 in
Availability — the verdict is gated by the weakest blocking item, which is why the recommendation
stays "NOT YET" even though ten of thirteen layers are amber or better.

---

## The single most important correction

**You told me the site is live and publicly accessible. It is not.** Every page is still behind
the coming-soon gate, verified against production:

```
GET https://www.rabea.art/            → 200, X-Matched-Path: /coming-soon
GET https://www.rabea.art/ar          → 200, <title>Rabea.art — قريبًا · Coming soon</title>
GET https://www.rabea.art/admin/login → 200, coming-soon content
```

This is good news — every critical finding below is a *pre-launch* problem rather than an active
breach — but it means the launch checklist has not actually been cleared yet.

**However, one thing genuinely was open to the internet.** The gate excluded `/api/**`, so while
every page said "coming soon", the public write endpoints were live:

```
POST https://www.rabea.art/api/orders       → 400 VALIDATION_FAILED   (live, accepting orders)
POST https://www.rabea.art/api/uploads/sign → 400 INVALID_FILE        (live, minting upload URLs)
```

Anyone who guessed the path could write rows into your production `orders` and `customers`
tables, and the 5-per-10-minutes brake was bypassable with a single spoofed header. **Both are
now fixed** — but you should check the `orders` table for junk rows created before today.

---

## Top five critical risks

1. **AVL-01 / AVL-02 — There is no evidence that backups exist, and no restore has ever been
   tested.** *(Now the top risk, following SEC-01's closure.)* The words "backup", "PITR" and "pg_dump" appear nowhere in the repository. The only
   recovery artifact in the codebase is `docs/rollback.sql`, which *drops every table*. A single
   bad migration or an accidental paste is currently unrecoverable.

2. **API-01 — The public API was reachable while the site presented as closed.** Fixed, but it
   means production data may already contain unsolicited submissions.

3. **LOG-01 — Nothing reports failures.** No error tracking, no alerting, no uptime monitoring.
   Two failures were silently invisible: a customer's order confirmation email failing, and the
   rate limiter *switching itself off* under database stress. Both now emit structured,
   alertable events, but nothing is yet listening.

4. **AUTH-01 — No application-level brute-force protection on admin login.** The `RateLimitBucket`
   schema even documents the intended `"login:<ip>"` key format, but no code ever writes it. Note
   this cannot be fully closed in application code: sign-in happens client-side against Supabase,
   whose auth endpoint stays publicly reachable with the anon key regardless. MFA is the stronger
   control here.

5. **SEC-01 — RLS. ✅ CLOSED AND VERIFIED 2026-07-21.** Retained here for the record: all 22
   tables report `relrowsecurity = true`. This was the audit's most serious finding.

---

## Top five recommended improvements

1. ~~Run `docs/rls-lockdown.sql`~~ — **done and verified.** Still worth removing `public` from
   Supabase's exposed schemas as defence-in-depth, so a table added later without RLS is not
   exposed the moment it exists.
2. **Enable PITR and perform one real restore into a scratch project.** Do not mark backups green
   until a restore has actually produced a working database.
3. **Add Sentry (or equivalent) and one uptime check.** `src/lib/log.ts` now emits structured
   JSON with stable event names and request-id correlation — the wiring point exists; it needs a DSN.
4. **Rate-limit the login endpoint** using the limiter that is already built and already keyed
   for it.
5. ~~Add foreign-key indexes.~~ **Migration written** (21 indexes,
   `prisma/migrations/20260721000000_add_missing_indexes/`) — paste it into the SQL Editor to apply.

---

## Immediate actions required (before removing the gate)

| # | Action | Owner | Blocking? |
|---|--------|-------|-----------|
| 1 | ~~Run `docs/rls-lockdown.sql`~~ | You | ✅ **DONE & VERIFIED** (22/22 `rls_enabled = true`) |
| 2 | Supabase → Settings → API → remove `public` from exposed schemas | You | Defence-in-depth |
| 3 | Confirm PITR / daily backups are enabled on the project's plan tier | You | **YES** |
| 4 | Perform one test restore and record how long it took (this becomes your real RTO) | You | **YES** |
| 5 | Audit the `orders`/`customers` tables for junk created via the pre-fix open API | You | **YES** |
| 6 | Enable GitHub branch protection with the CI checks required on `main` | You | Strongly advised |
| 7 | Deploy this branch, then re-probe: public API must return 503 while gated | You | Strongly advised |
| 8 | Confirm `order-uploads` is a **private** bucket and `product-images` public | You | Strongly advised |
| 9 | Apply `prisma/migrations/20260721000000_add_missing_indexes/migration.sql` | You | Performance only |
| 10 | Run `docs/seed.sql` — the catalog is empty, so `/shop` renders nothing and `settings` (WhatsApp, contact email) is unpopulated | You | **YES, before launch** |
| 11 | Confirm Vercel's `NEXT_PUBLIC_SUPABASE_URL` points at the project you hardened — more than one Supabase project exists on this account | You | **YES** |

---

## Final launch recommendation

### ⚠️ NOT YET — *but the blocking list is now three items, not five*

**What changed on 2026-07-21:** the database's outer door is shut. RLS is enabled and verified on
all 22 tables, the public API is closed while the gate is up, and both were confirmed against the
real environment rather than assumed. That was the audit's most serious finding and it is done.

This verdict is about the **perimeter, not the code**. The application itself is materially
better built than most projects at this stage: authorization is enforced on every single admin
route and re-checked against the database on every request; order pricing is structurally immune
to client tampering; idempotency is backed by a real unique constraint; the cron endpoint uses a
constant-time secret comparison; no secret has ever been committed, verified across the full git
history. Those are not small things and they are genuinely done right.

What remains is **recovery and visibility**: there is still no proven way back from data loss, and
nothing tells you when something breaks.

**Remaining launch blockers:**

1. **Backups (AVL-01/02)** — confirm PITR is on, then actually perform one restore and time it.
   An untested backup is a hypothesis. This is now the single largest risk to the business.
2. **Seed the catalog** — `products` is empty, so `/shop` would render nothing and `settings`
   (WhatsApp number, contact email) is unpopulated.
3. **Confirm production points at the hardened project** — this account has more than one Supabase
   project, and that mismatch fails silently.

Everything else on the list is *strongly advised* rather than blocking. Once backups are proven,
this moves to **Ready with warnings**.

**Items 1–5 are a few hours of dashboard work, not an engineering project.** Once RLS is
confirmed closed and a restore has actually been performed, this moves to **Ready with warnings**
— the remaining 24 warnings are real but none of them should block a launch of this size.

Do not remove `COMING_SOON` until items 1–5 are done.
