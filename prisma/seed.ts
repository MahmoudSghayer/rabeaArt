// Development/catalog seed — ports the placeholder data from _design-reference/store.js into
// real rows. Safe to re-run: master data (categories/colors/sizes/frames/materials/production
// methods) is upserted by its unique `code`, products are upserted by `slug`, and each
// product's child rows (colours/sizes/variants) are wiped and recreated from the definitions
// below so a changed colour/size list never leaves stale rows behind.
//
// Intentionally NOT seeded here: admin users (see scripts/create-owner.ts — real auth accounts
// only) and orders/customers (a production catalog seed must never carry fake order data).
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ProductType, SizeScope } from "@/generated/prisma/client";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DIRECT_URL (or DATABASE_URL) is not set — copy .env.example to .env and fill it in.");
}
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Master data (ported 1:1 from _design-reference/store.js)
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { code: "shirts", type: ProductType.SHIRT, nameAr: "قمصان", nameEn: "Shirts" },
  { code: "paintings", type: ProductType.PAINTING, nameAr: "لوحات", nameEn: "Paintings" },
] as const;

const COLORS = [
  { code: "sand", nameAr: "رملي", nameEn: "Sand", hex: "#E6D8BF" },
  { code: "cream", nameAr: "كريمي", nameEn: "Cream", hex: "#F2EADA" },
  { code: "ink", nameAr: "حبري", nameEn: "Ink", hex: "#2A2620" },
  { code: "clay", nameAr: "طيني", nameEn: "Clay", hex: "#B7472A" },
  { code: "olive", nameAr: "زيتوني", nameEn: "Olive", hex: "#5C6B4D" },
  { code: "teal", nameAr: "بترولي", nameEn: "Teal", hex: "#33605A" },
  { code: "rose", nameAr: "وردي مغبر", nameEn: "Dusty rose", hex: "#C89A8E" },
] as const;

const SHIRT_SIZE_CODES = ["XS", "S", "M", "L", "XL", "XXL"] as const;

const PAINTING_SIZES = [
  { code: "A5", labelAr: "A5", labelEn: "A5" },
  { code: "A4", labelAr: "A4", labelEn: "A4" },
  { code: "A3", labelAr: "A3", labelEn: "A3" },
  { code: "custom", labelAr: "مقاس خاص", labelEn: "Custom size" },
] as const;

const FRAMES = [
  { code: "none", labelAr: "بدون إطار", labelEn: "No frame", add: 0 },
  { code: "wood", labelAr: "إطار خشب طبيعي", labelEn: "Natural wood frame", add: 60 },
  { code: "black", labelAr: "إطار معدني أسود", labelEn: "Black metal frame", add: 80 },
] as const;

const MATERIALS = [
  { code: "canvas", labelAr: "قماش كانفس", labelEn: "Canvas" },
  { code: "paper", labelAr: "ورق فني", labelEn: "Fine-art paper" },
  { code: "wood", labelAr: "لوح خشبي", labelEn: "Wood panel" },
] as const;

/**
 * The generic managed-options store (ProductionMethod). None of these are linked to a specific
 * seeded product — they back the "custom order" wizard (shirt type, placement, method, painting
 * style, orientation), which lets a customer configure something outside the fixed catalog.
 */
const PRODUCTION_METHOD_SCOPES: Array<{ scope: string; items: ReadonlyArray<{ code: string; labelAr: string; labelEn: string }> }> = [
  {
    scope: "shirt-method",
    items: [
      { code: "print", labelAr: "طباعة", labelEn: "Printing" },
      { code: "embroidery", labelAr: "تطريز", labelEn: "Embroidery" },
    ],
  },
  {
    scope: "placement",
    items: [
      { code: "front", labelAr: "الأمام", labelEn: "Front" },
      { code: "back", labelAr: "الخلف", labelEn: "Back" },
      { code: "sleeve", labelAr: "الكُم", labelEn: "Sleeve" },
    ],
  },
  {
    scope: "painting-style",
    items: [
      { code: "printed", labelAr: "صورة مطبوعة", labelEn: "Printed image" },
      { code: "hand", labelAr: "لوحة مرسومة يدويًا", labelEn: "Hand-painted" },
      { code: "interpret", labelAr: "معالجة فنية بلمسة ربيع", labelEn: "Artistic interpretation" },
    ],
  },
  {
    scope: "orientation",
    items: [
      { code: "portrait", labelAr: "طولي", labelEn: "Portrait" },
      { code: "landscape", labelAr: "عرضي", labelEn: "Landscape" },
      { code: "square", labelAr: "مربع", labelEn: "Square" },
    ],
  },
  {
    scope: "shirt-type",
    items: [
      { code: "classic", labelAr: "قصة كلاسيكية", labelEn: "Classic fit" },
      { code: "oversized", labelAr: "قصة واسعة", labelEn: "Oversized" },
      { code: "longsleeve", labelAr: "كم طويل", labelEn: "Long sleeve" },
      { code: "hoodie", labelAr: "هودي", labelEn: "Hoodie" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Products (ported from SEED_PRODUCTS in _design-reference/store.js)
// ---------------------------------------------------------------------------

interface ShirtProductSeed {
  slug: string;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  price: number;
  sale: number | null;
  colors: string[];
  sizes: string[];
  stock: number;
  featured: boolean;
  print: boolean;
  embroidery: boolean;
  prepAr: string;
  prepEn: string;
}

const SHIRT_PRODUCTS: ShirtProductSeed[] = [
  {
    slug: "sh-dawn",
    nameAr: "قميص «خيوط الفجر»",
    nameEn: "“Dawn Threads” Shirt",
    descAr: "خطوط شروق مطرّزة يدويًا على قطن ثقيل — قطعة هادئة تحمل دفء الصباح.",
    descEn: "Hand-embroidered sunrise lines on heavy cotton — a quiet piece that carries morning warmth.",
    price: 150,
    sale: 120,
    colors: ["sand", "ink", "clay"],
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    stock: 12,
    featured: true,
    print: true,
    embroidery: true,
    prepAr: "3–5 أيام عمل",
    prepEn: "3–5 working days",
  },
  {
    slug: "sh-wave",
    nameAr: "قميص «موجة»",
    nameEn: "“Wave” Shirt",
    descAr: "طباعة مائية متدرجة مستوحاة من بحر الظهيرة، على قصة واسعة مريحة.",
    descEn: "A tidal gradient print inspired by the midday sea, on a relaxed oversized cut.",
    price: 130,
    sale: null,
    colors: ["cream", "teal", "ink"],
    sizes: ["S", "M", "L", "XL"],
    stock: 8,
    featured: true,
    print: true,
    embroidery: false,
    prepAr: "2–4 أيام عمل",
    prepEn: "2–4 working days",
  },
  {
    slug: "sh-letters",
    nameAr: "قميص «حروف»",
    nameEn: "“Letters” Shirt",
    descAr: "حروفية عربية مطرّزة بخيط حريري — كل قطعة تُنفَّذ عند الطلب.",
    descEn: "Arabic letterforms embroidered in silk thread — each piece made to order.",
    price: 185,
    sale: null,
    colors: ["ink", "olive", "sand"],
    sizes: ["S", "M", "L", "XL", "XXL"],
    stock: 5,
    featured: true,
    print: false,
    embroidery: true,
    prepAr: "5–7 أيام عمل",
    prepEn: "5–7 working days",
  },
  {
    slug: "sh-garden",
    nameAr: "هودي «حديقة الليل»",
    nameEn: "“Night Garden” Hoodie",
    descAr: "نباتات ليلية بطباعة كثيفة الألوان على هودي قطني دافئ.",
    descEn: "Nocturnal botanicals in a dense print on a warm cotton hoodie.",
    price: 240,
    sale: 210,
    colors: ["ink", "olive"],
    sizes: ["M", "L", "XL", "XXL"],
    stock: 6,
    featured: false,
    print: true,
    embroidery: true,
    prepAr: "4–6 أيام عمل",
    prepEn: "4–6 working days",
  },
  {
    slug: "sh-poem",
    nameAr: "قميص «قصيدة»",
    nameEn: "“Poem” Pocket Shirt",
    descAr: "بيت شعر صغير فوق الجيب، بطباعة أو تطريز — اختر كلماتك في الملاحظات.",
    descEn: "A small verse above the pocket, printed or embroidered — leave your words in the notes.",
    price: 140,
    sale: null,
    colors: ["cream", "rose", "sand"],
    sizes: ["XS", "S", "M", "L", "XL"],
    stock: 10,
    featured: false,
    print: true,
    embroidery: true,
    prepAr: "3–5 أيام عمل",
    prepEn: "3–5 working days",
  },
  {
    slug: "sh-bird",
    nameAr: "قميص «طير» بكم طويل",
    nameEn: "“Bird” Long-sleeve",
    descAr: "طائر واحد يحلّق على الكم — تفصيلة صغيرة تلفت النظر.",
    descEn: "A single bird gliding along the sleeve — a small detail that catches the eye.",
    price: 160,
    sale: null,
    colors: ["sand", "teal", "cream"],
    sizes: ["S", "M", "L", "XL"],
    stock: 0,
    featured: false,
    print: true,
    embroidery: true,
    prepAr: "3–5 أيام عمل",
    prepEn: "3–5 working days",
  },
];

interface PaintingProductSeed {
  slug: string;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  artistNoteAr: string;
  artistNoteEn: string;
  isOriginal: boolean;
  /** Price per size code — only entries whose code also appears in `sizes` become ProductSize rows. */
  prices: Partial<Record<"A5" | "A4" | "A3", number>>;
  /** Sizes actually offered for this piece. May include "custom" (skipped — no ProductSize row; priced manually). */
  sizes: string[];
  featured: boolean;
  prepAr: string;
  prepEn: string;
}

const PAINTING_PRODUCTS: PaintingProductSeed[] = [
  {
    slug: "pa-rivers",
    nameAr: "«بين النهرين»",
    nameEn: "“Between Two Rivers”",
    descAr: "أكريليك على كانفس — طبقات من الأصفر الترابي تلتقي بخضرة عميقة.",
    descEn: "Acrylic on canvas — layers of earthen gold meeting deep green.",
    artistNoteAr: "رسمتها بعد رحلة طويلة على ضفة النهر؛ أردت أن يبقى صوت الماء في اللون.",
    artistNoteEn: "Painted after a long walk along the river; I wanted the water’s sound to stay in the colour.",
    isOriginal: true,
    prices: { A5: 120, A4: 190, A3: 320 },
    sizes: ["A4", "A3", "custom"],
    featured: true,
    prepAr: "أصلية: جاهزة للشحن · نسخ: 3–5 أيام",
    prepEn: "Original: ready to ship · Prints: 3–5 days",
  },
  {
    slug: "pa-still",
    nameAr: "«سكون»",
    nameEn: "“Stillness”",
    descAr: "نسخة فنية بدرجات هادئة — تناسب غرف النوم وزوايا القراءة.",
    descEn: "A fine-art print in quiet tones — made for bedrooms and reading corners.",
    artistNoteAr: "أقرب لوحاتي إلى الصمت.",
    artistNoteEn: "The closest of my paintings to silence.",
    isOriginal: false,
    prices: { A5: 90, A4: 150, A3: 240 },
    sizes: ["A5", "A4", "A3", "custom"],
    featured: true,
    prepAr: "3–5 أيام عمل",
    prepEn: "3–5 working days",
  },
  {
    slug: "pa-city",
    nameAr: "«مدينة قديمة»",
    nameEn: "“Old City”",
    descAr: "حبر وذهب على ورق — أزقّة تتذكرها الأصابع قبل العين.",
    descEn: "Ink and gold on paper — alleys the fingers remember before the eyes.",
    artistNoteAr: "كل خط في هذه اللوحة مشيته مرة على الأقل.",
    artistNoteEn: "Every line in this piece is a street I have walked at least once.",
    isOriginal: true,
    prices: { A5: 110, A4: 170, A3: 280 },
    sizes: ["A5", "A4", "A3"],
    featured: true,
    prepAr: "أصلية: جاهزة للشحن",
    prepEn: "Original: ready to ship",
  },
  {
    slug: "pa-saffron",
    nameAr: "«زعفران»",
    nameEn: "“Saffron”",
    descAr: "تجريد دافئ بلون التوابل — قطعة تضيء الجدار الرمادي.",
    descEn: "A warm spice-toned abstract — a piece that lights up a grey wall.",
    artistNoteAr: "لوّنتها بما تبقّى من غروبٍ رأيته من نافذة المرسم.",
    artistNoteEn: "Coloured with what remained of a sunset seen from the studio window.",
    isOriginal: false,
    prices: { A5: 90, A4: 150, A3: 240 },
    sizes: ["A5", "A4", "A3", "custom"],
    featured: false,
    prepAr: "3–5 أيام عمل",
    prepEn: "3–5 working days",
  },
  {
    slug: "pa-sea",
    nameAr: "«بحر الظهيرة»",
    nameEn: "“Noon Sea”",
    descAr: "موجة واحدة طويلة بدرجات البترولي — تُطبع أو تُرسم بالمقاس الذي تريد.",
    descEn: "One long wave in petrol tones — printed or painted at the size you need.",
    artistNoteAr: "البحر في الظهيرة لا يشبه نفسه في أي وقت آخر.",
    artistNoteEn: "The sea at noon resembles itself at no other hour.",
    isOriginal: false,
    prices: { A5: 90, A4: 150, A3: 240 },
    sizes: ["A5", "A4", "A3", "custom"],
    featured: false,
    prepAr: "3–5 أيام عمل",
    prepEn: "3–5 working days",
  },
  {
    slug: "pa-letter",
    nameAr: "«رسالة»",
    nameEn: "“The Letter”",
    descAr: "وسائط مختلطة على ورق قطني — نصف كلمة، نصف لون.",
    descEn: "Mixed media on cotton paper — half word, half colour.",
    artistNoteAr: "كتبتُ ثم محوت، وبقي الأثر أجمل من الجملة.",
    artistNoteEn: "I wrote, then erased; the trace stayed lovelier than the sentence.",
    isOriginal: true,
    prices: { A5: 130, A4: 200, A3: 330 },
    sizes: ["A4", "A3"],
    featured: false,
    prepAr: "أصلية: جاهزة للشحن",
    prepEn: "Original: ready to ship",
  },
];

// ---------------------------------------------------------------------------
// Seed steps
// ---------------------------------------------------------------------------

async function seedCategories(): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const [i, c] of CATEGORIES.entries()) {
    const row = await prisma.category.upsert({
      where: { code: c.code },
      update: { type: c.type, nameAr: c.nameAr, nameEn: c.nameEn, sortOrder: i },
      create: { code: c.code, type: c.type, nameAr: c.nameAr, nameEn: c.nameEn, sortOrder: i },
    });
    ids[c.code] = row.id;
  }
  console.log(`  categories: ${CATEGORIES.length}`);
  return ids;
}

async function seedColors(): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const [i, c] of COLORS.entries()) {
    const row = await prisma.color.upsert({
      where: { code: c.code },
      update: { nameAr: c.nameAr, nameEn: c.nameEn, hex: c.hex, sortOrder: i },
      create: { code: c.code, nameAr: c.nameAr, nameEn: c.nameEn, hex: c.hex, sortOrder: i },
    });
    ids[c.code] = row.id;
  }
  console.log(`  colors: ${COLORS.length}`);
  return ids;
}

async function seedSizes(): Promise<{ shirt: Record<string, string>; painting: Record<string, string> }> {
  const shirt: Record<string, string> = {};
  for (const [i, code] of SHIRT_SIZE_CODES.entries()) {
    const row = await prisma.size.upsert({
      where: { scope_code: { scope: SizeScope.SHIRT, code } },
      update: { labelAr: code, labelEn: code, sortOrder: i },
      create: { scope: SizeScope.SHIRT, code, labelAr: code, labelEn: code, sortOrder: i },
    });
    shirt[code] = row.id;
  }

  const painting: Record<string, string> = {};
  for (const [i, s] of PAINTING_SIZES.entries()) {
    const row = await prisma.size.upsert({
      where: { scope_code: { scope: SizeScope.PAINTING, code: s.code } },
      update: { labelAr: s.labelAr, labelEn: s.labelEn, sortOrder: i },
      create: { scope: SizeScope.PAINTING, code: s.code, labelAr: s.labelAr, labelEn: s.labelEn, sortOrder: i },
    });
    painting[s.code] = row.id;
  }

  console.log(`  sizes: ${SHIRT_SIZE_CODES.length + PAINTING_SIZES.length}`);
  return { shirt, painting };
}

async function seedFrames(): Promise<void> {
  for (const [i, f] of FRAMES.entries()) {
    await prisma.frame.upsert({
      where: { code: f.code },
      update: { labelAr: f.labelAr, labelEn: f.labelEn, add: f.add, sortOrder: i },
      create: { code: f.code, labelAr: f.labelAr, labelEn: f.labelEn, add: f.add, sortOrder: i },
    });
  }
  console.log(`  frames: ${FRAMES.length}`);
}

async function seedMaterials(): Promise<void> {
  for (const [i, m] of MATERIALS.entries()) {
    await prisma.material.upsert({
      where: { code: m.code },
      update: { labelAr: m.labelAr, labelEn: m.labelEn, sortOrder: i },
      create: { code: m.code, labelAr: m.labelAr, labelEn: m.labelEn, sortOrder: i },
    });
  }
  console.log(`  materials: ${MATERIALS.length}`);
}

async function seedProductionMethods(): Promise<void> {
  let count = 0;
  for (const group of PRODUCTION_METHOD_SCOPES) {
    for (const [i, item] of group.items.entries()) {
      await prisma.productionMethod.upsert({
        where: { scope_code: { scope: group.scope, code: item.code } },
        update: { labelAr: item.labelAr, labelEn: item.labelEn, sortOrder: i },
        create: { scope: group.scope, code: item.code, labelAr: item.labelAr, labelEn: item.labelEn, sortOrder: i },
      });
      count++;
    }
  }
  console.log(`  production methods: ${count}`);
}

/** Distributes `stock` across `variantCount` variants as evenly as possible, remainder on the first. */
function distributeStock(stock: number, variantCount: number): number[] {
  if (variantCount === 0) return [];
  const base = Math.floor(stock / variantCount);
  const remainder = stock - base * variantCount;
  return Array.from({ length: variantCount }, (_, i) => (i === 0 ? base + remainder : base));
}

async function seedShirtProduct(
  def: ShirtProductSeed,
  categoryId: string,
  displayOrder: number,
  colorIds: Record<string, string>,
  sizeIds: Record<string, string>,
): Promise<void> {
  const product = await prisma.product.upsert({
    where: { slug: def.slug },
    update: {
      type: ProductType.SHIRT,
      categoryId,
      nameAr: def.nameAr,
      nameEn: def.nameEn,
      descAr: def.descAr,
      descEn: def.descEn,
      price: def.price,
      sale: def.sale,
      featured: def.featured,
      trackStock: true,
      printAvailable: def.print,
      embroideryAvailable: def.embroidery,
      isOriginal: false,
      artistNoteAr: null,
      artistNoteEn: null,
      prepAr: def.prepAr,
      prepEn: def.prepEn,
      displayOrder,
    },
    create: {
      slug: def.slug,
      type: ProductType.SHIRT,
      categoryId,
      nameAr: def.nameAr,
      nameEn: def.nameEn,
      descAr: def.descAr,
      descEn: def.descEn,
      price: def.price,
      sale: def.sale,
      featured: def.featured,
      // All seeded shirts opt into stock tracking — including the out-of-stock "sh-bird" — so
      // its variants correctly report zero stock instead of silently reading as unlimited.
      trackStock: true,
      printAvailable: def.print,
      embroideryAvailable: def.embroidery,
      prepAr: def.prepAr,
      prepEn: def.prepEn,
      displayOrder,
    },
  });

  await prisma.productColor.deleteMany({ where: { productId: product.id } });
  await prisma.productColor.createMany({
    data: def.colors.map((code) => ({ productId: product.id, colorId: colorIds[code] })),
  });

  const combos = def.colors.flatMap((colorCode) => def.sizes.map((sizeCode) => ({ colorCode, sizeCode })));
  const stocks = distributeStock(def.stock, combos.length);
  await prisma.productVariant.deleteMany({ where: { productId: product.id } });
  await prisma.productVariant.createMany({
    data: combos.map((combo, i) => ({
      productId: product.id,
      colorId: colorIds[combo.colorCode],
      sizeId: sizeIds[combo.sizeCode],
      stock: stocks[i],
      active: true,
    })),
  });
}

async function seedPaintingProduct(
  def: PaintingProductSeed,
  categoryId: string,
  displayOrder: number,
  sizeIds: Record<string, string>,
): Promise<void> {
  const product = await prisma.product.upsert({
    where: { slug: def.slug },
    update: {
      type: ProductType.PAINTING,
      categoryId,
      nameAr: def.nameAr,
      nameEn: def.nameEn,
      descAr: def.descAr,
      descEn: def.descEn,
      price: null,
      sale: null,
      featured: def.featured,
      trackStock: false,
      printAvailable: false,
      embroideryAvailable: false,
      isOriginal: def.isOriginal,
      artistNoteAr: def.artistNoteAr,
      artistNoteEn: def.artistNoteEn,
      prepAr: def.prepAr,
      prepEn: def.prepEn,
      displayOrder,
    },
    create: {
      slug: def.slug,
      type: ProductType.PAINTING,
      categoryId,
      nameAr: def.nameAr,
      nameEn: def.nameEn,
      descAr: def.descAr,
      descEn: def.descEn,
      featured: def.featured,
      trackStock: false,
      isOriginal: def.isOriginal,
      artistNoteAr: def.artistNoteAr,
      artistNoteEn: def.artistNoteEn,
      prepAr: def.prepAr,
      prepEn: def.prepEn,
      displayOrder,
    },
  });

  // "custom" is manual pricing (no fixed price), so it never gets a ProductSize row — it's
  // handled entirely by the custom-order flow, not the fixed catalog price list.
  const offeredSizes = def.sizes.filter((code): code is "A5" | "A4" | "A3" => code !== "custom");

  await prisma.productSize.deleteMany({ where: { productId: product.id } });
  await prisma.productSize.createMany({
    data: offeredSizes.map((code) => ({
      productId: product.id,
      sizeId: sizeIds[code],
      price: def.prices[code]!,
    })),
  });
}

async function seedProducts(
  categoryIds: Record<string, string>,
  colorIds: Record<string, string>,
  sizeIds: { shirt: Record<string, string>; painting: Record<string, string> },
): Promise<void> {
  let displayOrder = 0;
  for (const def of SHIRT_PRODUCTS) {
    await seedShirtProduct(def, categoryIds.shirts, displayOrder, colorIds, sizeIds.shirt);
    displayOrder++;
  }
  for (const def of PAINTING_PRODUCTS) {
    await seedPaintingProduct(def, categoryIds.paintings, displayOrder, sizeIds.painting);
    displayOrder++;
  }
  console.log(`  products: ${SHIRT_PRODUCTS.length + PAINTING_PRODUCTS.length}`);
}

async function seedSettings(): Promise<void> {
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {
      whatsapp: "+972 50 000 0000",
      email: "hello@rabea.art",
      instagram: "@rab_eart",
      announcementAr: "الطلبات المخصصة مفتوحة هذا الشهر — التسليم قبل العيد مضمون للطلبات المؤكدة قبل ١٠ أيام.",
      announcementEn: "Custom orders are open this month — pre-holiday delivery guaranteed for orders confirmed 10 days ahead.",
      announcementActive: true,
      customOtherEnabled: true,
    },
    create: {
      id: 1,
      whatsapp: "+972 50 000 0000",
      email: "hello@rabea.art",
      instagram: "@rab_eart",
      announcementAr: "الطلبات المخصصة مفتوحة هذا الشهر — التسليم قبل العيد مضمون للطلبات المؤكدة قبل ١٠ أيام.",
      announcementEn: "Custom orders are open this month — pre-holiday delivery guaranteed for orders confirmed 10 days ahead.",
      announcementActive: true,
      customOtherEnabled: true,
    },
  });
  console.log("  settings: 1");
}

async function main(): Promise<void> {
  if (process.argv.includes("--with-demo-orders")) {
    // Demo orders/customers are intentionally out of scope for this seed (see file header) —
    // this flag is a stub so a future, clearly-separate script can hang a real implementation
    // off the same CLI without touching the production-safe default path.
    console.log("--with-demo-orders: demo orders not implemented (catalog-only seed).");
  }

  console.log("Seeding Rabea.art catalog...");
  const categoryIds = await seedCategories();
  const colorIds = await seedColors();
  const sizeIds = await seedSizes();
  await seedFrames();
  await seedMaterials();
  await seedProductionMethods();
  await seedProducts(categoryIds, colorIds, sizeIds);
  await seedSettings();
  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
