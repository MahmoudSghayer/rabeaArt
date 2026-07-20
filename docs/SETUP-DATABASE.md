# Database setup — run once, entirely from the Supabase dashboard

No local development environment or `.env` file is needed. Everything below happens in the
Supabase dashboard's SQL Editor and Authentication pages.

Run the three steps in order. Each is safe to re-run.

---

## Step 1 — Create the schema

1. Supabase dashboard → **SQL Editor** → **New query**.
2. Open `prisma/migrations/0_init/migration.sql` in this repo, copy the **entire** file,
   paste it into the editor, and click **Run**.

This creates every table, enum, index, and foreign key, plus two custom objects the app
depends on:

- `order_ref_seq` — the sequence behind human-readable order references (`RA-1001`, `RA-1002`, …).
- A `CHECK (stock >= 0)` constraint on `product_variants`, so stock can never go negative even
  if application logic were bypassed.

Expected result: `Success. No rows returned`.

> Re-running this file will fail with "already exists" errors — that is expected and harmless.
> To rebuild from scratch instead, run `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` first.
> **That deletes all data**, so never do it once real orders exist.

---

## Step 2 — Seed the catalog

1. **SQL Editor** → **New query**.
2. Copy the entire contents of `docs/seed.sql`, paste, and **Run**.

This inserts the starting catalog: 2 categories, 7 colours, 10 sizes, 3 frames, 3 materials,
15 production-method/option rows, 12 products with their colour/size/variant rows, and the
site settings singleton.

The script is idempotent — running it twice updates the existing rows rather than creating
duplicates. It contains no orders, customers, or admin accounts, so it is safe to run against
the live database at any time.

The final query prints a row-count table so you can confirm what landed.

---

## Step 3 — Create your owner admin account

Admin identity is split across two places: Supabase Auth holds the password, and the
`admin_users` table holds the role. Both are needed, linked by the same id.

1. Dashboard → **Authentication** → **Users** → **Add user** → **Create new user**.
   - Enter your email and a strong password.
   - Tick **Auto Confirm User** (otherwise login is blocked pending email confirmation).
   - Create the user, then copy its **UID** (a UUID shown in the user list).

2. **SQL Editor** → **New query** → paste the following, replacing the three placeholder
   values, and **Run**:

```sql
insert into admin_users (id, email, name, role, active, "createdAt", "updatedAt")
values (
  'PASTE-THE-UID-HERE',
  'you@example.com',
  'Rabea',
  'OWNER',
  true,
  now(),
  now()
)
on conflict (id) do update
  set role = 'OWNER', active = true, email = excluded.email, name = excluded.name;
```

The `id` **must** be the Supabase Auth UID, not a random value — that link is what the app
checks on every admin request. If they do not match, login succeeds but every admin page
returns "forbidden".

You can now sign in at `https://rabea.art/admin`. As `OWNER` you can invite the rest of the
team from **Admin → Users**, which handles both halves of this automatically.

---

## Environment variables

Set in Vercel → Project → Settings → Environment Variables. Required:

| Variable | Where it comes from |
|---|---|
| `DATABASE_URL` | Supabase → Connect → Transaction pooler (port 6543) |
| `DIRECT_URL` | Supabase → Connect → Direct connection (port 5432) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key (server-only) |
| `NEXT_PUBLIC_SITE_URL` | `https://rabea.art` |
| `CRON_SECRET` | Any long random string; authenticates the daily cleanup job |

Optional — email notifications are disabled until these exist, and the app runs normally
without them:

| Variable | Notes |
|---|---|
| `RESEND_API_KEY` | From resend.com; without it, sends are skipped and logged as failed |
| `EMAIL_FROM` | e.g. `Rabea.art <orders@rabea.art>` — the domain must be verified in Resend |

## Storage buckets

Dashboard → **Storage** → **New bucket**, created once:

| Bucket | Public? | Contents |
|---|---|---|
| `order-uploads` | **No** | Customer reference images. Reachable only via short-lived signed URLs after admin login. |
| `product-images` | **Yes** | Product photos, served through Vercel's image optimizer. |

No storage policies are required: the application only touches storage server-side using the
service-role key, so there is nothing to grant anonymous users.

---

## Going live

The site serves a "coming soon" page for every URL until you set `COMING_SOON=0` in the Vercel
environment and redeploy. To preview privately before launch, set `PREVIEW_KEY` to a random
string and visit `https://rabea.art/?preview=<that string>` once — a cookie keeps you in for
30 days.
