# Executive Summary — rabea.art Technical Audit

**Audit date:** 2026-07-20 · **Commit audited:** `ec8d610` · **Scope:** all 13 layers
**Deployment:** Vercel `prj_R538d9e1dVISeWWFL1X6azbbRcH5` → `www.rabea.art` (`fra1`/`iad1`)

---

## Layer Dashboard

| Layer | Status | Score | Critical | Warnings | Passed |
| ------------------------ | :----: | ----: | -------: | -------: | -----: |
| Frontend                 | ⚠️ WARNING  |  78/100 | 0 | 6 | 3 |
| API & Backend            | ⚠️ WARNING  |  85/100 | 0 | 5 | 6 |
| Database & Storage       | ❌ CRITICAL |  48/100 | 2 | 10 | 1 |
| Auth & Permissions       | ⚠️ WARNING  |  80/100 | 0 | 4 | 5 |
| Hosting & Deployment     | ⚠️ WARNING  |  70/100 | 0 | 4 | 1 |
| Cloud & Compute          | ⚠️ WARNING  |  65/100 | 0 | 3 | 1 |
| CI/CD & Version Control  | ⚠️ WARNING  |  74/100 | 0 | 4 | 2 |
| Security & RLS           | ❌ CRITICAL |  45/100 | 1 | 3 | 5 |
| Rate Limiting            | ⚠️ WARNING  |  62/100 | 0 | 4 | 0 |
| Caching & CDN            | ⚠️ WARNING  |  45/100 | 0 | 2 | 1 |
| Load Balancing & Scaling | ⚠️ WARNING  |  60/100 | 0 | 3 | 0 |
| Error Tracking & Logs    | ⚠️ WARNING  |  45/100 | 0 | 3 | 1 |
| Availability & Recovery  | ❌ CRITICAL |  25/100 | 2 | 2 | 0 |

**Overall system health:** ⚠️ **Application solid, operational perimeter unproven**
**Overall production readiness:** ❌ **NOT READY TO REMOVE THE COMING-SOON GATE**

- **Total PASS findings:** 19 (each with cited evidence)
- **Total WARNING findings:** 24
- **Total CRITICAL findings:** 5
- **Fixed during this audit:** 14

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

1. **SEC-01 — Row-Level Security is disabled on all 22 tables.** The Supabase anon key is public
   by construction; it ships in the `/admin/login` JavaScript bundle. If the Data API is enabled
   while RLS is off, then the moment you launch, `GET /rest/v1/customers` with that key returns
   every customer name, phone, WhatsApp number, email and street address. Today this is masked
   only because the gate suppresses the login bundle. **`docs/rls-lockdown.sql` is written and
   ready; it must be run by you.**

2. **AVL-01 / AVL-02 — There is no evidence that backups exist, and no restore has ever been
   tested.** The words "backup", "PITR" and "pg_dump" appear nowhere in the repository. The only
   recovery artifact in the codebase is `docs/rollback.sql`, which *drops every table*. A single
   bad migration or an accidental paste is currently unrecoverable.

3. **API-01 — The public API was reachable while the site presented as closed.** Fixed, but it
   means production data may already contain unsolicited submissions.

4. **LOG-01 — Nothing reports failures.** No error tracking, no alerting, no uptime monitoring.
   Two failures were silently invisible: a customer's order confirmation email failing, and the
   rate limiter *switching itself off* under database stress. Both now emit structured,
   alertable events, but nothing is yet listening.

5. **AUTH-01 — No application-level brute-force protection on admin login.** The `RateLimitBucket`
   schema even documents the intended `"login:<ip>"` key format, but no code ever writes it. The
   sole defence is Supabase's project-wide limit.

---

## Top five recommended improvements

1. **Run `docs/rls-lockdown.sql` and remove `public` from Supabase's exposed schemas.** Either
   alone closes SEC-01; do both. ~10 minutes, and it is the difference between a launch and a
   disclosure.
2. **Enable PITR and perform one real restore into a scratch project.** Do not mark backups green
   until a restore has actually produced a working database.
3. **Add Sentry (or equivalent) and one uptime check.** `src/lib/log.ts` now emits structured
   JSON with stable event names and request-id correlation — the wiring point exists; it needs a DSN.
4. **Rate-limit the login endpoint** using the limiter that is already built and already keyed
   for it.
5. **Add foreign-key indexes.** The schema has *zero*. This is invisible at 12 products and
   painful at 5,000 orders; adding them before the data grows is far cheaper than after.

---

## Immediate actions required (before removing the gate)

| # | Action | Owner | Blocking? |
|---|--------|-------|-----------|
| 1 | Run `docs/rls-lockdown.sql` in the Supabase SQL Editor; confirm all 22 report `rls_enabled = true` | You | **YES** |
| 2 | Supabase → Settings → API → remove `public` from exposed schemas | You | **YES** |
| 3 | Confirm PITR / daily backups are enabled on the project's plan tier | You | **YES** |
| 4 | Perform one test restore and record how long it took (this becomes your real RTO) | You | **YES** |
| 5 | Audit the `orders`/`customers` tables for junk created via the pre-fix open API | You | **YES** |
| 6 | Enable GitHub branch protection with the CI checks required on `main` | You | Strongly advised |
| 7 | Deploy this branch, then re-probe: public API must return 503 while gated | You | Strongly advised |
| 8 | Confirm `order-uploads` is a **private** bucket and `product-images` public | You | Strongly advised |

---

## Final launch recommendation

### ❌ NOT READY FOR PRODUCTION — *pending items 1–5 above*

This verdict is about the **perimeter, not the code**. The application itself is materially
better built than most projects at this stage: authorization is enforced on every single admin
route and re-checked against the database on every request; order pricing is structurally immune
to client tampering; idempotency is backed by a real unique constraint; the cron endpoint uses a
constant-time secret comparison; no secret has ever been committed, verified across the full git
history. Those are not small things and they are genuinely done right.

What is missing is everything *around* the code: the database's outer door is unlocked, nobody is
watching for failures, and there is no proven way back from data loss.

**Items 1–5 are a few hours of dashboard work, not an engineering project.** Once RLS is
confirmed closed and a restore has actually been performed, this moves to **Ready with warnings**
— the remaining 24 warnings are real but none of them should block a launch of this size.

Do not remove `COMING_SOON` until items 1–5 are done.
