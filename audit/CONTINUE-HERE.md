# Continuation Prompt — rabea.art

Copy everything below the line into a fresh Claude Code session on any device.
Last updated: 2026-07-21 (session 2).

---

I'm continuing work on rabea.art — Next.js 16 + Prisma 7 + Supabase + Vercel, Arabic-first RTL
storefront with a role-gated admin. A full 13-layer security/reliability audit is complete.

**Read `audit/EXECUTIVE-SUMMARY.md` and `audit/REMEDIATION-ROADMAP.md` first. Do not redo the
audit.** All work is on `main` and pushed.

## Current scores (derivation is in EXECUTIVE-SUMMARY.md)

Frontend 86 · API 85 · Database 64 · Auth 84 · Hosting 70 · Cloud 65 · CI/CD 74 · Security 80 ·
Rate Limiting 62 · Caching 68 · Scaling 60 · **Error Tracking 45** · Availability 66

Verdict: **not yet ready to remove the coming-soon gate** — but the remaining blockers are content
and configuration, not security.

## Closed and verified this session

- **SEC-01 RLS** — enabled on all 22 tables, verified by reading `pg_class.relrowsecurity`
  directly (22/22 true). `public` was also removed from Supabase's exposed schemas, so PostgREST
  cannot reach the schema at all. Two independent locks.
- **AVL-01 backups** — Supabase Pro, daily automatic, two snapshots confirmed in the dashboard.
- **API-01** — the coming-soon gate excluded `/api/**`, so public write endpoints were live to the
  internet while every page said "coming soon". Fixed; 15 tests guard it.
- **RL-01** — the rate-limit client IP came from the first `x-forwarded-for` hop, i.e. fully
  spoofable. Now `src/lib/client-ip.ts`, 14 tests.
- **Admin redirect loop** — a valid session with no matching `admin_users` row threw 403, which
  redirected to login, which bounced back. Infinite, with a blank page and no error. Now
  401 → login, 403 → `/admin/no-access`.
- **Settings were decorative** — the storefront rendered hardcoded contact details and ignored the
  announcement bar entirely, so saving in admin changed nothing a visitor could see. Both wired.
- Also: PERF-01 (shop no longer loads the whole catalogue per hit), CACHE-01 (catalog caching with
  tag invalidation), robots.txt + sitemap.xml + Product JSON-LD, 21 missing DB indexes,
  `rollback.sql` arm-before-use guard, structured logging, CI hardening.

## Remaining blockers — all manual

1. **Add products.** Admin works now; catalog lookup data is seeded, real products are not.
2. **Email doesn't send.** A test order succeeded but no confirmation arrived. Deferred by the
   user pending a conversation with the page owner. Diagnose with:
   `SELECT at, "to", template, status, error FROM email_logs ORDER BY at DESC LIMIT 10;`
   Likely `RESEND_API_KEY` / `EMAIL_FROM` unset, or an unverified Resend domain. The order itself
   still succeeds by design — email failure never rolls back an order.
3. **`NEXT_PUBLIC_SITE_URL` is `https://rabea.art`** but the site serves from `www.rabea.art`
   (apex 308-redirects), so every sitemap URL redirects. Pick one canonical domain.
4. **`PREVIEW_KEY` is `rabea-studio-8f3k2n9x4q7w`** — an example string published in chat. Change
   it before launch.
5. **AVL-02 — no restore has ever been tested.** See below.

## AVL-02 — the one genuinely open availability item

Backups exist and run daily. Nobody has ever restored one. Two paths:

- **Rebuild drill** (dashboard only, ~20 min): create a scratch Supabase project; paste
  `prisma/migrations/0_init/migration.sql`, then `add_missing_indexes/migration.sql`, then
  `docs/seed.sql`, then `docs/rls-lockdown.sql`, then `docs/verify-restore.sql`. Time it. Proves
  the recovery artifacts are valid. Would move Availability 66 → ~76.
- **Restore drill** (needs tooling and the DB password): `pg_dump` production → load into a
  scratch project → run `docs/verify-restore.sql`. This is what truly closes AVL-02.

**Do NOT click "Restore" on the Supabase Backups page** — it restores in place over production.

Expect the restore drill to reveal that **RLS does not survive into a fresh project**. That is the
most valuable thing it will teach; if confirmed, add re-running `docs/rls-lockdown.sql` to the
recovery procedure.

A local-Postgres rebuild drill was attempted (`embedded-postgres` npm package — real Postgres, no
Docker) and did not finish: `initdb` took over ten minutes on that machine. The approach is sound
and worth retrying elsewhere. One real finding came out of it anyway: **the database must be
UTF-8.** A default Windows install selected WIN1255, which cannot store Arabic — the schema loads
cleanly and the seed silently mangles content.

## Suggested next work

- **Error Tracking is the lowest layer at 45.** Nothing reports failures, which is exactly why the
  email problem stayed invisible until a manual test. `src/lib/log.ts` already emits structured
  events (`order.email.failed`, `ratelimit.fail_open`, `cron.cleanup.*`) with request-id
  correlation; it needs a Sentry DSN from the user and forwarding wired into `emit()`.
- **1.8 — customer erasure path.** `Customer` has no soft-delete and no delete action, and
  `orders.customerId` is `ON DELETE RESTRICT`, so a data-erasure request has no implementation.
  Worth doing before holding real customer data.
- **AUTH-01 — login rate limiting.** Caveat: sign-in happens client-side against Supabase, whose
  auth endpoint stays publicly reachable with the anon key regardless, so app-side limiting is
  partial. MFA is the stronger control.
- **CACHE-02 is BLOCKED** — read the roadmap entry before attempting. `force-static` does
  prerender the content pages but silently breaks the English locale: the root layout resolves
  locale via `getLocale()`, which has no request context during static generation, so `/en` pages
  emit `<html lang="ar" dir="rtl">`. A passing build is not evidence here — grep the emitted HTML.

## Verification

`npm run lint && npm run typecheck && npm run test && npm run build`

Baseline to beat: lint **0 errors** (1 pre-existing warning at `ProductForm.tsx:85`, React
Compiler + RHF `watch()`), typecheck clean, **348 tests**, build compiles. `npx playwright test`
shows ~5 local failures from parallelism on Windows — pre-existing, they pass with `--workers=1`,
and CI pins `workers: 1`. Don't chase them. `npm audit` reports 5 moderate transitives only
fixable by downgrading `next`; accepted, CI gates at `--audit-level=high`.

## Ground rules

- **Multiple sessions edit this repo concurrently.** Storefront-redesign and test workstreams have
  been pushing to `main` all day. Run `git status` and check file mtimes before editing; don't
  modify files you didn't create if they're actively changing. Expect push races — pull and retry.
- Don't mark anything PASS without a cited `file:line` or command output. If you can't verify it,
  say so plainly.
- Don't touch the production database, and don't ask the user to paste production credentials into
  chat.
- The user works entirely through the Supabase dashboard and **cannot open local files** — give
  SQL inline in chat, and point at GitHub's Raw view for repo files.
- Read `AGENTS.md`. This is Next.js 16 with breaking changes from training data: `src/proxy.ts`
  not `middleware.ts`; `revalidateTag` takes two arguments; `use cache` requires
  `cacheComponents: true`. Check `node_modules/next/dist/docs/` before writing routing, caching or
  middleware code.
