import { setRequestLocale } from "next-intl/server";
import { getCachedActiveOptions } from "@/lib/catalog/cached";
import type { CatalogActiveOptions } from "@/lib/catalog/types";
import { resolveContactInfo } from "@/components/storefront/contact-settings";
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

  // Shared resolver, so this page cannot drift from the footer / contact page. It also treats a
  // blank Settings field as "fall back", which the previous inline version did not.
  const contact = await resolveContactInfo();

  return (
    <OrderFlow
      labels={buildOptionLabelMaps(activeOptions)}
      whatsapp={contact.whatsapp}
      email={contact.email}
    />
  );
}
