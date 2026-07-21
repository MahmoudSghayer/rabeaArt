-- =============================================================================
-- Rabea.art — RESTORE / HEALTH VERIFICATION
--
-- Run this against a restored database (or the live one) to answer, in one
-- paste, "is this database actually complete and correct?".
--
-- Read-only. Safe to run against production at any time.
--
-- Written because audit findings AVL-01/AVL-02 found no backup evidence and no
-- restore had ever been tested — and an untested backup is a hypothesis, not a
-- recovery plan. The failure mode that matters is not "the restore errored", it
-- is "the restore looked fine and quietly lost something". Specifically
-- `order_ref_seq`: Prisma does not model sequences, so it is invisible to every
-- schema-diff tool, and without it order submission fails at the final step
-- (src/lib/orders/submit.ts calls nextval on it inside the transaction).
--
-- Every row of the output is a check. Read the STATUS column; anything that is
-- not PASS needs attention before you trust this database.
-- =============================================================================

WITH
-- 1. All 22 application tables present -----------------------------------------
expected_tables(name) AS (
  VALUES ('admin_users'),('audit_logs'),('categories'),('colors'),
         ('communication_logs'),('customers'),('email_logs'),('frames'),
         ('materials'),('order_files'),('order_items'),('order_status_history'),
         ('orders'),('product_colors'),('product_images'),('product_sizes'),
         ('product_variants'),('production_methods'),('products'),
         ('rate_limit_buckets'),('settings'),('sizes')
),
table_check AS (
  SELECT
    '1. Tables present' AS check_name,
    CASE WHEN count(*) FILTER (WHERE t.table_name IS NULL) = 0
         THEN 'PASS' ELSE 'FAIL' END AS status,
    count(*) FILTER (WHERE t.table_name IS NOT NULL) || ' of 22 present'
      || COALESCE(', MISSING: ' || string_agg(e.name, ', ') FILTER (WHERE t.table_name IS NULL), '')
      AS detail
  FROM expected_tables e
  LEFT JOIN information_schema.tables t
    ON t.table_schema = 'public' AND t.table_name = e.name
),

-- 2. order_ref_seq exists ------------------------------------------------------
-- The single most likely thing to be silently lost in a restore, and the one
-- that breaks order submission outright.
seq_exists AS (
  SELECT
    '2. order_ref_seq exists' AS check_name,
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'CRITICAL FAIL' END AS status,
    CASE WHEN count(*) = 1
         THEN 'present'
         ELSE 'MISSING — order submission will fail. Fix: CREATE SEQUENCE "order_ref_seq" START 1001;'
    END AS detail
  FROM pg_class WHERE relkind = 'S' AND relname = 'order_ref_seq'
),

-- 3. order_ref_seq is ahead of the highest existing ref -------------------------
-- A restored sequence that lags behind the data causes duplicate-key errors on
-- the orders.ref unique constraint the moment someone places an order.
seq_position AS (
  SELECT
    '3. order_ref_seq ahead of max(ref)' AS check_name,
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='S' AND relname='order_ref_seq')
        THEN 'SKIPPED'
      WHEN (SELECT count(*) FROM orders) = 0 THEN 'PASS'
      WHEN (SELECT last_value FROM order_ref_seq)
           >= (SELECT max(NULLIF(regexp_replace(ref, '\D', '', 'g'), '')::bigint) FROM orders)
        THEN 'PASS'
      ELSE 'CRITICAL FAIL'
    END AS status,
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='S' AND relname='order_ref_seq')
        THEN 'sequence missing — see check 2'
      WHEN (SELECT count(*) FROM orders) = 0
        THEN 'no orders yet; sequence at ' || (SELECT last_value FROM order_ref_seq)::text
      ELSE 'sequence=' || (SELECT last_value FROM order_ref_seq)::text
           || ', highest ref=' || COALESCE((SELECT max(NULLIF(regexp_replace(ref,'\D','','g'),'')::bigint) FROM orders)::text,'none')
           || CASE WHEN (SELECT last_value FROM order_ref_seq)
                        < COALESCE((SELECT max(NULLIF(regexp_replace(ref,'\D','','g'),'')::bigint) FROM orders),0)
                   THEN '  → FIX: SELECT setval(''order_ref_seq'', (SELECT max(NULLIF(regexp_replace(ref,''\D'','''',''g''),'''')::bigint) FROM orders));'
                   ELSE '' END
    END AS detail
),

-- 4. stock >= 0 CHECK constraint ------------------------------------------------
-- Also invisible to Prisma, also silently lost by a schema rebuild.
check_constraint AS (
  SELECT
    '4. stock non-negative CHECK' AS check_name,
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS status,
    CASE WHEN count(*) = 1 THEN 'present'
         ELSE 'MISSING — negative stock becomes possible. Fix: ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_stock_non_negative" CHECK ("stock" >= 0);'
    END AS detail
  FROM pg_constraint
  WHERE conname = 'product_variants_stock_non_negative'
),

-- 5. Row-Level Security still enabled -------------------------------------------
-- A restore into a fresh project does NOT carry RLS across by default. This is
-- how a recovered database quietly ends up world-readable (audit SEC-01).
rls_check AS (
  SELECT
    '5. RLS enabled on all tables' AS check_name,
    CASE WHEN count(*) FILTER (WHERE NOT c.relrowsecurity) = 0 THEN 'PASS' ELSE 'CRITICAL FAIL' END AS status,
    count(*) FILTER (WHERE c.relrowsecurity) || ' of ' || count(*) || ' protected'
      || COALESCE(' — UNPROTECTED: ' || string_agg(c.relname, ', ') FILTER (WHERE NOT c.relrowsecurity), '')
      AS detail
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
),

-- 6. Indexes ---------------------------------------------------------------------
index_check AS (
  SELECT
    '6. Indexes present' AS check_name,
    CASE WHEN count(*) >= 39 THEN 'PASS' ELSE 'WARN' END AS status,
    count(*) || ' indexes (expect >= 39 after the add_missing_indexes migration)' AS detail
  FROM pg_indexes WHERE schemaname = 'public'
),

-- 7. Settings singleton ----------------------------------------------------------
-- Holds the WhatsApp number and contact email read by the storefront AND by
-- order confirmation emails. An empty settings table means customers are told
-- to contact nobody.
settings_check AS (
  SELECT
    '7. Settings singleton' AS check_name,
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS status,
    CASE WHEN count(*) = 1
         THEN 'present (whatsapp=' || COALESCE((SELECT whatsapp FROM settings LIMIT 1),'?') || ')'
         ELSE 'MISSING — run the seed SQL; storefront contact details will be blank' END AS detail
  FROM settings
),

-- 8. Referential integrity spot-check ---------------------------------------------
-- Cheap orphan hunt across the relationships a partial restore would break.
orphan_check AS (
  SELECT
    '8. No orphaned rows' AS check_name,
    CASE WHEN (o_items + o_files + o_orders) = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
    'order_items→orders: ' || o_items ||
    ', order_files→orders: ' || o_files ||
    ', orders→customers: ' || o_orders AS detail
  FROM (
    SELECT
      (SELECT count(*) FROM order_items oi LEFT JOIN orders o ON o.id = oi."orderId" WHERE o.id IS NULL) AS o_items,
      (SELECT count(*) FROM order_files f LEFT JOIN orders o ON o.id = f."orderId" WHERE o.id IS NULL) AS o_files,
      (SELECT count(*) FROM orders o LEFT JOIN customers c ON c.id = o."customerId" WHERE c.id IS NULL) AS o_orders
  ) q
),

-- 9. Data volumes -----------------------------------------------------------------
-- Not pass/fail — compare against what you expect. A restore that "succeeded"
-- with zero orders is the one you need to catch here.
volume_check AS (
  SELECT
    '9. Row counts' AS check_name,
    'INFO' AS status,
    'orders=' || (SELECT count(*) FROM orders) ||
    ', customers=' || (SELECT count(*) FROM customers) ||
    ', products=' || (SELECT count(*) FROM products) ||
    ', order_files=' || (SELECT count(*) FROM order_files) ||
    ', admin_users=' || (SELECT count(*) FROM admin_users) AS detail
),

-- 10. At least one active OWNER ----------------------------------------------------
-- Without one, nobody can manage admin users — an unrecoverable lockout that a
-- restore can cause by dropping a single row.
owner_check AS (
  SELECT
    '10. Active OWNER exists' AS check_name,
    CASE WHEN count(*) >= 1 THEN 'PASS' ELSE 'CRITICAL FAIL' END AS status,
    count(*) || ' active OWNER account(s)'
      || CASE WHEN count(*) = 0 THEN ' — nobody can administer users; re-create via scripts/create-owner.ts' ELSE '' END AS detail
  FROM admin_users WHERE role = 'OWNER' AND active
)

SELECT * FROM table_check
UNION ALL SELECT * FROM seq_exists
UNION ALL SELECT * FROM seq_position
UNION ALL SELECT * FROM check_constraint
UNION ALL SELECT * FROM rls_check
UNION ALL SELECT * FROM index_check
UNION ALL SELECT * FROM settings_check
UNION ALL SELECT * FROM orphan_check
UNION ALL SELECT * FROM volume_check
UNION ALL SELECT * FROM owner_check
ORDER BY check_name;
