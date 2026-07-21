import { setRequestLocale } from "next-intl/server";
import { getCachedActiveOptions, getCachedSettings } from "@/lib/catalog/cached";
import type { CatalogActiveOptions } from "@/lib/catalog/types";
import { CONTACT_INFO } from "@/components/storefront/contact-info";
import { buildOptionLabelMaps } from "../custom/fallback-options";
import { OrderFlow } from "./OrderFlow";

/**
 * Order page (cart → details → confirmation) — server component. Fetches the option label
 * lookups (to render each cart item's option-summary line) and the studio contact settings
 * (for the confirmation step's WhatsApp/mailto CTAs); both degrade gracefully when the DB is
 * unreachable — labels fall back to the seed-matching lists in ../custom/fallback-options.ts,
 * contacts to the CONTACT_INFO constants. All flow state lives in the client OrderFlow.
 */
export default async function OrderPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  let activeOptions: CatalogActiveOptions | null = null;
  try {
    activeOptions = await getCachedActiveOptions();
  } catch {
    activeOptions = null;
  }

  let whatsapp: string = CONTACT_INFO.whatsapp;
  let email: string = CONTACT_INFO.email;
  try {
    const settings = await getCachedSettings();
    whatsapp = settings.whatsapp;
    email = settings.email;
  } catch {
    // Keep the CONTACT_INFO fallbacks.
  }

  return <OrderFlow labels={buildOptionLabelMaps(activeOptions)} whatsapp={whatsapp} email={email} />;
}
