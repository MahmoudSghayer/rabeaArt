-- =============================================================================
-- Rabea.art — Row-Level Security lockdown
--
-- WHY THIS EXISTS
--
-- Every table in this database currently has RLS disabled. The application itself is safe:
-- the browser never talks to Postgres, all data access goes through Prisma server-side, and
-- Supabase Storage is only ever touched with the service-role key from Route Handlers.
--
-- But RLS does not defend against *this app* — it defends against anyone holding the anon key.
-- The anon key is public by construction: it ships inside the JavaScript bundle of
-- /admin/login. So the moment the site launches (COMING_SOON=0), anyone can extract it and,
-- if the Data API is enabled while RLS is off, read every table directly:
--
--   curl 'https://<project-ref>.supabase.co/rest/v1/customers?select=*' \
--        -H "apikey: <anon key from the page source>"
--
-- That returns every customer name, phone, WhatsApp number, email and street address.
-- Supabase's own linter flags exactly this as "RLS disabled in public".
--
-- WHAT THIS SCRIPT DOES
--
-- Enables RLS on all 22 tables and creates NO policies. In Postgres, RLS-enabled with no
-- policy means "deny all" for ordinary roles — so `anon` and `authenticated` (i.e. PostgREST)
-- can read nothing, while the app is completely unaffected because Prisma connects as the
-- `postgres` superuser, and superusers bypass RLS.
--
-- Deliberately NOT using FORCE ROW LEVEL SECURITY: FORCE applies RLS even to the table owner,
-- which would break the application's own connection. ENABLE is what you want here.
--
-- SAFETY
--
-- Non-destructive: no data is read, written or dropped. Idempotent: re-running is a no-op.
-- Reversible: see the ROLLBACK block at the bottom.
--
-- HOW TO RUN
--
--   Supabase Dashboard -> SQL Editor -> paste -> Run.
--
-- AFTER RUNNING, VERIFY (both steps — belt and braces):
--
--   1. The verification query at the end of this file must report rls_enabled = true for all 22.
--   2. From a machine with no credentials, confirm the Data API is now closed:
--        curl 'https://<project-ref>.supabase.co/rest/v1/customers?select=*' \
--             -H "apikey: <anon key>"
--      Expect an empty array or a permission error — NOT customer rows.
--
-- ALSO DO THIS (independent of the SQL, and on its own sufficient):
--   Supabase Dashboard -> Settings -> API -> Exposed schemas: remove `public`.
--   PostgREST is entirely unused by this application, so exposing it buys nothing and is the
--   whole attack surface this script exists to close.
-- =============================================================================

BEGIN;

-- Admin / RBAC ---------------------------------------------------------------
ALTER TABLE "admin_users"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs"            ENABLE ROW LEVEL SECURITY;

-- Customers (highest-value PII: name, phone, whatsapp, email, full address) ---
ALTER TABLE "customers"             ENABLE ROW LEVEL SECURITY;

-- Orders ---------------------------------------------------------------------
ALTER TABLE "orders"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_items"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_files"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_status_history"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "communication_logs"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_logs"            ENABLE ROW LEVEL SECURITY;

-- Catalog --------------------------------------------------------------------
ALTER TABLE "categories"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_images"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_colors"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_sizes"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_variants"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "colors"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sizes"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "frames"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "materials"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "production_methods"    ENABLE ROW LEVEL SECURITY;

-- Operational ----------------------------------------------------------------
ALTER TABLE "rate_limit_buckets"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "settings"              ENABLE ROW LEVEL SECURITY;

COMMIT;

-- =============================================================================
-- VERIFICATION — every row must show rls_enabled = true, and policy_count = 0.
-- (policy_count = 0 is correct and intended: no policy means deny-all for anon.)
-- =============================================================================

SELECT
  c.relname                                   AS table_name,
  c.relrowsecurity                            AS rls_enabled,
  (SELECT count(*) FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = c.relname)            AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relrowsecurity ASC, c.relname;

-- Expect: 22 rows, every rls_enabled = t, every policy_count = 0.
-- Any row with rls_enabled = f is still world-readable through the Data API.

-- =============================================================================
-- ROLLBACK — only if the application demonstrably breaks (it should not; Prisma
-- connects as `postgres`, which bypasses RLS). Verify the DATABASE_URL role first:
--   SELECT current_user;   -- run through the app's own connection, expect: postgres
-- =============================================================================
--
-- BEGIN;
-- ALTER TABLE "admin_users"          DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "audit_logs"           DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "customers"            DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "orders"               DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "order_items"          DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "order_files"          DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "order_status_history" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "communication_logs"   DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "email_logs"           DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "categories"           DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "products"             DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "product_images"       DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "product_colors"       DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "product_sizes"        DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "product_variants"     DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "colors"               DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "sizes"                DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "frames"               DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "materials"            DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "production_methods"   DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "rate_limit_buckets"   DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "settings"             DISABLE ROW LEVEL SECURITY;
-- COMMIT;
