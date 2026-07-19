import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CONTACT_INFO, mailHref, whatsappHref } from "./contact-info";
import styles from "./SiteFooter.module.css";

type FooterLinkHref = string | { pathname: string; query?: Record<string, string> };
interface FooterLink {
  href: FooterLinkHref;
  label: string;
}

export async function SiteFooter() {
  const t = await getTranslations("footer");
  const tNav = await getTranslations("nav");
  const tActions = await getTranslations("actions");

  const shopLinks: FooterLink[] = [
    { href: "/shop", label: tNav("shop") },
    { href: { pathname: "/shop", query: { cat: "shirts" } }, label: tNav("shirts") },
    { href: { pathname: "/shop", query: { cat: "paintings" } }, label: tNav("paintings") },
    { href: "/custom", label: tNav("custom") },
  ];

  const infoLinks: FooterLink[] = [
    { href: "/about", label: tNav("about") },
    { href: "/contact", label: tNav("contact") },
    { href: "/contact#faq", label: tNav("faq") },
    { href: "/legal/terms", label: tNav("terms") },
    { href: "/legal/privacy", label: tNav("privacy") },
  ];

  return (
    <footer className={styles.footer}>
      <div className={styles.grid}>
        <div className={styles.brandCol}>
          <div className={styles.logo}>
            <span className={styles.logoAr}>
              ربيع<span className={styles.logoDot}>.</span>
            </span>
            <span className={styles.logoEn}>RABEA.ART</span>
          </div>
          <p className={styles.blurb}>{t("blurb")}</p>
          <div className={styles.instagram} dir="ltr">
            {CONTACT_INFO.instagram}
          </div>
        </div>

        <div className={styles.col}>
          <div className={styles.colHeading}>{tNav("shop")}</div>
          {shopLinks.map((l, i) => (
            <Link key={i} href={l.href} className={styles.colLink}>
              {l.label}
            </Link>
          ))}
        </div>

        <div className={styles.col}>
          <div className={styles.colHeading}>{t("infoHeading")}</div>
          {infoLinks.map((l, i) => (
            <Link key={i} href={l.href} className={styles.colLink}>
              {l.label}
            </Link>
          ))}
        </div>

        <div className={styles.col}>
          <div className={styles.colHeading}>{t("contactHeading")}</div>
          <a
            href={whatsappHref(t("whatsappMessage"))}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.waPill}
            aria-label={tActions("whatsapp")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.2 1.2-1.7 1.2-.4.1-1 .1-1.6-.1a13 13 0 0 1-5.9-5.2c-.6-1-1-2.2-.6-3 .2-.4.6-.9 1-.9h.7c.2 0 .5-.1.7.5l.8 2c.1.2 0 .4-.1.6l-.5.7c-.1.2-.2.4 0 .7.5.9 1.3 1.7 2.2 2.3.3.2.5.2.7 0l.9-1c.2-.3.4-.2.7-.1l1.9.9c.3.2.5.3.5.5s.1.5-.2.9Z" />
            </svg>
            <span dir="ltr">{CONTACT_INFO.whatsapp}</span>
          </a>
          <a href={mailHref()} className={styles.mailLink} dir="ltr">
            {CONTACT_INFO.email}
          </a>
          <div className={styles.hours}>{t("hours")}</div>
        </div>
      </div>

      <div className={styles.bottomBar}>
        <div className={styles.bottomInner}>
          <span>{t("copyright")}</span>
          <span className={styles.spacer} />
          {/*
            Plain <a>, not the locale-aware <Link>: /admin lives outside the [locale] segment
            (see src/i18n/routing.ts) and is never locale-prefixed.
          */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/admin" className={styles.adminLink}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            {tNav("admin")}
          </a>
        </div>
      </div>
    </footer>
  );
}
