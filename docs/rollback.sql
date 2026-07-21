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

-- =============================================================================
-- SAFETY GUARD (audit finding DB-02)
--
-- Everything above this line is a comment, and a comment stops nobody. This
-- script drops 22 tables; the normal way to run SQL on this project is pasting
-- into the Supabase SQL Editor, where the distance between "the cleanup tab" and
-- "the production tab" is one click.
--
-- So the script now refuses to run unless you explicitly arm it. To proceed,
-- uncomment the SET line below, or run it yourself first in the same session:
--
--     SET LOCAL rabea.i_really_mean_it = 'yes';
--
-- Arming it is a deliberate, separate act — which is the whole point.
-- =============================================================================

-- SET LOCAL rabea.i_really_mean_it = 'yes';

DO $$
BEGIN
  IF current_setting('rabea.i_really_mean_it', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION
      'REFUSING TO RUN: this script drops all 22 Rabea.art tables and deletes every order, customer and product in them. If that is genuinely what you want, arm it with:  SET LOCAL rabea.i_really_mean_it = ''yes'';';
  END IF;
END $$;

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
