import { getTranslations, setRequestLocale } from "next-intl/server";
import { cx } from "@/lib/cx";
import { resolveContactInfo } from "@/components/storefront/contact-settings";
import { FaqAccordion, type FaqItem } from "@/components/storefront/FaqAccordion";
import { AmbientField, Ornament, TexturedSection } from "@/components/decor";
import { Reveal } from "@/components/motion/Reveal";
import buttonStyles from "@/components/ui/Button.module.css";
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
  const contact = await resolveContactInfo();
  const waHref = contact.waHref(t("whatsappMessage"));

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.introWrap}>
          <AmbientField variant="wash" intensity={0.6} className={styles.introAmbient} />
          <div className={styles.intro}>
            <div className={styles.kicker}>
              <Ornament name="star" size={13} strokeWidth={1.6} />
              {t("kicker")}
            </div>
            <h1 className={styles.title}>{t("title")}</h1>
            <p className={styles.sub}>{t("sub")}</p>
          </div>
        </div>

        {/*
          Four rectangles that differed only by a 26px stroke icon. Each channel now carries its
          own oversized studio glyph, its own accent (driven by --card-accent), and real
          elevation, so the grid reads as four different things rather than one thing four times.
        */}
        <div className={styles.cardsGrid}>
          <Reveal index={0} className={styles.cardCell}>
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className={cx(styles.card, styles.cardWa)}
            >
              <span aria-hidden="true" className={styles.cardMark}>
                <Ornament name="thread" size={116} strokeWidth={1} />
              </span>
              <span className={styles.cardIcon} aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.2 1.2-1.7 1.2-.4.1-1 .1-1.6-.1a13 13 0 0 1-5.9-5.2c-.6-1-1-2.2-.6-3 .2-.4.6-.9 1-.9h.7c.2 0 .5-.1.7.5l.8 2c.1.2 0 .4-.1.6l-.5.7c-.1.2-.2.4 0 .7.5.9 1.3 1.7 2.2 2.3.3.2.5.2.7 0l.9-1c.2-.3.4-.2.7-.1l1.9.9c.3.2.5.3.5.5s.1.5-.2.9Z" />
                </svg>
              </span>
              <div className={styles.cardTitle}>{t("waTitle")}</div>
              <div className={styles.cardSub}>{t("waSub")}</div>
              <div className={styles.cardValue} dir="ltr">
                {contact.whatsapp}
              </div>
            </a>
          </Reveal>

          <Reveal index={1} className={styles.cardCell}>
            <a href={contact.mailHref()} className={cx(styles.card, styles.cardMail)}>
              <span aria-hidden="true" className={styles.cardMark}>
                <Ornament name="press" size={116} strokeWidth={1} />
              </span>
              <span className={styles.cardIcon} aria-hidden="true">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <rect x="2" y="4" width="20" height="16" rx="3" />
                  <path d="m2 7 10 7L22 7" />
                </svg>
              </span>
              <div className={styles.cardTitle}>{t("mailTitle")}</div>
              <div className={styles.cardSub}>{t("mailSub")}</div>
              <div className={styles.cardValue} dir="ltr">
                {contact.email}
              </div>
            </a>
          </Reveal>

          <Reveal index={2} className={styles.cardCell}>
            <div className={cx(styles.card, styles.cardIg, styles.cardStatic)}>
              <span aria-hidden="true" className={styles.cardMark}>
                <Ornament name="frame" size={116} strokeWidth={1} />
              </span>
              <span className={styles.cardIcon} aria-hidden="true">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <circle cx="12" cy="12" r="4.5" />
                  <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
                </svg>
              </span>
              <div className={styles.cardTitle}>{t("igTitle")}</div>
              <div className={styles.cardSub}>{t("igSub")}</div>
              <div className={styles.cardValue} dir="ltr">
                {contact.instagram}
              </div>
            </div>
          </Reveal>

          <Reveal index={3} className={styles.cardCell}>
            <div className={cx(styles.card, styles.cardHours, styles.cardStatic)}>
              <span aria-hidden="true" className={styles.cardMark}>
                <Ornament name="spool" size={116} strokeWidth={1} />
              </span>
              <span className={styles.cardIcon} aria-hidden="true">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              </span>
              <div className={styles.cardTitle}>{t("hoursTitle")}</div>
              <div className={styles.cardSub}>
                {t("hours1")}
                <br />
                {t("hours2")}
              </div>
            </div>
          </Reveal>
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
      </div>

      {/*
        The FAQ was the longest flat area on the site: eight hairline rows on bare paper. It sits
        on a torn-edged linen band now, and each answer is its own card — see FaqAccordion.
      */}
      <TexturedSection
        id="faq"
        tone="deep"
        edge="deckle"
        glow="ochre"
        className={styles.faqBand}
        innerClassName={styles.faqInner}
      >
        <div className={styles.faqHead}>
          <span aria-hidden="true" className={styles.faqMark}>
            <Ornament name="scissors" size={26} />
          </span>
          <h2 className={styles.faqTitle}>{t("faqTitle")}</h2>
          <p className={styles.faqSub}>{t("faqSub")}</p>
        </div>

        <FaqAccordion items={faqs} />

        <div className={styles.stillBox}>
          <span aria-hidden="true" className={styles.stillMark}>
            <Ornament name="needle" size={26} />
          </span>
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
      </TexturedSection>
    </div>
  );
}
