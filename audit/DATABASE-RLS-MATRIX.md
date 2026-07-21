# Database RLS Matrix — rabea.art

## Current state: RLS is disabled on every table

Verified by exhaustive search — `grep -rniE "row level security|enable rls|create policy"` across
`prisma/`, `docs/`, `migration.sql`, `scripts/` and `README.md` returns **zero matches**. There is
no RLS SQL anywhere in the repository, and `prisma/migrations/0_init/migration.sql` contains no
`ALTER TABLE … ENABLE ROW LEVEL SECURITY`.

### Why this is CRITICAL rather than acceptable

`docs/SETUP-SUPABASE.md:37-42` argues RLS is unnecessary because "the app never talks to Storage
from the browser". That premise is **true** — I verified it: `createSupabaseBrowserClient` has
exactly one call site, `LoginForm.tsx:44`, and it only calls `signInWithPassword`. Prisma connects
as `postgres` and bypasses RLS regardless.

But the conclusion does not follow. RLS does not protect against *this application* — it protects
against *anyone holding the anon key*, and the anon key is public by construction: it is inlined
into the JavaScript bundle served at `/admin/login`. With RLS off and the Data API enabled:

```bash
curl 'https://<project-ref>.supabase.co/rest/v1/customers?select=*' \
     -H "apikey: <anon key lifted from the page source>"
```

returns every customer name, phone, WhatsApp number, email and full street address. Supabase's own
linter reports this as "RLS disabled in public" for precisely this reason.

**Currently masked, not fixed.** The coming-soon gate suppresses the `/admin/login` bundle, so the
anon key is not presently published. That protection disappears the instant `COMING_SOON=0`.

**Could not be verified from the codebase:** whether the Data API is enabled for the `public`
schema in this specific project. If it has been disabled in the dashboard, the exposure is already
closed and the SQL below is defence-in-depth. **This must be checked manually** —
Supabase → Settings → API → Exposed schemas.

---

## Matrix — current state (all 22 tables)

`anon` / `authenticated` = the roles PostgREST uses. `service_role` and `postgres` bypass RLS
always. "App path" is how the application itself reaches the table.

| Table | RLS Enabled | Select Policy | Insert Policy | Update Policy | Delete Policy | Ownership Check | Admin Access | Status |
|-------|-------------|---------------|---------------|---------------|---------------|-----------------|--------------|--------|
| `admin_users` | ❌ No | anon: **ALL** | anon: **ALL** | anon: **ALL** | anon: **ALL** | None | `requireRole(OWNER)` in app | ❌ CRITICAL |
| `customers` | ❌ No | anon: **ALL** | anon: **ALL** | anon: **ALL** | anon: **ALL** | None | `requireRole(STAFF)` in app | ❌ CRITICAL |
| `orders` | ❌ No | anon: **ALL** | anon: **ALL** | anon: **ALL** | anon: **ALL** | None | `requireRole(STAFF)` in app | ❌ CRITICAL |
| `order_items` | ❌ No | anon: **ALL** | anon: **ALL** | anon: **ALL** | anon: **ALL** | None | `requireRole(STAFF)` in app | ❌ CRITICAL |
| `order_files` | ❌ No | anon: **ALL** | anon: **ALL** | anon: **ALL** | anon: **ALL** | None | `requireRole(STAFF)` in app | ❌ CRITICAL |
| `order_status_history` | ❌ No | anon: **ALL** | anon: **ALL** | anon: **ALL** | anon: **ALL** | None | `requireRole(STAFF)` in app | ❌ CRITICAL |
| `communication_logs` | ❌ No | anon: **ALL** | anon: **ALL** | anon: **ALL** | anon: **ALL** | None | `requireRole(STAFF)` in app | ❌ CRITICAL |
| `audit_logs` | ❌ No | anon: **ALL** | anon: **ALL** | anon: **ALL** | anon: **ALL** | None | app writes only | ❌ CRITICAL |
| `email_logs` | ❌ No | anon: **ALL** | anon: **ALL** | anon: **ALL** | anon: **ALL** | None | app writes only | ❌ CRITICAL |
| `settings` | ❌ No | anon: **ALL** | anon: **ALL** | anon: **ALL** | anon: **ALL** | None | `requireRole(ADMIN)` in app | ❌ CRITICAL |
| `rate_limit_buckets` | ❌ No | anon: **ALL** | anon: **ALL** | anon: **ALL** | anon: **ALL** | None | app only | ❌ CRITICAL |
| `products` | ❌ No | anon: **ALL** | anon: **ALL** | anon: **ALL** | anon: **ALL** | None | `requireRole(ADMIN)` in app | ⚠️ WARNING |
| `product_images` | ❌ No | anon: **ALL** | anon: **ALL** | anon: **ALL** | anon: **ALL** | None | `requireRole(ADMIN)` in app | ⚠️ WARNING |
| `product_variants` | ❌ No | anon: **ALL** | anon: **ALL** | anon: **ALL** | anon: **ALL** | None | `requireRole(ADMIN)` in app | ⚠️ WARNING |
| `product_colors` | ❌ No | anon: **ALL** | anon: **ALL** | anon: **ALL** | anon: **ALL** | None | `requireRole(ADMIN)` in app | ⚠️ WARNING |
| `product_sizes` | ❌ No | anon: **ALL** | anon: **ALL** | anon: **ALL** | anon: **ALL** | None | `requireRole(ADMIN)` in app | ⚠️ WARNING |
| `categories` | ❌ No | anon: **ALL** | anon: **ALL** | anon: **ALL** | anon: **ALL** | None | `requireRole(ADMIN)` in app | ⚠️ WARNING |
| `colors` | ❌ No | anon: **ALL** | anon: **ALL** | anon: **ALL** | anon: **ALL** | None | `requireRole(ADMIN)` in app | ⚠️ WARNING |
| `sizes` | ❌ No | anon: **ALL** | anon: **ALL** | anon: **ALL** | anon: **ALL** | None | `requireRole(ADMIN)` in app | ⚠️ WARNING |
| `frames` | ❌ No | anon: **ALL** | anon: **ALL** | anon: **ALL** | anon: **ALL** | None | `requireRole(ADMIN)` in app | ⚠️ WARNING |
| `materials` | ❌ No | anon: **ALL** | anon: **ALL** | anon: **ALL** | anon: **ALL** | None | `requireRole(ADMIN)` in app | ⚠️ WARNING |
| `production_methods` | ❌ No | anon: **ALL** | anon: **ALL** | anon: **ALL** | anon: **ALL** | None | `requireRole(ADMIN)` in app | ⚠️ WARNING |

**Severity split:** the first 11 hold PII, credentials-adjacent identity, audit trails or
operational state — unauthenticated read *or write* access to any of them is CRITICAL. The
catalog tables are WARNING rather than CRITICAL because their contents are already public by
intent (they render on the storefront) — but **write** access is not, and an anonymous `UPDATE` on
`products` or `product_variants` would let an attacker rewrite prices and stock.

---

## Target state after `docs/rls-lockdown.sql`

| Table | RLS Enabled | Select | Insert | Update | Delete | Ownership | Admin Access | Status |
|-------|-------------|--------|--------|--------|--------|-----------|--------------|--------|
| **All 22 tables** | ✅ Yes | anon: **DENY** | anon: **DENY** | anon: **DENY** | anon: **DENY** | n/a — no anon path exists | `postgres` bypasses RLS; app unaffected | ✅ PASS |

RLS enabled with **no policies** is deny-all for ordinary roles. This is the correct posture here
precisely *because* there is no legitimate anon access pattern to preserve — the browser never
queries Postgres. Writing permissive policies would be strictly worse than writing none.

`FORCE ROW LEVEL SECURITY` is deliberately **not** used: FORCE applies RLS to the table owner too,
which would break the application's own connection.

### Verification after running

```sql
SELECT c.relname, c.relrowsecurity AS rls_enabled,
       (SELECT count(*) FROM pg_policies p
         WHERE p.schemaname='public' AND p.tablename=c.relname) AS policy_count
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r'
ORDER BY c.relrowsecurity ASC, c.relname;
```

Expect 22 rows, all `rls_enabled = t`, all `policy_count = 0`.

Then confirm from outside, with no credentials beyond the public key:

```bash
curl 'https://<project-ref>.supabase.co/rest/v1/customers?select=*' -H "apikey: <anon key>"
# Expect: empty array or permission error. NOT customer rows.
```

And confirm the app still works — the decisive check is which role Prisma connects as:

```sql
SELECT current_user;  -- through the app's DATABASE_URL. Expect: postgres
```

---

## Storage bucket policies

| Bucket | Visibility | RLS policies | Assessment |
|---|---|---|---|
| `order-uploads` | Private | None | ✅ Correct — all access is server-side via service-role; signed URLs are 60–120s. **Do not add an anon policy.** |
| `product-images` | Public | None | ✅ Acceptable — contents are public product photography by intent. |

**Must be verified manually:** that `order-uploads` really is private in the dashboard. Nothing in
the codebase can confirm the bucket's actual visibility setting, and a public `order-uploads`
would expose customer-submitted reference photos at guessable-free but permanent URLs.

---

## Residual risk after lockdown

Closing RLS does **not** change the application's own authorization posture, which is separately
sound (see `PERMISSIONS-MATRIX.md`). It closes one specific bypass: the path from an untrusted
browser holding a public key directly to the data layer, going around `proxy.ts` and
`requireRole()` entirely.

Two things remain unaddressed by RLS and are tracked elsewhere:
- **DB-08** — `Customer` has no deletion path at all, so an erasure request has no implementation.
- **AVL-01/02** — RLS protects against unauthorized reads, not against data loss. Backups are a
  separate and currently unproven control.
