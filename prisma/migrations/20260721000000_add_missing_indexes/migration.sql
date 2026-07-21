-- Add the missing indexes (audit finding DB-03).
--
-- Postgres does not auto-index foreign keys and Prisma only creates what it is told, so before
-- this migration NOT ONE foreign key in the schema was indexed. Every admin join, the customers
-- list, the reports page and the nightly cleanup cron were doing sequential scans. That is
-- invisible at 12 products and low tens of orders, and increasingly painful after that — which
-- is exactly why it is worth paying now, while the tables are small enough that each CREATE
-- INDEX completes in milliseconds.
--
-- Every index below is tied to a query that exists in the codebase today; none is speculative.
--
-- IDEMPOTENT: uses IF NOT EXISTS throughout, so it is safe to re-run and safe to paste into the
-- Supabase SQL Editor (which is how schema changes reach this database — see
-- docs/SETUP-DATABASE.md). Index names match Prisma's own convention, so a future
-- `prisma migrate diff` will see the schema and the database as consistent.
--
-- NOTE ON LOCKING: plain CREATE INDEX takes a SHARE lock, which blocks writes (not reads) for
-- the duration. At current table sizes that is milliseconds. If these tables ever grow into the
-- millions, switch to CREATE INDEX CONCURRENTLY — which cannot run inside a transaction, so the
-- BEGIN/COMMIT below would have to go too.

BEGIN;

-- orders ---------------------------------------------------------------------
-- customerId: the customers list (admin/customers/page.tsx) and the customers CSV export both
-- group orders by customer; unindexed this was a seq scan of orders per page view.
CREATE INDEX IF NOT EXISTS "orders_customerId_idx" ON "orders" ("customerId");
-- Nearly every admin figure filters `archived = false` AND ranges on createdAt or status.
-- The pre-existing single-column indexes on (status) and (createdAt) are deliberately kept:
-- they still serve the unfiltered NEW-order sidebar count and plain createdAt sorts, which
-- cannot use a composite whose leading column is `archived`.
CREATE INDEX IF NOT EXISTS "orders_archived_createdAt_idx" ON "orders" ("archived", "createdAt");
CREATE INDEX IF NOT EXISTS "orders_archived_status_idx" ON "orders" ("archived", "status");

-- order_items ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "order_items_orderId_idx" ON "order_items" ("orderId");
-- `items: { some: { kind: { in: [...] } } }` on the overview and reports pages.
CREATE INDEX IF NOT EXISTS "order_items_kind_idx" ON "order_items" ("kind");

-- order_files ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "order_files_orderId_idx" ON "order_files" ("orderId");
CREATE INDEX IF NOT EXISTS "order_files_orderItemId_idx" ON "order_files" ("orderItemId");
-- The single most valuable index here: the nightly orphan-cleanup cron
-- (api/cron/cleanup-uploads) looks up one bucketPath per storage object it scans. Unindexed,
-- that was a sequential scan per object, repeated for every retained file on every run — so the
-- cost grew with the number of files KEPT, not the number of orphans deleted.
CREATE INDEX IF NOT EXISTS "order_files_bucketPath_idx" ON "order_files" ("bucketPath");
-- Admin files grid sorts newest-first with skip/take.
CREATE INDEX IF NOT EXISTS "order_files_createdAt_idx" ON "order_files" ("createdAt");

-- order_status_history -------------------------------------------------------
CREATE INDEX IF NOT EXISTS "order_status_history_orderId_idx" ON "order_status_history" ("orderId");
CREATE INDEX IF NOT EXISTS "order_status_history_byAdminId_idx" ON "order_status_history" ("byAdminId");

-- communication_logs ---------------------------------------------------------
CREATE INDEX IF NOT EXISTS "communication_logs_orderId_idx" ON "communication_logs" ("orderId");
CREATE INDEX IF NOT EXISTS "communication_logs_byAdminId_idx" ON "communication_logs" ("byAdminId");

-- audit_logs -----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "audit_logs_actorId_idx" ON "audit_logs" ("actorId");
-- Audit review is always "what happened recently", newest first.
CREATE INDEX IF NOT EXISTS "audit_logs_at_idx" ON "audit_logs" ("at");

-- products / product_images --------------------------------------------------
CREATE INDEX IF NOT EXISTS "products_categoryId_idx" ON "products" ("categoryId");
CREATE INDEX IF NOT EXISTS "product_images_productId_idx" ON "product_images" ("productId");
-- Supports the product-image orphan sweep (audit finding DB-04) once it is implemented: it
-- matches stored objects against this column exactly as the order-uploads cron does.
CREATE INDEX IF NOT EXISTS "product_images_path_idx" ON "product_images" ("path");

-- email_logs -----------------------------------------------------------------
-- This table had NO index of any kind and grows one row per outbound email forever. Reports
-- does a groupBy(status) over an `at` range and lists the most recent failures.
CREATE INDEX IF NOT EXISTS "email_logs_at_idx" ON "email_logs" ("at");
CREATE INDEX IF NOT EXISTS "email_logs_status_at_idx" ON "email_logs" ("status", "at");
CREATE INDEX IF NOT EXISTS "email_logs_orderId_idx" ON "email_logs" ("orderId");

COMMIT;

-- Verification: expect 21 rows.
--
--   SELECT tablename, indexname FROM pg_indexes
--   WHERE schemaname = 'public' AND indexname IN (
--     'orders_customerId_idx','orders_archived_createdAt_idx','orders_archived_status_idx',
--     'order_items_orderId_idx','order_items_kind_idx',
--     'order_files_orderId_idx','order_files_orderItemId_idx','order_files_bucketPath_idx',
--     'order_files_createdAt_idx',
--     'order_status_history_orderId_idx','order_status_history_byAdminId_idx',
--     'communication_logs_orderId_idx','communication_logs_byAdminId_idx',
--     'audit_logs_actorId_idx','audit_logs_at_idx',
--     'products_categoryId_idx','product_images_productId_idx','product_images_path_idx',
--     'email_logs_at_idx','email_logs_status_at_idx','email_logs_orderId_idx'
--   ) ORDER BY tablename, indexname;
