import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalPageShell } from "@/components/storefront/LegalPageShell";
import type { LegalSection } from "@/components/storefront/LegalSections";

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("legal");
  const tNav = await getTranslations("nav");
  const sections = t.raw("privacy.sections") as LegalSection[];

  return <LegalPageShell active="privacy" title={tNav("privacy")} sections={sections} />;
}
