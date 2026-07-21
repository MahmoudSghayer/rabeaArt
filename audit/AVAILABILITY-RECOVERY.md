# Availability & Recovery — rabea.art

**Layer status: ❌ CRITICAL — 25/100**

This is the weakest layer in the system, and the gap is not subtle: **there is no evidence that
backups exist, and no restore has ever been performed.**

---

## Backup status

| Asset | Backup configured? | Evidence | Status |
|---|---|---|---|
| Postgres database | **UNKNOWN** | The strings "backup", "PITR", "point-in-time" and "pg_dump" appear **nowhere** in `docs/`, `prisma/`, `scripts/` or `README.md` | ❌ UNVERIFIED |
| Supabase Storage (`order-uploads`) | **UNKNOWN** | No backup or replication mentioned anywhere | ❌ UNVERIFIED |
| Supabase Storage (`product-images`) | **UNKNOWN** | Same | ❌ UNVERIFIED |
| Supabase Auth users | **UNKNOWN** | Same | ❌ UNVERIFIED |
| Source code | ✅ Yes | GitHub, 21 commits, full history intact | ✅ PASS |
| Environment variables | **UNKNOWN** | Held only in Vercel; no documented export | ⚠️ WARNING |

**Per the audit rules, none of these can be marked PASS.** Supabase's automatic daily backups are
not available on the Free tier, and nothing in the repository records which tier this project is
on. This must be confirmed in the dashboard.

### The only recovery artifact in the repository destroys data

`docs/rollback.sql` (84 lines) is a `DROP TABLE … CASCADE` across all 22 tables plus every enum
and `order_ref_seq`. It is correctly labelled — "DESTRUCTIVE for Rabea.art data … do NOT run this
against the real Rabea.art database" (`:12-14`) — but **a comment is not a guard.** Nothing
prevents it running against production. Given the documented operating model is "paste SQL into
the Supabase editor", the distance between a routine task and total data loss is one wrong tab.

**Recommended:** add a guard clause at the top that aborts unless an explicit confirmation
variable is set, e.g.

```sql
DO $$ BEGIN
  IF current_setting('rabea.i_really_mean_it', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'Refusing to run: set rabea.i_really_mean_it = yes first';
  END IF;
END $$;
```

## Recovery risks

| # | Risk | Impact | Likelihood | Mitigation status |
|---|---|---|---|---|
| 1 | Database loss with no working backup | **Total, permanent** — every order, customer and audit record | Low | ❌ None verified |
| 2 | `rollback.sql` run against production | **Total, permanent** | Low but non-trivial given the manual SQL workflow | ❌ No guard |
| 3 | `prisma db push` drops `order_ref_seq` | Order submission fails entirely (`submit.ts:357`) | Medium — a plausible developer action | ❌ None; Prisma cannot warn |
| 4 | Storage loss | Customer reference photos gone; orders survive but become unfulfillable | Low | ❌ None verified |
| 5 | Supabase regional outage | Full outage — DB, auth and storage share one project | Low | ❌ No degradation path |
| 6 | Resend outage | Confirmations silently lost; orders unaffected | Medium | ⚠️ Partial — now logged as `order.email.failed`, no retry |
| 7 | Vercel outage | Full site outage | Low | Accepted |
| 8 | Bad deploy | Broken site until noticed | Medium | ✅ Vercel instant rollback |
| 9 | Domain/DNS loss | Full outage | Very low | ❌ No documented recovery |
| 10 | Secret leak requiring rotation | Downtime during rotation | Low | ❌ No rotation runbook |

**Risk 3 deserves emphasis.** `order_ref_seq` and the `stock >= 0` CHECK exist only in raw
migration SQL (`migration.sql:465-471`) and are invisible to `schema.prisma`. Prisma models
neither sequences nor CHECKs, so it will never warn. A developer running `prisma db push` — an
entirely ordinary thing to do — produces a database where **order submission fails**, with no
error at push time.

## Recovery objectives

No RTO or RPO has ever been defined. Proposed, calibrated to a single studio rather than an
enterprise:

| Scenario | RTO (target) | RPO (target) | Achievable today? |
|---|---|---|---|
| Bad deploy | 5 min | 0 | ✅ Yes — Vercel rollback |
| Accidental data deletion (single order) | 1 hour | 0 | ❌ No — requires PITR |
| Full database loss | 4 hours | 24 hours | ❌ **No — no verified backup** |
| Storage loss | 24 hours | 24 hours | ❌ No |
| Supabase regional outage | 24 hours | Provider-dependent | ❌ No |
| Domain/DNS loss | 24 hours | 0 | ⚠️ Registrar-dependent, undocumented |

**Every data-loss row is currently unachievable.** These become real targets only after PITR is
confirmed *and* a restore has actually been performed and timed.

### Recommended backup policy

| Setting | Recommendation | Rationale |
|---|---|---|
| Database backups | Daily automatic + **PITR enabled** | Requires Supabase Pro; the cost is small against total data loss |
| Retention | 7 days PITR, 30 days daily | Enough to catch a slow-noticed corruption |
| Storage | Weekly scripted copy of both buckets to independent object storage | Supabase does not version storage objects |
| Auth users | Monthly export | Small, and painful to reconstruct |
| Env vars | Encrypted copy in a password manager | Not held anywhere but Vercel today |
| Restore test | **Quarterly**, into a scratch project | An untested backup is a hypothesis |

## Restore process (to be validated, not assumed)

1. Create a scratch Supabase project in the same region.
2. Restore the most recent backup / PITR snapshot into it.
3. Verify row counts against expectation:
   ```sql
   SELECT 'orders', count(*) FROM orders
   UNION ALL SELECT 'customers', count(*) FROM customers
   UNION ALL SELECT 'order_items', count(*) FROM order_items
   UNION ALL SELECT 'admin_users', count(*) FROM admin_users;
   ```
4. **Confirm `order_ref_seq` survived and is ahead of the highest existing ref** — this is the
   step most likely to be missed:
   ```sql
   SELECT last_value FROM order_ref_seq;
   SELECT max(ref) FROM orders;
   ```
5. Point a preview deployment at the restored database; submit a test order end-to-end.
6. **Record the wall-clock time taken. That number is your real RTO** — replace the target above
   with it.

## Rollback process

**Application (works today):** Vercel Dashboard → Deployments → previous → *Promote to Production*.
Instant, and the build artifact already exists. ✅

**Database:** there is no migration rollback path at all. Schema changes are applied by pasting
SQL by hand, there is no `_prisma_migrations` bookkeeping in the target database, and no `down`
migrations exist. Any schema change is currently one-way.

**Recommended:** baseline `_prisma_migrations`, adopt `prisma migrate deploy`, and require every
migration to ship with a tested reverse script before it is applied to production.

## Third-party outage handling

| Service | Current behaviour | Assessment |
|---|---|---|
| Supabase Postgres | Admin pages catch and render designed failure states; storefront degrades to empty states | ⚠️ Graceful for reads; **all writes fail** |
| Supabase Auth | Admin cannot log in; storefront unaffected | ✅ Correctly isolated |
| Supabase Storage | Uploads fail; order submission still succeeds without files | ✅ Good degradation |
| Resend | Order succeeds, email silently lost | ⚠️ **No retry, no dead-letter** — now at least logged |
| Vercel Cron | Silent failure; storage grows unbounded | ❌ No alerting |

**The weakest link is Resend.** `sendOrderNotification` never throws and logs to `EmailLog`, which
is the right shape — but there is no retry, no queue, and until this audit no alertable signal.
A customer whose confirmation fails simply never hears from you. `EmailLog` already records
`status: "failed"`, so a daily check of that table is a cheap interim control.

## Incident-response checklist

### Detection
1. **Today there is effectively none** — no uptime monitoring, no error tracking, no alerting.
   Discovery is by customer complaint. This is the single highest-value gap to close.
2. Interim manual checks: `EmailLog` where `status='failed'`; Vercel function logs; Supabase
   dashboard health.

### Response
1. **Assess scope** — is it the site (Vercel), the data (Supabase), or a dependency (Resend)?
2. **Check provider status pages** before debugging your own code.
3. **If a bad deploy:** promote the previous deployment immediately. Diagnose afterwards.
4. **If data corruption:** stop writes first — set `COMING_SOON=1` to close the storefront, which
   (post-fix) now also closes the public API. Then assess before restoring.
5. **If a secret leak:** rotate in Supabase/Resend/Vercel, redeploy, then audit `AuditLog` for the
   exposure window.
6. **Communicate** — the studio's customers reach you by WhatsApp; a holding message beats silence.

### Recovery
1. Restore or roll back per the processes above.
2. Verify with the row-count and sequence checks.
3. Submit one end-to-end test order before reopening.
4. Set `COMING_SOON=0` to reopen.

### Post-incident
1. Write it up: timeline, cause, what detection *should* have caught it.
2. Add the missing detection.
3. Add a regression test — this codebase has 323 unit tests and a working E2E suite, so there is
   somewhere good to put it.

## Disaster-recovery checklist

- [ ] **Confirm the Supabase plan tier supports backups** (Free does not)
- [ ] **Enable PITR**
- [ ] **Perform one full restore into a scratch project and record the elapsed time**
- [ ] Verify `order_ref_seq` survives a restore
- [ ] Script and schedule a storage backup for both buckets
- [ ] Export Supabase Auth users
- [ ] Store env vars in a password manager, outside Vercel
- [ ] Add the guard clause to `docs/rollback.sql`
- [ ] Move `order_ref_seq` into a tracked migration so `db push` cannot drop it
- [ ] Set up uptime monitoring on `/` and `/api/orders`
- [ ] Wire a Sentry DSN into the structured events `src/lib/log.ts` now emits
- [ ] Document registrar and DNS recovery steps
- [ ] Write a secret-rotation runbook
- [ ] Schedule the next restore test (quarterly)
