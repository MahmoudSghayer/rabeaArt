import type { ReactNode } from "react";

/**
 * Shared storefront shell (SiteHeader/SiteFooter). Placeholder chrome for now — full
 * header/footer with nav, language toggle, and cart badge land in the M2 storefront pass.
 */
export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return <div className="storefront-shell">{children}</div>;
}
