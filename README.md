# Rabea.art

Rabea.art is an Arabic-first e-commerce and custom-order platform for a working artist's studio:
printed/embroidered shirts and original paintings. Customers browse the catalog or open the
custom-order wizard (custom shirt, custom painting, or a free-form "other" request), add items to
a cart, and submit an order request with their contact details. There is **deliberately no online
checkout** — every submitted order lands in the admin queue as `NEW`, and a member of the studio
reviews it, sets a final price, and accepts (or declines) it manually. Payment itself is arranged
offline (cash, transfer, etc.) and only tracked in the admin as a status (`PaymentStatus`), never
processed by this app.

The `docs/` folder has the operational runbooks this README intentionally does not duplicate:

- [`docs/SETUP-DATABASE.md`](docs/SETUP-DATABASE.md) — dashboard-only steps to create the schema,
  seed the catalog, and create the first admin account. Start here for a fresh environment.
- [`docs/SETUP-SUPABASE.md`](docs/SETUP-SUPABASE.md) — Storage buckets, the upload-cleanup cron,
  and Resend email setup.
- [`docs/seed.sql`](docs/seed.sql) / [`docs/rollback.sql`](docs/rollback.sql) — the starter catalog
  and a targeted rollback script.
- [`docs/ADMIN-GUIDE.md`](docs/ADMIN-GUIDE.md) — day-to-day usage guide for the studio owner
  (Arabic).
- [`AGENTS.md`](AGENTS.md) — a note for coding agents about this Next.js version's docs living
  under `node_modules/next/dist/docs/`.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router, Server Actions) | One deployable for storefront + admin + API routes; Server Actions remove a hand-rolled REST layer for every admin mutation. |
| Language | TypeScript (strict) | The order/pricing/inventory logic has enough edge cases that structural typing catches real bugs (see the invariants below). |
| Database / ORM | Prisma 7 (driver-adapter client) + Supabase Postgres | Prisma 7's client needs an explicit driver adapter (`@prisma/adapter-pg`) rather than a bundled engine binary — chosen so the app works unmodified on serverless (see [Gotchas](#gotchas)). |
| Auth | Supabase Auth | Admin login only (no customer accounts exist); `@supabase/ssr` verifies the session JWT locally on every request without a network round-trip. |
| Storage | Supabase Storage | Two buckets — private customer uploads, public product photos — administered entirely server-side with the service-role key. |
| i18n | next-intl | Full Arabic (RTL) / English (LTR) message catalogs and routing; Hebrew has a message-file skeleton (`src/messages/he.json`) but isn't a selectable locale yet. |
| Validation | Zod | One schema (`orderPayloadSchema`) is shared between the client cart form's pre-validation and the server's authoritative check. |
| Forms | React Hook Form | Every non-trivial admin form (products, settings, order management) and the storefront checkout form. |
| Client state | Zustand | The shopping cart — the only client-side state that needs to survive across storefront pages. |
| Email | Resend | Transactional order-lifecycle emails; intentionally optional (see [Environment variables](#environment-variables)). |
| Testing | Vitest (unit) + Playwright (E2E) | See [Testing](#testing) for what's covered and how DB-dependent specs are gated. |
| Hosting | Vercel | Cron (`vercel.json`), environment variables, and the Next.js runtime all assume Vercel, though nothing is hard-locked to it beyond that pairing. |

## Architecture

### Route map

```
src/app/
├─ [locale]/                          storefront — Arabic at "/", English at "/en" (see Locale)
│  └─ (storefront)/
│     ├─ page.tsx                     home
│     ├─ shop/page.tsx                catalog browse: filters, sort, pagination
│     ├─ product/[slug]/page.tsx      product detail: gallery, colour/size picker, add to cart
│     ├─ custom/page.tsx              custom-order wizard (shirt / painting / other)
│     ├─ order/page.tsx               cart review → customer details → submit → confirmation
│     ├─ about/page.tsx, contact/page.tsx
│     └─ legal/{privacy,terms}/page.tsx
│
├─ admin/                             NOT locale-prefixed; RTL/LTR via its own message files
│  ├─ login/page.tsx                  Supabase Auth sign-in
│  ├─ page.tsx                        overview / dashboard                (STAFF+)
│  ├─ orders/page.tsx, orders/[id]/page.tsx        list + detail          (STAFF+)
│  ├─ customers/page.tsx, customers/[id]/page.tsx  list + detail          (STAFF+)
│  ├─ files/page.tsx                  every customer-uploaded reference file  (STAFF+)
│  ├─ reports/page.tsx                revenue/status/email stats + CSV exports (STAFF view, ADMIN+ to export)
│  ├─ products/page.tsx               catalog list                       (STAFF view)
│  ├─ products/new/page.tsx, products/[id]/edit/page.tsx  create/edit    (ADMIN+)
│  ├─ options/page.tsx                colours, sizes, frames, materials, methods (ADMIN+)
│  ├─ settings/page.tsx               contact info, announcement bar, custom-other toggle (ADMIN+)
│  └─ users/page.tsx                  invite/deactivate admins, change roles (OWNER only)
│
└─ api/
   ├─ orders/route.ts                              POST   storefront order submission
   ├─ uploads/sign/route.ts                         POST   signed upload URL for an order attachment
   ├─ uploads/verify/route.ts                       POST   server-verifies what was actually uploaded
   ├─ admin/files/[fileId]/route.ts                 GET    redirect to a short-lived signed download URL (STAFF+)
   ├─ admin/orders/export/route.ts                  GET    CSV, filtered orders list (ADMIN+)
   ├─ admin/orders/[id]/export/route.ts             GET    CSV, single order (ADMIN+)
   ├─ admin/customers/export/route.ts                GET    CSV, customers (ADMIN+)
   ├─ admin/product-images/sign/route.ts            POST   signed upload URL for a product photo (ADMIN+)
   └─ cron/cleanup-uploads/route.ts                 GET/POST  sweeps orphaned staged uploads (CRON_SECRET)
```

Role floor for every admin route/action is enforced server-side by `requireRole()` — see
[Key invariants](#key-invariants). `AdminRole` ranks `OWNER > ADMIN > STAFF`.

**Locale, right now:** the storefront is Arabic-only in practice. `routing.ts`
(`src/i18n/routing.ts`) sets `localeDetection: false` — every visitor lands on Arabic (`/`)
regardless of browser language — and `SHOW_LANGUAGE_SWITCHER = false` hides the switcher UI
everywhere. English is fully built and still reachable by going directly to `/en` (useful for
sharing a link with a non-Arabic speaker); flip `SHOW_LANGUAGE_SWITCHER` to `true` to bring the
switcher back with no other change. Admin routes are separate: they are not locale-prefixed at
all and read their own RTL/AR-default language from a `rabea_locale` cookie (see
`src/app/admin/_lib/messages.ts`).

### Request path: order submission

1. The cart lives in Zustand (`src/lib/cart/store.ts`). On the order page, `DetailsForm.tsx`
   (`src/app/[locale]/(storefront)/order/DetailsForm.tsx`) collects customer details, generates a
   client-side `idempotencyKey` once (`crypto.randomUUID()`, cached in a ref so a retry reuses it
   instead of creating a duplicate order), and `POST`s the payload to `/api/orders`.
2. `src/app/api/orders/route.ts`: `checkRateLimit` (`src/lib/rate-limit.ts` — 5 requests / 10 min
   per IP, Postgres-backed, **fails open** on a DB error) → `orderPayloadSchema.safeParse`
   (`src/lib/orders/schemas.ts`) → `submitOrder`.
3. `submitOrder` (`src/lib/orders/submit.ts`): an idempotency fast-path re-fetches by key first;
   otherwise it re-prices every item fresh from the database (`priceShirtItem` /
   `pricePaintingItem` / `priceCustomItem`, backed by `src/lib/pricing/index.ts`), normalizes the
   customer's phone/email (`src/lib/customer-matching/index.ts`), then runs one
   `prisma.$transaction` that resolves-or-creates the `Customer` row (deduped by
   `decideCustomerMatch`), pulls the next value from the Postgres sequence `order_ref_seq`, and
   creates `Order` + `OrderItem`s + `OrderFile`s + the first `OrderStatusHistory` row together. A
   racing duplicate submit hits the `idempotencyKey` unique constraint (Prisma `P2002`) and is
   re-resolved to the already-created order rather than erroring.
4. The route handler fires an "order received" confirmation email in the background
   (`sendOrderNotification`, `src/lib/email/notify.ts`) — this never blocks or fails the HTTP
   response.

### Request path: admin status change

1. `ManagePanel.tsx` (`src/app/admin/orders/[id]/ManagePanel.tsx`) calls the
   `updateOrderStatusAction` Server Action (`src/app/admin/orders/[id]/actions.ts`).
2. `requireRole(AdminRole.STAFF)` (`src/lib/auth/requireRole.ts`) runs first — this is the real
   authorization boundary; `src/proxy.ts` only checks "is there a session".
3. `isValidTransition` (`src/lib/orders/transitions.ts`) rejects a same-status "transition" and
   anything leaving `COMPLETED`/`CANCELLED` other than back to `REVIEW`.
4. `stockActionForTransition` decides `apply` / `release` / `none` from the destination status and
   `Order.stockAppliedAt`; `applyStock` / `releaseStock` (`src/lib/inventory/`) run inside the
   *same* `prisma.$transaction` as the status write. `applyStock` re-checks live stock and throws
   `InventoryError` — aborting the whole transaction, no partial accept — if any variant is short.
5. That transaction also writes the new `Order.status`, an `OrderStatusHistory` row, and an
   `AuditLog` row.
6. After the transaction commits, a status-triggered customer email fires in the background for
   `QUOTED` / `ACCEPTED` / `DECLINED` / `READY` (`STATUS_EMAIL_TEMPLATES` map in `actions.ts`).
7. `revalidatePath` refreshes the order detail, orders list, and overview pages.

Every other admin mutation (`src/app/admin/**/actions.ts`) follows the same shape: `requireRole`
first, Zod validation, mutation + its `AuditLog` row inside one transaction, a typed
`{ ok, error? }` return instead of a thrown error, then `revalidatePath`.

## Key invariants

Breaking any of these is a correctness or security bug, not a style nit.

- **Client-submitted prices are never trusted.** `orderPayloadSchema` (`src/lib/orders/schemas.ts`)
  has no price field at all; `submitOrder` re-derives every price from a fresh DB read inside its
  transaction. A stray `price`/`unitPrice` key on an incoming request body is silently stripped by
  Zod, not rejected.
- **`OrderItem.unitPrice: null` means manual/after-review pricing.** Custom-order items are always
  priced this way. `cartTotals` / `estTotalForOrder` (`src/lib/pricing/index.ts`) special-case an
  order that's *entirely* manual items so its estimate reads as "priced after review", not "₪0".
- **Stock only moves on entering `ACCEPTED`**, and is released the moment an order leaves the
  `ACCEPTED`/`PROGRESS`/`READY`/`COMPLETED` family (`stockActionForTransition`,
  `src/lib/orders/transitions.ts`). This is guarded by the idempotent `Order.stockAppliedAt`
  timestamp (so a repeated transition call never double-decrements or double-releases) and by a
  database-level `CHECK (stock >= 0)` on `product_variants` as a last-resort backstop.
- **`ProductVariant` rows gate orderability even when `trackStock` is false.** A colour × size
  combination is only orderable if it has a `ProductVariant` row (`priceShirtItem` in
  `src/lib/orders/submit.ts` rejects the item otherwise); `syncShirtRelations`
  (`src/app/admin/products/actions.ts`) always regenerates the full combo set for a shirt product
  regardless of whether stock tracking is on — `trackStock` only decides whether the admin UI shows
  real stock numbers.
- **Order refs come from a Postgres sequence** (`order_ref_seq`, created by
  `prisma/migrations/0_init/migration.sql`), formatted as `RA-1042` by `formatOrderRef`
  (`src/lib/orders/ref.ts`). Never construct a ref any other way.
- **`requireRole` must be the first call in every admin Server Action / Route Handler.**
  `src/proxy.ts`'s admin gate only checks "is there a valid session" — hiding a button in the admin
  UI is not authorization. See `src/lib/auth/requireRole.ts`.
- **Uploads are validated against the stored object's real metadata, never the browser's claim.**
  `/api/uploads/verify` (`src/app/api/uploads/verify/route.ts`) reads size/content-type back from
  Supabase Storage itself (`getObjectMetadata`) and deletes the object if it fails the check.
- **CSV cells are sanitised against formula injection.** `sanitizeCell`
  (`src/lib/csv/index.ts`) prefixes any cell that would be sniffed as a spreadsheet formula
  (leading `=`, `+`, `-`, `@`, tab, or CR) with `'`.
- **The last active `OWNER` can never be removed.** `assertOwnerFloorNotBroken`
  (`src/app/admin/users/actions.ts`) runs inside the same transaction as a role change or
  deactivation and rejects it if it would leave zero active owners.
- **A product with order history is never hard-deleted.** `deleteProductAction`
  (`src/app/admin/products/actions.ts`) checks `_count.orderItems > 0` and refuses (`HAS_ORDERS`);
  archiving is the only removal path once a product has ever been ordered.

## Local development

There is **no local database** in this project's normal workflow — schema changes are applied by
pasting SQL into the Supabase dashboard (see `docs/SETUP-DATABASE.md`), not via `prisma migrate
dev` against a local Postgres. Be honest with yourself about this: `npm run dev` runs fine with no
`DATABASE_URL` configured for browsing storefront pages that don't touch the DB, but every
DB-backed page (shop, product detail, anything admin) needs `DATABASE_URL`/`DIRECT_URL` pointed at
a real Supabase project or it renders an error/empty state. For real work, point them at a
**separate, disposable** Supabase project — never develop against production data.

```bash
npm install                    # postinstall runs `prisma generate` (see Gotchas)
cp .env.example .env           # fill in a Supabase project's credentials
```

Follow `docs/SETUP-DATABASE.md` to create the schema and seed the catalog against that project,
then either follow its "create your owner admin account" SQL step, or run the equivalent script:

```bash
npx tsx scripts/create-owner.ts --email you@example.com --name "Your Name"
```

Then:

```bash
npm run dev
```

- Storefront: `http://localhost:3000` (Arabic) or `http://localhost:3000/en` (English).
- Admin: `http://localhost:3000/admin/login`.

Without `RESEND_API_KEY`/`EMAIL_FROM` set, the app runs normally and every outbound email attempt
is logged to `EmailLog` with `status: "failed"` instead of being sent — see
`docs/SETUP-SUPABASE.md` §3 for turning real email on.

### Commands

| Command | Does |
|---|---|
| `npm run dev` | Start the dev server (Turbopack). |
| `npm run build` | `prisma generate` then `next build`. |
| `npm run start` | Run a production build. |
| `npm run lint` | ESLint. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run test` | Vitest, unit tests only (see [Testing](#testing)). |
| `npm run test:watch` | Vitest in watch mode. |
| `npm run test:e2e` | Playwright — builds and starts the app itself, then runs `tests/e2e/**` (some specs need `E2E_HAS_DB=1` against a seeded DB, see [Testing](#testing)). |
| `npm run db:generate` | `prisma generate` (also runs automatically via `postinstall`). |
| `npm run db:migrate` | `prisma migrate dev` — **not the project's actual migration workflow**; see [Deployment](#deployment). |
| `npm run db:migrate:deploy` | `prisma migrate deploy` against `DIRECT_URL`. |
| `npm run db:seed` | `tsx prisma/seed.ts`. |
| `npm run db:studio` | `prisma studio` against `DIRECT_URL`. |

## Environment variables

See `.env.example` for the copy-pasteable template; this table explains each one.

| Variable | Required? | Where it comes from | What breaks without it |
|---|---|---|---|
| `DATABASE_URL` | Required | Supabase → Project Settings → Database → Connection string → **Transaction pooler**, port 6543 | App fails to boot — `src/instrumentation.ts` hard-asserts this at server startup (skipped only during `next build`). |
| `DIRECT_URL` | Required | Supabase → Connect → **Direct connection**, port 5432 | `prisma migrate`/`db:studio`/`scripts/create-owner.ts` can't connect. Also asserted at app startup even though the running app itself never queries through it. |
| `NEXT_PUBLIC_SUPABASE_URL` | Required | Supabase → Settings → API → Project URL | Every Supabase client (browser, server, admin) fails to construct. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Required | Supabase → Settings → API → `anon`/`public` key | Same — admin login and any anon-key client call fails. |
| `SUPABASE_SERVICE_ROLE_KEY` | Required | Supabase → Settings → API → `service_role` key. **Server-only — never prefix with `NEXT_PUBLIC_`, never send to the browser.** | Storage (uploads, signed URLs), admin invites/bans, and the cron cleanup job all fail. |
| `NEXT_PUBLIC_SITE_URL` | Required | Your deployed origin, e.g. `https://rabea.art` (or `http://localhost:3000`) | Used for `metadataBase` (canonical/OG URLs) and as the Playwright E2E `baseURL`. |
| `CRON_SECRET` | Required | Any random string ≥16 characters | `POST`/`GET /api/cron/cleanup-uploads` returns 401 for every caller, so staged uploads never get swept. |
| `RESEND_API_KEY` | Optional | resend.com → API Keys | Outbound email is disabled; every send attempt is logged to `EmailLog` as `status: "failed"`, `error: "EMAIL_DISABLED"`. The app runs normally otherwise. |
| `EMAIL_FROM` | Optional | A verified sender on a Resend-verified domain, e.g. `"Rabea.art <orders@rabea.art>"` | Same as above — both `RESEND_API_KEY` and `EMAIL_FROM` must be set for email to actually send. |
| `COMING_SOON` | Optional | Set to `"0"` to open the site in production | Defaults to gated: **every** production URL (storefront and admin) rewrites to `/coming-soon` unless this is `"0"`. Ignored outside `NODE_ENV=production`. |
| `PREVIEW_KEY` | Optional | Any random string | With `COMING_SOON` gating active, visiting `?preview=<PREVIEW_KEY>` once sets a 30-day cookie that bypasses the gate. Without this var set, there's no way to preview before launch other than disabling `COMING_SOON` entirely. |

## Deployment

The app is built for Vercel + Supabase, with no hard platform lock-in beyond that pairing:

1. Connect the repo to a Vercel project and set every variable from the table above in
   **Project → Settings → Environment Variables**.
2. Apply the schema and seed data once, per `docs/SETUP-DATABASE.md` (paste
   `prisma/migrations/0_init/migration.sql` and `docs/seed.sql` into the Supabase SQL Editor) — this
   project does **not** run `prisma migrate deploy` as part of the Vercel build. If a future schema
   change ships as a new file under `prisma/migrations/`, apply its SQL the same way (dashboard
   paste) or run `npm run db:migrate:deploy` locally against production's `DIRECT_URL`.
3. Create the Storage buckets and (optionally) schedule the cleanup cron and configure Resend —
   see `docs/SETUP-SUPABASE.md`. `vercel.json` already schedules
   `POST /api/cron/cleanup-uploads` daily at 03:00 via Vercel Cron; the route accepts either its
   own `x-cron-secret` header or Vercel Cron's `Authorization: Bearer $CRON_SECRET` convention.
4. **Go live**: the site serves `/coming-soon` for every URL by default in production. Set
   `COMING_SOON=0` in Vercel and redeploy (env var changes require a redeploy to take effect — see
   [Gotchas](#gotchas)) to open the real site.
5. **Private preview before launch**: set `PREVIEW_KEY` to a long random string, then visit
   `https://rabea.art/?preview=<that value>` once. A 30-day `httpOnly` cookie
   (`rabea_preview`) keeps that browser past the gate without needing `COMING_SOON=0`.

## Testing

- **Unit tests** (`npm run test`, Vitest, `tests/unit/**`): pure logic and small components —
  pricing, CSV encoding, customer matching, inventory decision helpers, order-ref formatting,
  status transitions, upload path/validation helpers, email templating, plus a few admin
  formatting/query-parsing helpers. These import no live database and run in CI on every push/PR
  (`.github/workflows/ci.yml`). `vitest.config.ts` also includes `tests/integration/**`, but that
  directory does not exist yet — the transaction-level paths it would cover (order submission,
  stock apply/release, CSV authorization) are exercised end-to-end by the DB-gated Playwright
  specs instead.
- **E2E tests** (`npm run test:e2e`, Playwright, `tests/e2e/**`): builds and starts the app itself
  (`webServer` in `playwright.config.ts`), then runs against it. Most specs need no database at
  all — they exercise pages/flows that render a designed empty/degraded state without one (static
  storefront pages, header navigation, the admin login redirect, RTL/accessibility checks, the
  custom-wizard chooser). **Four specs are DB-gated**: `shop-browse`, `order-flow`,
  `duplicate-submit` and `mobile` each start with
  `test.skip(!process.env.E2E_HAS_DB, "requires a seeded database — set E2E_HAS_DB=1 to run")` —
  they no-op unless you run `E2E_HAS_DB=1 npx playwright test` against an app whose `DATABASE_URL`
  points at a seeded, disposable Supabase project (see the spec files' header comments for the
  exact catalog shape they expect — e.g. at least one in-stock shirt, one painting, and enough
  products in one category to exercise pagination). Never point either the app under test or a
  database-backed spec at production.
- **CI** (`.github/workflows/ci.yml`) runs two jobs on every push and PR: `verify` (typecheck,
  lint, unit tests, production build) and `e2e` (installs Chromium, runs the full Playwright
  suite, uploads the HTML report as an artifact when it fails). Neither needs a database secret —
  the DB-gated specs skip themselves — so CI stays green without touching production data.

## Gotchas

- **Supabase's direct/dedicated hostname (`db.<project-ref>.supabase.co`) is IPv6-only and
  unreachable from Vercel's build/runtime network.** `DATABASE_URL` must be the **Transaction
  pooler** connection (`aws-0-<region>.pooler.supabase.com:6543`, user
  `postgres.<project-ref>`), which is IPv4-reachable and safe for serverless (short-lived,
  multiplexed connections). `DIRECT_URL` (the IPv6-only direct hostname) is fine for local
  `prisma migrate`/`db:studio` from a machine with IPv6 egress, or for CLI scripts, but do **not**
  put it in `DATABASE_URL` or the app will fail to connect in production. This cost real debugging
  time when first set up — get the pooler string right the first time.
- **Environment variable changes need a redeploy.** Vercel bakes env vars into the build/runtime at
  deploy time; editing one in the dashboard (e.g. flipping `COMING_SOON`) does nothing until you
  trigger a new deployment.
- **Vercel can mark a variable "Sensitive," which makes it write-only** — once saved that way, you
  can no longer view or "pull" its value back down (e.g. via `vercel env pull`), only overwrite it.
  Keep a copy of secrets (service-role key, `CRON_SECRET`, etc.) in your own password manager
  before marking them Sensitive in Vercel.
- **`prisma generate` runs in `postinstall`** because the generated client
  (`src/generated/prisma/`, configured via `generator client { output = "../src/generated/prisma" }`
  in `prisma/schema.prisma`) is gitignored, not committed. A fresh `npm install` (or Vercel's
  install step) always regenerates it — if imports from `@/generated/prisma/*` are red in your
  editor right after cloning, run `npm run db:generate` once.
- **Prisma 7 needs an explicit driver adapter.** `src/lib/prisma.ts` constructs the client lazily
  (on first property access, via a `Proxy`) rather than at module load, specifically so that
  `next build` — which imports route modules while collecting page data — succeeds in CI/Vercel
  environments with no `DATABASE_URL` at all. Don't "simplify" this back to a module-level
  `new PrismaClient()`; that reintroduces a build-time crash.
