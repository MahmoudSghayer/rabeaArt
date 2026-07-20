-- =============================================================================
-- Rabea.art — ROLLBACK: remove everything 0_init/migration.sql + seed.sql created
-- =============================================================================
--
-- USE THIS ONLY to undo an accidental install into the wrong database.
--
-- It drops ONLY the 22 tables, 7 enum types and 1 sequence that the Rabea.art
-- migration created. Anything else in the database is left untouched — the
-- migration was purely additive (`CREATE SCHEMA IF NOT EXISTS "public"` is a
-- no-op on an existing schema), so nothing pre-existing was ever modified.
--
-- DESTRUCTIVE for Rabea.art data: dropping the tables deletes any orders,
-- customers and products stored in them. That is the intent when undoing a
-- mistaken install; do NOT run this against the real Rabea.art database.
--
-- BEFORE RUNNING — confirm you are connected to the database you mean to clean.
-- Run this first and read the output:
--
--     select current_database(), current_user;
--
--     select table_name
--     from information_schema.tables
--     where table_schema = 'public'
--     order by table_name;
--
-- If that list contains tables you recognise from ANOTHER project, they will
-- survive this script — but read the DROP list below and satisfy yourself that
-- none of your own table names collide with it before continuing.
-- =============================================================================

BEGIN;

-- Tables. CASCADE clears the foreign keys between them; order does not matter.
DROP TABLE IF EXISTS
  "audit_logs",
  "email_logs",
  "communication_logs",
  "order_status_history",
  "order_files",
  "order_items",
  "orders",
  "customers",
  "product_variants",
  "product_sizes",
  "product_colors",
  "product_images",
  "products",
  "production_methods",
  "materials",
  "frames",
  "sizes",
  "colors",
  "categories",
  "settings",
  "admin_users",
  "rate_limit_buckets"
CASCADE;

-- Enum types (dropped after the tables that used them).
DROP TYPE IF EXISTS
  "OrderStatus",
  "PaymentStatus",
  "AdminRole",
  "ProductType",
  "ItemKind",
  "ContactMethod",
  "SizeScope"
CASCADE;

-- Human-readable order-reference counter.
DROP SEQUENCE IF EXISTS "order_ref_seq";

COMMIT;

-- Verify nothing of ours remains (expect zero rows):
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'admin_users','audit_logs','categories','colors','communication_logs','customers',
    'email_logs','frames','materials','order_files','order_items','order_status_history',
    'orders','product_colors','product_images','product_sizes','product_variants',
    'production_methods','products','rate_limit_buckets','settings','sizes'
  );
