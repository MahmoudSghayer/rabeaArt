import { getTranslations } from "next-intl/server";
import { BrandLoader } from "@/components/storefront/BrandLoader";

/**
 * Suspense fallback for the whole storefront. Placed at the [locale] segment (above the
 * storefront layout) on purpose: the boundary sits over the header/footer too, so a page that is
 * still streaming shows a full-page brand loader rather than an empty content well under a bare
 * header. This is also the earliest possible paint — the [locale] layout does no I/O, so the
 * loader streams immediately while the storefront layout's settings fetch and the page resolve.
 *
 * Admin (app/admin) and the coming-soon gate (app/coming-soon) live outside [locale] and are
 * unaffected.
 */
export default async function Loading() {
  const t = await getTranslations("common");
  return <BrandLoader label={t("loading")} />;
}
