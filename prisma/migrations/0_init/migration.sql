-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'REVIEW', 'NEEDS_INFO', 'QUOTED', 'ACCEPTED', 'DECLINED', 'PROGRESS', 'READY', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('NOT_REQUIRED', 'UNPAID', 'PARTIAL', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('OWNER', 'ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('SHIRT', 'PAINTING');

-- CreateEnum
CREATE TYPE "ItemKind" AS ENUM ('SHIRT', 'PAINTING', 'CUSTOM_SHIRT', 'CUSTOM_PAINTING', 'CUSTOM_OTHER');

-- CreateEnum
CREATE TYPE "ContactMethod" AS ENUM ('PHONE', 'WHATSAPP', 'EMAIL', 'INTERNAL');

-- CreateEnum
CREATE TYPE "SizeScope" AS ENUM ('SHIRT', 'PAINTING');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'STAFF',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "phoneNormalized" VARCHAR(32),
    "whatsapp" TEXT,
    "email" TEXT,
    "emailNormalized" TEXT,
    "country" TEXT,
    "city" TEXT,
    "street" TEXT,
    "building" TEXT,
    "apt" TEXT,
    "postal" TEXT,
    "instructions" TEXT,
    "preferredContact" "ContactMethod",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "type" "ProductType" NOT NULL,
    "code" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "ProductType" NOT NULL,
    "categoryId" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "descAr" TEXT,
    "descEn" TEXT,
    "price" DECIMAL(10,2),
    "sale" DECIMAL(10,2),
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "trackStock" BOOLEAN NOT NULL DEFAULT false,
    "printAvailable" BOOLEAN NOT NULL DEFAULT false,
    "embroideryAvailable" BOOLEAN NOT NULL DEFAULT false,
    "isOriginal" BOOLEAN NOT NULL DEFAULT false,
    "artistNoteAr" TEXT,
    "artistNoteEn" TEXT,
    "prepAr" TEXT,
    "prepEn" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "alt" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colors" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "hex" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "colors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_colors" (
    "productId" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,

    CONSTRAINT "product_colors_pkey" PRIMARY KEY ("productId","colorId")
);

-- CreateTable
CREATE TABLE "sizes" (
    "id" TEXT NOT NULL,
    "scope" "SizeScope" NOT NULL,
    "code" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "sizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_sizes" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "product_sizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "colorId" TEXT,
    "sizeId" TEXT,
    "sku" TEXT,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "frames" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "add" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "frames_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_methods" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "production_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'NEW',
    "pay" "PaymentStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "estTotal" DECIMAL(10,2),
    "finalPrice" DECIMAL(10,2),
    "eta" TIMESTAMP(3),
    "customerId" TEXT NOT NULL,
    "contactMethod" "ContactMethod" NOT NULL,
    "notes" TEXT,
    "consentTerms" BOOLEAN NOT NULL DEFAULT false,
    "consentCustomApproval" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "idempotencyKey" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'ar',
    "stockAppliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" "ItemKind" NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "labelAr" TEXT,
    "labelEn" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2),
    "finalUnitPrice" DECIMAL(10,2),
    "optionsJson" JSONB NOT NULL,
    "notes" TEXT,
    "snapshotNameAr" TEXT,
    "snapshotNameEn" TEXT,
    "stockWarning" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_files" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "bucketPath" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "note" TEXT,
    "byAdminId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_logs" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "channel" "ContactMethod" NOT NULL,
    "text" TEXT NOT NULL,
    "byAdminId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "to" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "error" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_buckets" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "windowFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "whatsapp" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "instagram" TEXT,
    "announcementAr" TEXT,
    "announcementEn" TEXT,
    "announcementActive" BOOLEAN NOT NULL DEFAULT false,
    "customOtherEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "customers_phoneNormalized_idx" ON "customers"("phoneNormalized");

-- CreateIndex
CREATE INDEX "customers_emailNormalized_idx" ON "customers"("emailNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "categories_code_key" ON "categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_type_archived_idx" ON "products"("type", "archived");

-- CreateIndex
CREATE UNIQUE INDEX "colors_code_key" ON "colors"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sizes_scope_code_key" ON "sizes"("scope", "code");

-- CreateIndex
CREATE UNIQUE INDEX "product_sizes_productId_sizeId_key" ON "product_sizes"("productId", "sizeId");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_productId_colorId_sizeId_key" ON "product_variants"("productId", "colorId", "sizeId");

-- CreateIndex
CREATE UNIQUE INDEX "frames_code_key" ON "frames"("code");

-- CreateIndex
CREATE UNIQUE INDEX "materials_code_key" ON "materials"("code");

-- CreateIndex
CREATE UNIQUE INDEX "production_methods_scope_code_key" ON "production_methods"("scope", "code");

-- CreateIndex
CREATE UNIQUE INDEX "orders_ref_key" ON "orders"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "orders_idempotencyKey_key" ON "orders"("idempotencyKey");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_colors" ADD CONSTRAINT "product_colors_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_colors" ADD CONSTRAINT "product_colors_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "colors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_sizes" ADD CONSTRAINT "product_sizes_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_sizes" ADD CONSTRAINT "product_sizes_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "colors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "sizes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_files" ADD CONSTRAINT "order_files_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_files" ADD CONSTRAINT "order_files_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_byAdminId_fkey" FOREIGN KEY ("byAdminId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_byAdminId_fkey" FOREIGN KEY ("byAdminId") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Custom: human-readable order reference sequence (RA-1001, RA-1002, ...) — used by the
-- order-submission transaction via SELECT nextval('order_ref_seq'). Concurrency-safe.
CREATE SEQUENCE "order_ref_seq" START 1001;

-- Custom: last-resort guard — application logic releases/applies stock in exactly two code
-- paths, but the DB must never allow negative stock regardless.
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_stock_non_negative" CHECK ("stock" >= 0);
