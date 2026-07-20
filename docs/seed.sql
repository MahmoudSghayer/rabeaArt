-- =============================================================================
-- Rabea.art — catalog seed (SQL port of prisma/seed.ts)
-- =============================================================================
--
-- WHAT THIS DOES
--   Seeds the fixed catalog: categories, colors, sizes, frames, materials,
--   production methods (custom-order wizard options), the 12 catalog products
--   (6 shirts + 6 paintings) with their colors/sizes/variants, and the single
--   Settings row. Every value below is ported 1:1 from prisma/seed.ts — do not
--   edit the data here without also updating seed.ts (and vice versa).
--
--   Intentionally NOT seeded: admin users, customers, orders. This script is
--   catalog + settings only and is safe to run against a live database.
--
-- WHEN TO RUN
--   AFTER the schema migration (prisma/migrations/0_init/migration.sql) has
--   already been applied to the target database. Paste this whole file into
--   the Supabase SQL Editor and run it.
--
-- IDEMPOTENCY
--   Every insert is `INSERT ... ON CONFLICT (<unique constraint columns>) DO
--   UPDATE/NOTHING`, keyed on the real unique constraints/indexes declared in
--   migration.sql (verified against that file — see the comment above each
--   section). Re-running this script updates existing rows in place; it never
--   creates duplicates. Every unique constraint used below actually exists in
--   migration.sql, so no `WHERE NOT EXISTS` fallback was needed anywhere.
--
--   IDs: Prisma's `id String @id @default(cuid())` columns have NO database
--   default (checked in migration.sql — no DEFAULT clause on any "id" TEXT
--   column except settings.id, which defaults to 1 and is supplied explicitly
--   anyway). New rows get `gen_random_uuid()::text`; existing rows keep their
--   current id because ON CONFLICT DO UPDATE never touches the id column.
--   Foreign keys are resolved by looking up the natural key (code/slug), never
--   hardcoded.
--
--   Timestamps: "updatedAt" columns on products/settings are NOT NULL with no
--   database default (Prisma's @updatedAt is applied client-side only) — this
--   script supplies now() explicitly on both insert and update. "createdAt"
--   columns (products) DO have DEFAULT CURRENT_TIMESTAMP in the DB, so they
--   are simply omitted from the insert column list and never touched on
--   update.
--
-- EXPECTED ROW COUNTS (see the report query at the bottom of this file)
--   categories 2 · colors 7 · sizes 10 · frames 3 · materials 3 ·
--   production_methods 15 · products 12 · product_colors 17 ·
--   product_variants 80 · product_sizes 16 · settings 1
-- =============================================================================

-- gen_random_uuid() is core Postgres since v13, but Supabase ships pgcrypto
-- too; enabling it defensively costs nothing and guards older Postgres forks.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

-- =============================================================================
-- 1. Categories  (unique constraint verified: categories_code_key ON (code))
-- =============================================================================
INSERT INTO "categories" ("id", "type", "code", "nameAr", "nameEn", "sortOrder", "active")
VALUES
  (gen_random_uuid()::text, 'SHIRT',    'shirts',    'قمصان', 'Shirts',    0, true),
  (gen_random_uuid()::text, 'PAINTING', 'paintings', 'لوحات', 'Paintings', 1, true)
ON CONFLICT ("code") DO UPDATE SET
  "type"      = EXCLUDED."type",
  "nameAr"    = EXCLUDED."nameAr",
  "nameEn"    = EXCLUDED."nameEn",
  "sortOrder" = EXCLUDED."sortOrder";

-- =============================================================================
-- 2. Colors  (unique constraint verified: colors_code_key ON (code))
-- =============================================================================
INSERT INTO "colors" ("id", "code", "nameAr", "nameEn", "hex", "sortOrder", "active")
VALUES
  (gen_random_uuid()::text, 'sand',  'رملي',        'Sand',       '#E6D8BF', 0, true),
  (gen_random_uuid()::text, 'cream', 'كريمي',       'Cream',      '#F2EADA', 1, true),
  (gen_random_uuid()::text, 'ink',   'حبري',        'Ink',        '#2A2620', 2, true),
  (gen_random_uuid()::text, 'clay',  'طيني',        'Clay',       '#B7472A', 3, true),
  (gen_random_uuid()::text, 'olive', 'زيتوني',      'Olive',      '#5C6B4D', 4, true),
  (gen_random_uuid()::text, 'teal',  'بترولي',      'Teal',       '#33605A', 5, true),
  (gen_random_uuid()::text, 'rose',  'وردي مغبر',   'Dusty rose', '#C89A8E', 6, true)
ON CONFLICT ("code") DO UPDATE SET
  "nameAr"    = EXCLUDED."nameAr",
  "nameEn"    = EXCLUDED."nameEn",
  "hex"       = EXCLUDED."hex",
  "sortOrder" = EXCLUDED."sortOrder";

-- =============================================================================
-- 3. Sizes  (unique constraint verified: sizes_scope_code_key ON (scope, code))
--    6 SHIRT-scope sizes (XS..XXL) + 4 PAINTING-scope sizes (A5, A4, A3, custom).
-- =============================================================================
INSERT INTO "sizes" ("id", "scope", "code", "labelAr", "labelEn", "sortOrder", "active")
VALUES
  (gen_random_uuid()::text, 'SHIRT',    'XS',     'XS',          'XS',           0, true),
  (gen_random_uuid()::text, 'SHIRT',    'S',      'S',           'S',            1, true),
  (gen_random_uuid()::text, 'SHIRT',    'M',      'M',           'M',            2, true),
  (gen_random_uuid()::text, 'SHIRT',    'L',      'L',           'L',            3, true),
  (gen_random_uuid()::text, 'SHIRT',    'XL',     'XL',          'XL',           4, true),
  (gen_random_uuid()::text, 'SHIRT',    'XXL',    'XXL',         'XXL',          5, true),
  (gen_random_uuid()::text, 'PAINTING', 'A5',     'A5',          'A5',           0, true),
  (gen_random_uuid()::text, 'PAINTING', 'A4',     'A4',          'A4',           1, true),
  (gen_random_uuid()::text, 'PAINTING', 'A3',     'A3',          'A3',           2, true),
  (gen_random_uuid()::text, 'PAINTING', 'custom', 'مقاس خاص',    'Custom size',  3, true)
ON CONFLICT ("scope", "code") DO UPDATE SET
  "labelAr"   = EXCLUDED."labelAr",
  "labelEn"   = EXCLUDED."labelEn",
  "sortOrder" = EXCLUDED."sortOrder";

-- =============================================================================
-- 4. Frames  (unique constraint verified: frames_code_key ON (code))
--    Standalone lookup table for the custom-order wizard — no product FK.
-- =============================================================================
INSERT INTO "frames" ("id", "code", "labelAr", "labelEn", "add", "active", "sortOrder")
VALUES
  (gen_random_uuid()::text, 'none',  'بدون إطار',        'No frame',           0,  true, 0),
  (gen_random_uuid()::text, 'wood',  'إطار خشب طبيعي',   'Natural wood frame', 60, true, 1),
  (gen_random_uuid()::text, 'black', 'إطار معدني أسود',  'Black metal frame',  80, true, 2)
ON CONFLICT ("code") DO UPDATE SET
  "labelAr"   = EXCLUDED."labelAr",
  "labelEn"   = EXCLUDED."labelEn",
  "add"       = EXCLUDED."add",
  "sortOrder" = EXCLUDED."sortOrder";

-- =============================================================================
-- 5. Materials  (unique constraint verified: materials_code_key ON (code))
--    Standalone lookup table for the custom-order wizard — no product FK.
-- =============================================================================
INSERT INTO "materials" ("id", "code", "labelAr", "labelEn", "active", "sortOrder")
VALUES
  (gen_random_uuid()::text, 'canvas', 'قماش كانفس', 'Canvas',         true, 0),
  (gen_random_uuid()::text, 'paper',  'ورق فني',    'Fine-art paper', true, 1),
  (gen_random_uuid()::text, 'wood',   'لوح خشبي',   'Wood panel',     true, 2)
ON CONFLICT ("code") DO UPDATE SET
  "labelAr"   = EXCLUDED."labelAr",
  "labelEn"   = EXCLUDED."labelEn",
  "sortOrder" = EXCLUDED."sortOrder";

-- =============================================================================
-- 6. Production methods  (unique constraint verified:
--    production_methods_scope_code_key ON (scope, code))
--    5 scopes, 15 rows total. sortOrder resets to 0 at the start of each scope,
--    matching seed.ts's per-group index.
-- =============================================================================
INSERT INTO "production_methods" ("id", "scope", "code", "labelAr", "labelEn", "active", "sortOrder")
VALUES
  (gen_random_uuid()::text, 'shirt-method',   'print',      'طباعة',                    'Printing',                true, 0),
  (gen_random_uuid()::text, 'shirt-method',   'embroidery', 'تطريز',                    'Embroidery',              true, 1),

  (gen_random_uuid()::text, 'placement',      'front',      'الأمام',                   'Front',                   true, 0),
  (gen_random_uuid()::text, 'placement',      'back',       'الخلف',                    'Back',                    true, 1),
  (gen_random_uuid()::text, 'placement',      'sleeve',     'الكُم',                     'Sleeve',                  true, 2),

  (gen_random_uuid()::text, 'painting-style', 'printed',    'صورة مطبوعة',              'Printed image',           true, 0),
  (gen_random_uuid()::text, 'painting-style', 'hand',       'لوحة مرسومة يدويًا',        'Hand-painted',            true, 1),
  (gen_random_uuid()::text, 'painting-style', 'interpret',  'معالجة فنية بلمسة ربيع',    'Artistic interpretation', true, 2),

  (gen_random_uuid()::text, 'orientation',    'portrait',   'طولي',                     'Portrait',                true, 0),
  (gen_random_uuid()::text, 'orientation',    'landscape',  'عرضي',                     'Landscape',               true, 1),
  (gen_random_uuid()::text, 'orientation',    'square',     'مربع',                     'Square',                  true, 2),

  (gen_random_uuid()::text, 'shirt-type',     'classic',    'قصة كلاسيكية',             'Classic fit',             true, 0),
  (gen_random_uuid()::text, 'shirt-type',     'oversized',  'قصة واسعة',                'Oversized',               true, 1),
  (gen_random_uuid()::text, 'shirt-type',     'longsleeve', 'كم طويل',                  'Long sleeve',             true, 2),
  (gen_random_uuid()::text, 'shirt-type',     'hoodie',     'هودي',                     'Hoodie',                  true, 3)
ON CONFLICT ("scope", "code") DO UPDATE SET
  "labelAr"   = EXCLUDED."labelAr",
  "labelEn"   = EXCLUDED."labelEn",
  "sortOrder" = EXCLUDED."sortOrder";

-- =============================================================================
-- 7. Products — shirts  (unique constraint verified: products_slug_key ON (slug))
--    categoryId resolved via subquery on categories.code — never hardcoded.
--    All shirts: trackStock = true (including sh-bird, whose stock is 0 —
--    tracking must stay on so it correctly reads as out-of-stock).
-- =============================================================================
INSERT INTO "products" (
  "id", "slug", "type", "categoryId", "nameAr", "nameEn", "descAr", "descEn",
  "price", "sale", "featured", "trackStock", "printAvailable", "embroideryAvailable",
  "isOriginal", "artistNoteAr", "artistNoteEn", "prepAr", "prepEn", "displayOrder", "updatedAt"
)
VALUES
  (gen_random_uuid()::text, 'sh-dawn', 'SHIRT', (SELECT "id" FROM "categories" WHERE "code" = 'shirts'),
   'قميص «خيوط الفجر»', '“Dawn Threads” Shirt',
   'خطوط شروق مطرّزة يدويًا على قطن ثقيل — قطعة هادئة تحمل دفء الصباح.',
   'Hand-embroidered sunrise lines on heavy cotton — a quiet piece that carries morning warmth.',
   150, 120, true, true, true, true, false, NULL, NULL,
   '3–5 أيام عمل', '3–5 working days', 0, now()),

  (gen_random_uuid()::text, 'sh-wave', 'SHIRT', (SELECT "id" FROM "categories" WHERE "code" = 'shirts'),
   'قميص «موجة»', '“Wave” Shirt',
   'طباعة مائية متدرجة مستوحاة من بحر الظهيرة، على قصة واسعة مريحة.',
   'A tidal gradient print inspired by the midday sea, on a relaxed oversized cut.',
   130, NULL, true, true, true, false, false, NULL, NULL,
   '2–4 أيام عمل', '2–4 working days', 1, now()),

  (gen_random_uuid()::text, 'sh-letters', 'SHIRT', (SELECT "id" FROM "categories" WHERE "code" = 'shirts'),
   'قميص «حروف»', '“Letters” Shirt',
   'حروفية عربية مطرّزة بخيط حريري — كل قطعة تُنفَّذ عند الطلب.',
   'Arabic letterforms embroidered in silk thread — each piece made to order.',
   185, NULL, true, true, false, true, false, NULL, NULL,
   '5–7 أيام عمل', '5–7 working days', 2, now()),

  (gen_random_uuid()::text, 'sh-garden', 'SHIRT', (SELECT "id" FROM "categories" WHERE "code" = 'shirts'),
   'هودي «حديقة الليل»', '“Night Garden” Hoodie',
   'نباتات ليلية بطباعة كثيفة الألوان على هودي قطني دافئ.',
   'Nocturnal botanicals in a dense print on a warm cotton hoodie.',
   240, 210, false, true, true, true, false, NULL, NULL,
   '4–6 أيام عمل', '4–6 working days', 3, now()),

  (gen_random_uuid()::text, 'sh-poem', 'SHIRT', (SELECT "id" FROM "categories" WHERE "code" = 'shirts'),
   'قميص «قصيدة»', '“Poem” Pocket Shirt',
   'بيت شعر صغير فوق الجيب، بطباعة أو تطريز — اختر كلماتك في الملاحظات.',
   'A small verse above the pocket, printed or embroidered — leave your words in the notes.',
   140, NULL, false, true, true, true, false, NULL, NULL,
   '3–5 أيام عمل', '3–5 working days', 4, now()),

  (gen_random_uuid()::text, 'sh-bird', 'SHIRT', (SELECT "id" FROM "categories" WHERE "code" = 'shirts'),
   'قميص «طير» بكم طويل', '“Bird” Long-sleeve',
   'طائر واحد يحلّق على الكم — تفصيلة صغيرة تلفت النظر.',
   'A single bird gliding along the sleeve — a small detail that catches the eye.',
   160, NULL, false, true, true, true, false, NULL, NULL,
   '3–5 أيام عمل', '3–5 working days', 5, now())
ON CONFLICT ("slug") DO UPDATE SET
  "type"                = EXCLUDED."type",
  "categoryId"          = EXCLUDED."categoryId",
  "nameAr"              = EXCLUDED."nameAr",
  "nameEn"              = EXCLUDED."nameEn",
  "descAr"              = EXCLUDED."descAr",
  "descEn"              = EXCLUDED."descEn",
  "price"               = EXCLUDED."price",
  "sale"                = EXCLUDED."sale",
  "featured"            = EXCLUDED."featured",
  "trackStock"          = EXCLUDED."trackStock",
  "printAvailable"      = EXCLUDED."printAvailable",
  "embroideryAvailable" = EXCLUDED."embroideryAvailable",
  "isOriginal"          = EXCLUDED."isOriginal",
  "artistNoteAr"        = EXCLUDED."artistNoteAr",
  "artistNoteEn"        = EXCLUDED."artistNoteEn",
  "prepAr"              = EXCLUDED."prepAr",
  "prepEn"              = EXCLUDED."prepEn",
  "displayOrder"        = EXCLUDED."displayOrder",
  "updatedAt"           = now();

-- =============================================================================
-- 8. Products — paintings  (same unique constraint: products_slug_key)
--    price/sale stay NULL (paintings are priced per-size via product_sizes).
--    trackStock/printAvailable/embroideryAvailable are false for all paintings.
-- =============================================================================
INSERT INTO "products" (
  "id", "slug", "type", "categoryId", "nameAr", "nameEn", "descAr", "descEn",
  "price", "sale", "featured", "trackStock", "printAvailable", "embroideryAvailable",
  "isOriginal", "artistNoteAr", "artistNoteEn", "prepAr", "prepEn", "displayOrder", "updatedAt"
)
VALUES
  (gen_random_uuid()::text, 'pa-rivers', 'PAINTING', (SELECT "id" FROM "categories" WHERE "code" = 'paintings'),
   '«بين النهرين»', '“Between Two Rivers”',
   'أكريليك على كانفس — طبقات من الأصفر الترابي تلتقي بخضرة عميقة.',
   'Acrylic on canvas — layers of earthen gold meeting deep green.',
   NULL, NULL, true, false, false, false, true,
   'رسمتها بعد رحلة طويلة على ضفة النهر؛ أردت أن يبقى صوت الماء في اللون.',
   'Painted after a long walk along the river; I wanted the water’s sound to stay in the colour.',
   'أصلية: جاهزة للشحن · نسخ: 3–5 أيام', 'Original: ready to ship · Prints: 3–5 days', 6, now()),

  (gen_random_uuid()::text, 'pa-still', 'PAINTING', (SELECT "id" FROM "categories" WHERE "code" = 'paintings'),
   '«سكون»', '“Stillness”',
   'نسخة فنية بدرجات هادئة — تناسب غرف النوم وزوايا القراءة.',
   'A fine-art print in quiet tones — made for bedrooms and reading corners.',
   NULL, NULL, true, false, false, false, false,
   'أقرب لوحاتي إلى الصمت.',
   'The closest of my paintings to silence.',
   '3–5 أيام عمل', '3–5 working days', 7, now()),

  (gen_random_uuid()::text, 'pa-city', 'PAINTING', (SELECT "id" FROM "categories" WHERE "code" = 'paintings'),
   '«مدينة قديمة»', '“Old City”',
   'حبر وذهب على ورق — أزقّة تتذكرها الأصابع قبل العين.',
   'Ink and gold on paper — alleys the fingers remember before the eyes.',
   NULL, NULL, true, false, false, false, true,
   'كل خط في هذه اللوحة مشيته مرة على الأقل.',
   'Every line in this piece is a street I have walked at least once.',
   'أصلية: جاهزة للشحن', 'Original: ready to ship', 8, now()),

  (gen_random_uuid()::text, 'pa-saffron', 'PAINTING', (SELECT "id" FROM "categories" WHERE "code" = 'paintings'),
   '«زعفران»', '“Saffron”',
   'تجريد دافئ بلون التوابل — قطعة تضيء الجدار الرمادي.',
   'A warm spice-toned abstract — a piece that lights up a grey wall.',
   NULL, NULL, false, false, false, false, false,
   'لوّنتها بما تبقّى من غروبٍ رأيته من نافذة المرسم.',
   'Coloured with what remained of a sunset seen from the studio window.',
   '3–5 أيام عمل', '3–5 working days', 9, now()),

  (gen_random_uuid()::text, 'pa-sea', 'PAINTING', (SELECT "id" FROM "categories" WHERE "code" = 'paintings'),
   '«بحر الظهيرة»', '“Noon Sea”',
   'موجة واحدة طويلة بدرجات البترولي — تُطبع أو تُرسم بالمقاس الذي تريد.',
   'One long wave in petrol tones — printed or painted at the size you need.',
   NULL, NULL, false, false, false, false, false,
   'البحر في الظهيرة لا يشبه نفسه في أي وقت آخر.',
   'The sea at noon resembles itself at no other hour.',
   '3–5 أيام عمل', '3–5 working days', 10, now()),

  (gen_random_uuid()::text, 'pa-letter', 'PAINTING', (SELECT "id" FROM "categories" WHERE "code" = 'paintings'),
   '«رسالة»', '“The Letter”',
   'وسائط مختلطة على ورق قطني — نصف كلمة، نصف لون.',
   'Mixed media on cotton paper — half word, half colour.',
   NULL, NULL, false, false, false, false, true,
   'كتبتُ ثم محوت، وبقي الأثر أجمل من الجملة.',
   'I wrote, then erased; the trace stayed lovelier than the sentence.',
   'أصلية: جاهزة للشحن', 'Original: ready to ship', 11, now())
ON CONFLICT ("slug") DO UPDATE SET
  "type"                = EXCLUDED."type",
  "categoryId"          = EXCLUDED."categoryId",
  "nameAr"              = EXCLUDED."nameAr",
  "nameEn"              = EXCLUDED."nameEn",
  "descAr"              = EXCLUDED."descAr",
  "descEn"              = EXCLUDED."descEn",
  "price"               = EXCLUDED."price",
  "sale"                = EXCLUDED."sale",
  "featured"            = EXCLUDED."featured",
  "trackStock"          = EXCLUDED."trackStock",
  "printAvailable"      = EXCLUDED."printAvailable",
  "embroideryAvailable" = EXCLUDED."embroideryAvailable",
  "isOriginal"          = EXCLUDED."isOriginal",
  "artistNoteAr"        = EXCLUDED."artistNoteAr",
  "artistNoteEn"        = EXCLUDED."artistNoteEn",
  "prepAr"              = EXCLUDED."prepAr",
  "prepEn"              = EXCLUDED."prepEn",
  "displayOrder"        = EXCLUDED."displayOrder",
  "updatedAt"           = now();

-- =============================================================================
-- 9. Product colors — shirts only  (17 rows)
--    Composite primary key product_colors_pkey ON (productId, colorId) has no
--    other columns, so ON CONFLICT DO NOTHING is fully idempotent here.
-- =============================================================================
INSERT INTO "product_colors" ("productId", "colorId")
SELECT p."id", c."id"
FROM (VALUES
  ('sh-dawn',    'sand'),
  ('sh-dawn',    'ink'),
  ('sh-dawn',    'clay'),
  ('sh-wave',    'cream'),
  ('sh-wave',    'teal'),
  ('sh-wave',    'ink'),
  ('sh-letters', 'ink'),
  ('sh-letters', 'olive'),
  ('sh-letters', 'sand'),
  ('sh-garden',  'ink'),
  ('sh-garden',  'olive'),
  ('sh-poem',    'cream'),
  ('sh-poem',    'rose'),
  ('sh-poem',    'sand'),
  ('sh-bird',    'sand'),
  ('sh-bird',    'teal'),
  ('sh-bird',    'cream')
) AS t(slug, color_code)
JOIN "products" p ON p."slug" = t.slug
JOIN "colors" c ON c."code" = t.color_code
ON CONFLICT ("productId", "colorId") DO NOTHING;

-- =============================================================================
-- 10. Product variants — shirts only  (80 rows)
--     unique constraint verified: product_variants_productId_colorId_sizeId_key
--     ON (productId, colorId, sizeId).
--
--     Reproduces seed.ts's distributeStock(): for each shirt, one variant per
--     (color x size) combo — colors as the outer loop, sizes as the inner loop,
--     matching def.colors.flatMap(color => def.sizes.map(...)). stock =
--     floor(total / comboCount), remainder added to the FIRST combo
--     (colors[0] x sizes[0]). All variants active = true.
--
--     Per-shirt distribution (verify against seed.ts's SHIRT_PRODUCTS):
--       sh-dawn    : 3 colors x 6 sizes = 18 variants, stock 12 -> (sand,XS)=12, rest 0
--       sh-wave    : 3 colors x 4 sizes = 12 variants, stock  8 -> (cream,S)=8, rest 0
--       sh-letters : 3 colors x 5 sizes = 15 variants, stock  5 -> (ink,S)=5, rest 0
--       sh-garden  : 2 colors x 4 sizes =  8 variants, stock  6 -> (ink,M)=6, rest 0
--       sh-poem    : 3 colors x 5 sizes = 15 variants, stock 10 -> (cream,XS)=10, rest 0
--       sh-bird    : 3 colors x 4 sizes = 12 variants, stock  0 -> all 0
--       total: 18+12+15+8+15+12 = 80 variants
-- =============================================================================
DO $$
DECLARE
  v_defs JSONB := '[
    {"slug":"sh-dawn",    "colors":["sand","ink","clay"],   "sizes":["XS","S","M","L","XL","XXL"], "stock":12},
    {"slug":"sh-wave",    "colors":["cream","teal","ink"],  "sizes":["S","M","L","XL"],            "stock":8},
    {"slug":"sh-letters", "colors":["ink","olive","sand"],  "sizes":["S","M","L","XL","XXL"],      "stock":5},
    {"slug":"sh-garden",  "colors":["ink","olive"],         "sizes":["M","L","XL","XXL"],          "stock":6},
    {"slug":"sh-poem",    "colors":["cream","rose","sand"], "sizes":["XS","S","M","L","XL"],       "stock":10},
    {"slug":"sh-bird",    "colors":["sand","teal","cream"], "sizes":["S","M","L","XL"],            "stock":0}
  ]'::jsonb;
  v_def JSONB;
  v_product_id TEXT;
  v_color_codes TEXT[];
  v_size_codes TEXT[];
  v_stock INT;
  v_combo_count INT;
  v_base INT;
  v_remainder INT;
  v_idx INT;
  v_color_code TEXT;
  v_size_code TEXT;
  v_variant_stock INT;
BEGIN
  FOR v_def IN SELECT * FROM jsonb_array_elements(v_defs)
  LOOP
    SELECT "id" INTO v_product_id FROM "products" WHERE "slug" = v_def->>'slug';
    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'seed.sql: product % not found while generating variants — run section 7 first', v_def->>'slug';
    END IF;

    SELECT array_agg(elem ORDER BY ord) INTO v_color_codes
    FROM jsonb_array_elements_text(v_def->'colors') WITH ORDINALITY AS t(elem, ord);

    SELECT array_agg(elem ORDER BY ord) INTO v_size_codes
    FROM jsonb_array_elements_text(v_def->'sizes') WITH ORDINALITY AS t(elem, ord);

    v_stock := (v_def->>'stock')::INT;
    v_combo_count := array_length(v_color_codes, 1) * array_length(v_size_codes, 1);
    v_base := v_stock / v_combo_count;              -- integer division = floor() for non-negative ints
    v_remainder := v_stock - v_base * v_combo_count;
    v_idx := 0;

    FOREACH v_color_code IN ARRAY v_color_codes LOOP
      FOREACH v_size_code IN ARRAY v_size_codes LOOP
        v_variant_stock := CASE WHEN v_idx = 0 THEN v_base + v_remainder ELSE v_base END;

        INSERT INTO "product_variants" ("id", "productId", "colorId", "sizeId", "stock", "active")
        VALUES (
          gen_random_uuid()::text,
          v_product_id,
          (SELECT "id" FROM "colors" WHERE "code" = v_color_code),
          (SELECT "id" FROM "sizes" WHERE "scope" = 'SHIRT' AND "code" = v_size_code),
          v_variant_stock,
          true
        )
        ON CONFLICT ("productId", "colorId", "sizeId") DO UPDATE SET
          "stock"  = EXCLUDED."stock",
          "active" = EXCLUDED."active";

        v_idx := v_idx + 1;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- =============================================================================
-- 11. Product sizes — paintings only  (16 rows)
--     unique constraint verified: product_sizes_productId_sizeId_key
--     ON (productId, sizeId).
--
--     Rows come from each painting's `sizes` list, NOT merely from which price
--     keys exist — pa-rivers and pa-letter deliberately exclude A5 even though
--     a price is defined for it in seed.ts. "custom" never gets a row (manual
--     pricing, handled by the custom-order flow).
-- =============================================================================
INSERT INTO "product_sizes" ("id", "productId", "sizeId", "price")
SELECT gen_random_uuid()::text, p."id", s."id", t.price
FROM (VALUES
  ('pa-rivers',  'A4', 190::numeric),
  ('pa-rivers',  'A3', 320::numeric),
  ('pa-still',   'A5',  90::numeric),
  ('pa-still',   'A4', 150::numeric),
  ('pa-still',   'A3', 240::numeric),
  ('pa-city',    'A5', 110::numeric),
  ('pa-city',    'A4', 170::numeric),
  ('pa-city',    'A3', 280::numeric),
  ('pa-saffron', 'A5',  90::numeric),
  ('pa-saffron', 'A4', 150::numeric),
  ('pa-saffron', 'A3', 240::numeric),
  ('pa-sea',     'A5',  90::numeric),
  ('pa-sea',     'A4', 150::numeric),
  ('pa-sea',     'A3', 240::numeric),
  ('pa-letter',  'A4', 200::numeric),
  ('pa-letter',  'A3', 330::numeric)
) AS t(slug, size_code, price)
JOIN "products" p ON p."slug" = t.slug
JOIN "sizes" s ON s."scope" = 'PAINTING' AND s."code" = t.size_code
ON CONFLICT ("productId", "sizeId") DO UPDATE SET
  "price" = EXCLUDED."price";

-- =============================================================================
-- 12. Settings singleton  (unique constraint verified: settings_pkey ON (id))
-- =============================================================================
INSERT INTO "settings" (
  "id", "whatsapp", "email", "instagram",
  "announcementAr", "announcementEn", "announcementActive", "customOtherEnabled", "updatedAt"
)
VALUES (
  1, '+972 50 000 0000', 'hello@rabea.art', '@rab_eart',
  'الطلبات المخصصة مفتوحة هذا الشهر — التسليم قبل العيد مضمون للطلبات المؤكدة قبل ١٠ أيام.',
  'Custom orders are open this month — pre-holiday delivery guaranteed for orders confirmed 10 days ahead.',
  true, true, now()
)
ON CONFLICT ("id") DO UPDATE SET
  "whatsapp"           = EXCLUDED."whatsapp",
  "email"              = EXCLUDED."email",
  "instagram"          = EXCLUDED."instagram",
  "announcementAr"     = EXCLUDED."announcementAr",
  "announcementEn"     = EXCLUDED."announcementEn",
  "announcementActive" = EXCLUDED."announcementActive",
  "customOtherEnabled" = EXCLUDED."customOtherEnabled",
  "updatedAt"          = now();

COMMIT;

-- =============================================================================
-- 13. Verification — row counts per table (compare against the EXPECTED ROW
--     COUNTS comment at the top of this file)
-- =============================================================================
SELECT 'categories' AS "table", count(*) AS "rows" FROM "categories"
UNION ALL SELECT 'colors',             count(*) FROM "colors"
UNION ALL SELECT 'sizes',              count(*) FROM "sizes"
UNION ALL SELECT 'frames',             count(*) FROM "frames"
UNION ALL SELECT 'materials',          count(*) FROM "materials"
UNION ALL SELECT 'production_methods', count(*) FROM "production_methods"
UNION ALL SELECT 'products',           count(*) FROM "products"
UNION ALL SELECT 'product_colors',     count(*) FROM "product_colors"
UNION ALL SELECT 'product_variants',   count(*) FROM "product_variants"
UNION ALL SELECT 'product_sizes',      count(*) FROM "product_sizes"
UNION ALL SELECT 'settings',           count(*) FROM "settings"
ORDER BY 1;
