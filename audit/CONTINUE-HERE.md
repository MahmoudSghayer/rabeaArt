# Continuation Prompt — rabea.art audit follow-up

Copy everything below the line into a fresh Claude Code session on any device.

---

I'm continuing a security/reliability audit of rabea.art (Next.js 16 + Prisma 7 + Supabase +
Vercel, Arabic-first RTL storefront with a role-gated admin).

## Where things stand

A full 13-layer audit is already done. Read `audit/EXECUTIVE-SUMMARY.md` and
`audit/REMEDIATION-ROADMAP.md` first — do not redo the audit, it's complete and evidence-backed.

Work lives on branch `audit/security-hardening` (pushed to origin), two commits:
- `82cd12e` — 14 security/reliability fixes
- `af36324` — the ten audit reports under `audit/`

That branch also contains two commits from a parallel session (`4224c8d` texture system,
`712ce05` motion fixes) because both sessions shared one working tree. **Check whether `main` has
moved and rebase if needed before merging.**

Result of the audit: **5 CRITICAL, 24 WARNING, 19 PASS, 14 fixed.**
Verdict: NOT ready to remove the `COMING_SOON` gate until the Phase 0 items below are done.

## Two facts that are easy to get wrong

1. **The site is NOT publicly live.** Every page serves `/coming-soon` (verified:
   `curl -sSI https://www.rabea.art/` → `X-Matched-Path: /coming-soon`). The critical findings are
   pre-launch problems, not an active breach.
2. **The local `.env` is entirely placeholders** (`NEXT_PUBLIC_SUPABASE_URL=https://placeholder-project.supabase.co`,
   `DATABASE_URL` pointing at localhost). So no live database, storage or dashboard check is
   possible from the repo. Anything needing console access must stay marked UNVERIFIED — do not
   assume it passes.

## What I need next, in priority order

### Phase 0 — launch blockers (mostly my manual work; tell me if I've done them)
1. `docs/rls-lockdown.sql` is written but **not applied**. RLS is disabled on all 22 tables, and
   the anon key ships publicly in the `/admin/login` bundle. Ask me whether I've run it and
   whether I removed `public` from Supabase's exposed schemas.
2. Backups: nothing in the repo mentions backups or PITR, and no restore has ever been tested.
   Ask me for evidence before treating this as resolved.
3. The public API was open to the internet before commit `82cd12e`. Help me write SQL to identify
   junk rows in `orders`/`customers` created before that fix.

### Phase 1 — code work I want you to do
Pick up from `audit/REMEDIATION-ROADMAP.md`. In order:
1. **1.2** — rate-limit `/admin/login`. The limiter exists and `prisma/schema.prisma:439` already
   documents the intended `login:<ip>` key format; it was planned and never wired. Depends on the
   `src/lib/client-ip.ts` fix already landed.
2. **1.4** — raise `updateFinalPriceAction` and `updateOrderPayAction` from `requireRole(STAFF)` to
   `ADMIN`. STAFF is the default role for every new invitee and currently has financial authority.
3. **3.1** — one migration adding the missing foreign-key indexes. The schema has **zero** FK
   indexes; the full list and the queries each serves are in `audit/PERFORMANCE-SCALING.md`.
4. **1.7** — `order_ref_seq` exists only in raw migration SQL, invisible to `schema.prisma`. A
   `prisma db push` silently produces a database where order submission fails. Move it into a
   tracked migration.
5. **3.2** — caching. Nothing is prerendered; about/contact/legal have zero dynamic inputs and are
   SSR'd per request. The `revalidatePath` invalidation half already exists at ~30 sites.

### Deliberately deferred, don't start unless I ask
CSP (roadmap 1.9 — needs nonce plumbing through `src/proxy.ts`, which composes three middleware
branches; ship Report-Only first). Sentry (needs a DSN from me; `src/lib/log.ts` already emits
structured events and `emit()` is the single forwarding point).

## How to verify

`npm run lint && npm run typecheck && npm run test && npm run build`

Baseline to beat: lint 0 errors (1 pre-existing warning in `ProductForm.tsx:85`, React Compiler +
RHF `watch()`), typecheck clean, **334 tests passing across 22 files**, build compiles 36 routes.

`npx playwright test` gives 88 passed / 29 skipped / 5 failed locally. Those 5 failures are
**pre-existing local flakiness, not a regression** — `fullyParallel: true` with unbounded workers
against one `next start` on Windows. They pass with `--workers=1`, and CI already pins
`workers: 1`. Don't chase them.

`npm audit` reports 5 moderate transitives (postcss via `next`, `@hono/node-server` via
`@prisma/dev`). Only fixable by downgrading `next`; accepted, CI gates at `--audit-level=high`.

## Working agreements

- **Another session may be editing this repo concurrently.** It has already committed a texture
  system and motion fixes mid-audit. Before editing, run `git status` and check file mtimes; do
  not modify files you didn't create if they're actively changing.
- Don't mark anything PASS without a cited `file:line` or command output. If you can't verify it,
  say so.
- Don't touch the production database, and don't apply `docs/rls-lockdown.sql` yourself.
- Read `AGENTS.md` — this is Next.js 16 with breaking changes from training data
  (`src/proxy.ts`, not `middleware.ts`). Check `node_modules/next/dist/docs/` before writing
  routing or middleware code.
