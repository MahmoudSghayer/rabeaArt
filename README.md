# Rabea.art

Custom e-commerce and order-management platform for shirts, paintings, prints, and embroidery.
No online checkout — customers submit an order request; the admin reviews, prices, and accepts
it manually. Built with Next.js (App Router), TypeScript, Prisma, and Supabase (Postgres, Auth,
Storage).

See the implementation plan for full architecture context: it's linked from the session that
built this, or ask the maintaining engineer for a copy.

## Stack

- Next.js 16 (App Router, Turbopack, Server Actions)
- TypeScript (strict)
- Prisma 7 (driver-adapter client) against Supabase Postgres
- Supabase Auth (admin login) + Supabase Storage (private order uploads, public product images)
- next-intl (Arabic default / English, Hebrew scaffolded-but-disabled), full RTL support
- Zod, React Hook Form, Zustand (cart)
- Resend (transactional email, optional — degrades gracefully if unset)
- Vitest (unit/integration), Playwright (E2E)

## Local development

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

1. Go to https://supabase.com/dashboard and create a new project (any region).
2. **Database**: Project Settings → Database → Connection string.
   - Copy the **Transaction pooler** string (port 6543) → `DATABASE_URL` in `.env`.
   - Copy the **Direct connection** string (port 5432) → `DIRECT_URL` in `.env`.
3. **API**: Project Settings → API.
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only — never expose to the client)
4. Copy `.env.example` to `.env` and fill in the four values above, plus `NEXT_PUBLIC_SITE_URL`
   (`http://localhost:3000` locally) and a random `CRON_SECRET`.

### 3. Run migrations and seed data

```bash
npm run db:migrate   # applies prisma/migrations, creates the DB schema
npm run db:seed      # loads the starter catalog (shirts/paintings/options)
```

### 4. Create the first admin user (Owner)

Admin accounts are never self-registered. Create the first Owner via the Supabase dashboard
(Authentication → Users → Add user) or the Supabase CLI, then link it to an `AdminUser` row:

```bash
npx tsx scripts/create-owner.ts --email you@example.com
```

(This script is added in the admin-auth milestone — see CHANGELOG/plan for status.)

### 5. Run the app

```bash
npm run dev
```

Storefront: http://localhost:3000 (Arabic) or http://localhost:3000/en (English).
Admin: http://localhost:3000/admin/login

### 6. Optional: email

Without `RESEND_API_KEY`/`EMAIL_FROM` set, the app runs normally but outbound email is disabled
(visible in Admin → Settings). To enable it, create a Resend account, verify a sending domain,
and add the API key to `.env`.

## Testing

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run test         # vitest (unit + integration)
npm run test:e2e     # playwright (starts its own build+server)
```

Integration tests need `DATABASE_URL`/`DIRECT_URL` pointed at a **separate, disposable**
Supabase project — never run them against production data.

## Deployment

The app is designed for Vercel + Supabase, but has no hard platform lock-in beyond that pairing:

1. Push to a Git provider connected to Vercel (or any Next.js-compatible host).
2. Set all variables from `.env.example` in the host's environment settings.
3. Run `npm run db:migrate:deploy` against production once, from CI or locally with production
   `DIRECT_URL`.
4. The upload-cleanup cron (`POST /api/cron/cleanup-uploads`, `x-cron-secret: $CRON_SECRET`) can
   be scheduled via Vercel Cron, Supabase `pg_cron`, or any external scheduler — it's a plain
   HTTP endpoint, not tied to one provider.

## Project structure

See the plan file for the full folder layout and architecture decisions (schema shape, RBAC
model, upload flow, stock-reservation rule, etc.).
