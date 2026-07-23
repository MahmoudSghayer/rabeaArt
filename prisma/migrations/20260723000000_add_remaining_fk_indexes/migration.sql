-- Add the FK indexes the first sweep missed (audit finding DB-03, session 3).
--
-- 20260721000000_add_missing_indexes indexed the order/reporting FKs but not the catalog
-- join-table FKs, so six foreign-key columns were still unindexed. Each is a NON-leading column of
-- a composite @@id/@@unique (or has no index at all), so the leftmost-prefix rule means the
-- existing composite cannot serve a single-column lookup on it:
--
--   * product_colors.colorId       -- trailing col of PK (productId, colorId)
--   * product_sizes.sizeId         -- trailing col of UNIQUE (productId, sizeId)
--   * product_variants.colorId     -- middle col of UNIQUE (productId, colorId, sizeId)
--   * product_variants.sizeId      -- trailing col of the same UNIQUE
--   * order_items.productId        -- FK, no index
--   * order_items.variantId        -- FK, no index
--
-- Live seq scan today: sizeInUse() in admin/options/actions.ts runs
--   productVariant.count({ where: { sizeId } })  and  productSize.count({ where: { sizeId } })
-- before a Size can be deleted — both filter on the trailing column alone.
--
-- IDEMPOTENT: IF NOT EXISTS throughout, safe to re-run and safe to paste into the Supabase SQL
-- Editor (how schema changes reach this database — see docs/SETUP-DATABASE.md). Index names match
-- Prisma's convention so a future `prisma migrate diff` sees schema and database as consistent.
--
-- LOCKING: plain CREATE INDEX takes a SHARE lock (blocks writes, not reads) for the duration —
-- milliseconds at current table sizes. Switch to CREATE INDEX CONCURRENTLY (outside a transaction)
-- only if these tables ever reach the millions.

BEGIN;

-- catalog join tables --------------------------------------------------------
CREATE INDEX IF NOT EXISTS "product_colors_colorId_idx" ON "product_colors" ("colorId");
CREATE INDEX IF NOT EXISTS "product_sizes_sizeId_idx" ON "product_sizes" ("sizeId");
CREATE INDEX IF NOT EXISTS "product_variants_colorId_idx" ON "product_variants" ("colorId");
CREATE INDEX IF NOT EXISTS "product_variants_sizeId_idx" ON "product_variants" ("sizeId");

-- order_items FKs ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "order_items_productId_idx" ON "order_items" ("productId");
CREATE INDEX IF NOT EXISTS "order_items_variantId_idx" ON "order_items" ("variantId");

COMMIT;

-- Verification: expect 6 rows.
--
--   SELECT tablename, indexname FROM pg_indexes
--   WHERE schemaname = 'public' AND indexname IN (
--     'product_colors_colorId_idx','product_sizes_sizeId_idx',
--     'product_variants_colorId_idx','product_variants_sizeId_idx',
--     'order_items_productId_idx','order_items_variantId_idx'
--   ) ORDER BY tablename, indexname;
