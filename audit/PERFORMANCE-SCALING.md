# Performance & Scaling — rabea.art

## Current bottlenecks (ranked by blast radius)

| # | Bottleneck | Evidence | Triggers at |
|---|---|---|---|
| 1 | **Nothing is cached, anywhere** | No `revalidate`, `unstable_cache`, `"use cache"` or `cache()` in `src/` | Every request, today |
| 2 | **`listProducts` loads the entire catalog per `/shop` hit** | `src/lib/catalog/queries.ts:248-274` — `findMany` with a 4-deep include, no `take`, filtered and paginated in JS | ~200+ products |
| 3 | **Zero foreign-key indexes** | `prisma/schema.prisma` — only 16 indexes, none on an FK | ~1,000 orders |
| 4 | **Connection pool defaults to 10 per instance** | `src/lib/prisma.ts:22` — `PrismaPg({ connectionString })`, no `max` | ~20 concurrent lambdas |
| 5 | **Cleanup cron is O(total files) per run, on an unindexed column** | `.../cleanup-uploads/route.ts:68-71` | ~2,000 stored files |
| 6 | **Order pricing is N+1** | `submit.ts:346` — 1–2 queries per cart item, in parallel | 10-item cart |

## Frontend performance

**Verified from the build output:** `.next/prerender-manifest.json` lists **three** static entries
(`/_global-error`, `/apple-icon.png`, `/icon.png`) and zero static pages. Every route is
server-rendered per request, confirmed live:

```
$ curl -sSI https://www.rabea.art/
Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
```

The most wasteful cases are `about`, `contact`, `legal/terms` and `legal/privacy` — **pure
translation content with zero dynamic inputs**, re-rendered from scratch on every hit.

**Good:** fonts are self-hosted via `next/font` with explicit Arabic subsets and `display: swap`
(no render-blocking external request); the motion layer honours `prefers-reduced-motion` in both
JS and CSS and cleans up every listener; `ProductCard` is an async Server Component pushing only
the tilt wrapper to the client.

**Weak:** 54 files carry `"use client"`, and the two highest-traffic storefront routes ship the
largest bundles — `CustomWizard.tsx` (704 lines) and `ProductView.tsx` (648). Both are genuinely
stateful so neither converts wholesale; the win is extracting their static subtrees (copy blocks,
step headers, spec tables) into Server Components passed as `children`.

**Not yet exercised:** there is no product photography — `ProductCard` and `Gallery` render
procedural CSS gradients. So the image pipeline is entirely untested by real load, and the moment
real photos land, `next/image` adoption becomes the dominant frontend performance question.

**Core Web Vitals could not be measured** — the site serves only the coming-soon page, so there is
no real page to measure. Run PageSpeed Insights against a preview URL (`?preview=<PREVIEW_KEY>`)
before launch.

## Backend performance

**Done well, and it constrains what is worth changing:** every admin list uses `skip`/`take` with
a parallel `count()` and `select` projections rather than `include`; the customers list explicitly
avoids N+1 with a single grouped `$queryRaw`; the overview derives 12 stat tiles from 2 `groupBy`
calls rather than 12 counts; both CSV exports cap at 5,000 rows.

**Issues:**

- **PERF-01 — `listProducts`** is the highest-blast-radius query in the codebase and sits on the
  anonymous, uncached `/shop` path. The header comment acknowledges it and pins it to "total
  product count is in the tens", which is true today (12 seeded products, 80 variants).
- **API-05 — order pricing N+1.** Parallel, so latency is fine, but a 10-item cart can occupy up
  to 20 simultaneous connections against a pool of 10. Batching to one
  `findMany({ where: { id: { in: ids } } })` makes it 3 queries flat.
- **`admin/layout.tsx:48`** runs a `NEW`-order count on every admin page render for the sidebar
  badge — cheap with the `status` index, but unconditional and uncached.
- **Orders CSV export uses `include`, not `select`** — pulls all 20 order columns × 5,000 rows
  including `notes` and `idempotencyKey`, none of which reach the CSV.

## Database performance

The complete index inventory is 16 entries; **not one is on a foreign key.** Postgres does not
auto-index FKs and Prisma only creates what it is told.

**Highest-impact missing indexes**, each tied to a real query:

| Index | Serves | Current cost |
|---|---|---|
| `orders(customerId)` | `customers/page.tsx:40`, `customers/export/route.ts:60` `groupBy` | Seq scan of `orders` |
| `order_items(orderId)` | Every order detail render; `items: { some: … }` subqueries | Seq scan |
| `order_files(bucketPath)` | Cleanup cron, once per object per night | Seq scan × N, forever |
| `orders(archived, createdAt)` | Every reports figure (`reports/page.tsx:31-47`) | Bitmap-and or scan |
| `orders(archived, status)` | Status tiles | Bitmap-and or scan |
| `email_logs(status, at)` | Reports `groupBy` + failed-email list | Full scan; **table grows forever** |
| `order_files(orderId)`, `order_status_history(orderId)`, `communication_logs(orderId)`, `audit_logs(actorId)`, `products(categoryId)`, `product_images(productId)` | Joins throughout admin | Seq scans |

Also unindexable as written: all `q` search filters use `contains` + `mode: "insensitive"`, which
compiles to `ILIKE '%…%'`. If search latency ever matters, that needs `pg_trgm` + GIN.

**Connection handling** is otherwise correct: singleton cached on `globalThis`, lazily constructed
via a Proxy (so `next build` works without a database), with `DATABASE_URL` (pooled, port 6543,
`pgbouncer=true`) properly separated from `DIRECT_URL` for migrations. The risk (DB-07) is that
nothing *enforces* the pooled URL — `env.ts:9` validates only `z.string().min(1)`, and the two
Supabase connection strings sit adjacent in the dashboard. A `.refine()` asserting `:6543` or
`pgbouncer=true` closes an easy and expensive mistake.

## Caching strategy — recommended

| Content | Recommended policy | Rationale |
|---|---|---|
| Static assets (`/_next/static/**`) | `public, max-age=31536000, immutable` | Vercel default; content-hashed. Already correct. |
| Fonts | `public, max-age=31536000, immutable` | Self-hosted, hashed. Already correct. |
| Product images (public bucket) | `public, max-age=86400, stale-while-revalidate=604800` | Rarely change; safe to serve stale |
| `about`, `contact`, `legal/*` | **`force-static`** | Zero dynamic inputs — free win |
| Home, `/shop`, product detail | `revalidate = 300` + tag-based invalidation | Catalog is near-static; invalidation plumbing already exists |
| Authenticated pages (`/admin/**`) | `private, no-store` | Must never be shared-cached |
| API responses | `no-store` | All are mutations or personalised |
| Uploaded order files | `private, max-age=0` | Already correct — 60–120s signed URLs |
| Admin data | `no-store` | Correct today |

The invalidation half is **already written**: ~30 `revalidatePath` sites across the admin actions,
including `revalidatePath("/")` in settings. There is simply nothing cached for them to
invalidate. This is the cheapest large win available.

## Scaling limitations

| Limit | Ceiling | Notes |
|---|---|---|
| Supabase connections | ~60–200 by tier | Pooled via pgbouncer; `max: 10`/instance is the real multiplier |
| Vercel function concurrency | Plan-dependent | No `maxDuration` or `memory` configured at all |
| Cron duration | 10s (Hobby) / 15s (Pro) | **Already insufficient** — 500 serial deletions cannot finish |
| Storage | Unbounded, unmonitored | `product-images` orphans never collected |
| `rate_limit_buckets` | Unbounded | One row per unique IP, never deleted |
| Region | `iad1` default | **No `regions` in `vercel.json`** — likely cross-region from the DB |

## Scaling plan

### Current traffic — a studio storefront, low tens of orders/month

The architecture is correctly sized. The Postgres-backed rate limiter is the right call; adding
Redis here would be premature. **Do these three anyway, because they are cheap and prevent
avoidable pain:**

1. Add the FK indexes (one migration, no behaviour change).
2. `force-static` on about/contact/legal.
3. Set `regions` in `vercel.json` to match the Supabase region.

### 10× — hundreds of orders/month, thousands of sessions/day

1. **Cache the catalog** — `revalidate` on home/shop/product with tag invalidation wired to the
   existing `revalidatePath` sites. Removes most database load outright.
2. **Bound `listProducts`** — push filtering, sorting and pagination into SQL (PERF-01).
3. **Batch order pricing** into 3 queries (API-05).
4. **Set the Prisma pool explicitly** (`max: 3`) and add the `.refine()` on `DATABASE_URL`.
5. **Fix the cron** — add `@@index([bucketPath])`, batch the ownership check into one `findMany`
   per prefix, and set `maxDuration`.
6. Add `pg_trgm` + GIN if admin search feels slow.

### 100× — thousands of orders/month

1. **Move email off the request path** into a queue with retry — today a Resend outage silently
   loses confirmations.
2. **Read replica** or Supabase connection-pooler tier increase.
3. **Partition or archive `email_logs` and `audit_logs`** — both grow forever with no retention.
4. **Add a TTL sweep for `rate_limit_buckets`**, or move the limiter to Redis if write volume
   makes the Postgres approach the bottleneck.
5. **CDN-cache the storefront at the edge** with tag-based purge.
6. Revisit multi-region only if the customer base genuinely spans regions — for a single studio it
   is very likely unnecessary.

## Cost-aware recommendations

**Do now (near-zero cost, prevents real pain):** FK indexes; `force-static` on content pages;
`regions`; explicit pool `max`; cron `maxDuration`; `product-images` cleanup — that last one is a
*permanent unbounded storage leak* and is pure cost, growing forever.

**Do not do now:** Redis/Upstash, queues, read replicas, multi-region, APM beyond error tracking.
None is justified at current traffic, and each adds an operational surface that a single-studio
team has to maintain.

**Best value overall:** catalog caching. It is a handful of lines, the invalidation half is
already written, and it removes the majority of database round-trips on the public path.
