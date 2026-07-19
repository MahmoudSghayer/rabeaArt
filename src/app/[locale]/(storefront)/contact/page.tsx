import { getTranslations, setRequestLocale } from "next-intl/server";
import { cx } from "@/lib/cx";
import { CONTACT_INFO, mailHref, whatsappHref } from "@/components/storefront/contact-info";
import { FaqAccordion, type FaqItem } from "@/components/storefront/FaqAccordion";
import buttonStyles from "@/components/ui/Button.module.css";
import cardStyles from "@/components/ui/Card.module.css";
import styles from "./page.module.css";

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contact");

  const faqs = t.raw("faqs") as FaqItem[];
  const waHref = whatsappHref(t("whatsappMessage"));

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.intro}>
          <div className={styles.kicker}>✳ {t("kicker")}</div>
          <h1 className={styles.title}>{t("title")}</h1>
          <p className={styles.sub}>{t("sub")}</p>
        </div>

        <div className={styles.cardsGrid}>
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className={cx(cardStyles.padded, styles.waCard)}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="var(--color-ochre)" aria-hidden="true">
              <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.2 1.2-1.7 1.2-.4.1-1 .1-1.6-.1a13 13 0 0 1-5.9-5.2c-.6-1-1-2.2-.6-3 .2-.4.6-.9 1-.9h.7c.2 0 .5-.1.7.5l.8 2c.1.2 0 .4-.1.6l-.5.7c-.1.2-.2.4 0 .7.5.9 1.3 1.7 2.2 2.3.3.2.5.2.7 0l.9-1c.2-.3.4-.2.7-.1l1.9.9c.3.2.5.3.5.5s.1.5-.2.9Z" />
            </svg>
            <div className={styles.cardTitle}>{t("waTitle")}</div>
            <div className={styles.cardSubDark}>{t("waSub")}</div>
            <div className={styles.cardValueOchre} dir="ltr">
              {CONTACT_INFO.whatsapp}
            </div>
          </a>

          <a href={mailHref()} className={cx(cardStyles.card, cardStyles.padded, styles.card)}>
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-sienna)"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <rect x="2" y="4" width="20" height="16" rx="3" />
              <path d="m2 7 10 7L22 7" />
            </svg>
            <div className={styles.cardTitle}>{t("mailTitle")}</div>
            <div className={styles.cardSub}>{t("mailSub")}</div>
            <div className={styles.cardValueSienna} dir="ltr">
              {CONTACT_INFO.email}
            </div>
          </a>

          <div className={cx(cardStyles.card, cardStyles.padded, styles.card)}>
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-teal)"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <rect x="2" y="2" width="20" height="20" rx="5" />
              <circle cx="12" cy="12" r="4.5" />
              <circle cx="17.2" cy="6.8" r="1.1" fill="var(--color-teal)" stroke="none" />
            </svg>
            <div className={styles.cardTitle}>{t("igTitle")}</div>
            <div className={styles.cardSub}>{t("igSub")}</div>
            <div className={styles.cardValueTeal} dir="ltr">
              {CONTACT_INFO.instagram}
            </div>
          </div>

          <div className={cx(cardStyles.card, cardStyles.padded, styles.card)}>
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-ochre)"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            <div className={styles.cardTitle}>{t("hoursTitle")}</div>
            <div className={styles.cardSub}>
              {t("hours1")}
              <br />
              {t("hours2")}
            </div>
          </div>
        </div>

        <div className={styles.pickupNote}>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-teal)"
            strokeWidth="2"
            aria-hidden="true"
            className={styles.pickupIcon}
          >
            <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span>{t("pickup")}</span>
        </div>

        <div className={styles.faqWrap} id="faq">
          <h2 className={styles.faqTitle}>{t("faqTitle")}</h2>
          <p className={styles.faqSub}>{t("faqSub")}</p>
          <FaqAccordion items={faqs} />

          <div className={styles.stillBox}>
            <div className={styles.stillQ}>{t("stillQ")}</div>
            <div className={styles.stillSub}>{t("stillSub")}</div>
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className={cx(buttonStyles.button, buttonStyles.accent)}
            >
              {t("stillCta")}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
