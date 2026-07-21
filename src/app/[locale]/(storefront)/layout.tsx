import type { ReactNode } from "react";
import { SiteHeader, type SiteHeaderAnnouncement } from "@/components/storefront/SiteHeader";
import { SiteFooter } from "@/components/storefront/SiteFooter";
import { getCachedSettings } from "@/lib/catalog/cached";

/**
 * Shared storefront shell: sticky SiteHeader (nav, language toggle, cart badge, announcement bar)
 * + page content + SiteFooter.
 *
 * The announcement bar is resolved here from admin → Settings. It previously was not: the prop
 * was left unset, so the bar always rendered a static translation string and the three
 * announcement fields in the admin form (Arabic text, English text, on/off switch) changed
 * nothing a visitor could see — the same defect as the contact details in SiteFooter.
 *
 * On a settings failure this returns `undefined`, not `null`. `null` means "the admin switched
 * the bar off", and a database blip must never be mistaken for a deliberate choice to hide it.
 */
async function resolveAnnouncement(): Promise<SiteHeaderAnnouncement | null | undefined> {
  try {
    const settings = await getCachedSettings();
    if (!settings.announcementActive) return null;
    return { ar: settings.announcement.ar, en: settings.announcement.en };
  } catch {
    return undefined;
  }
}

export default async function StorefrontLayout({ children }: { children: ReactNode }) {
  const announcement = await resolveAnnouncement();

  return (
    <div className="storefront-shell">
      <SiteHeader announcement={announcement} />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
