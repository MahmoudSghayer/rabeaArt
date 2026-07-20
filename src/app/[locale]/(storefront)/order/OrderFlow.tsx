"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useCartItems, useCartStore } from "@/lib/cart/store";
import type { CatalogLocale } from "@/lib/catalog/types";
import { cx } from "@/lib/cx";
import { Button } from "@/components/ui/Button";
import type { OptionLabelMaps } from "../custom/fallback-options";
import { DetailsForm } from "./DetailsForm";
import {
  computeCartTotals,
  itemArtBackground,
  itemName,
  mailtoFor,
  optionSummary,
  waHrefFor,
  type SubmittedOrder,
} from "./order-utils";
import styles from "./OrderFlow.module.css";

const COPY_FEEDBACK_MS = 1800;

// Hydration gate: false during SSR/hydration, true on the client afterwards — the cart reads
// from localStorage, so cart-dependent UI must not take part in the hydration comparison.
const emptySubscribe = () => () => {};
function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

/**
 * The /order page's 3-step client flow: Review (cart) → Details (form) → Confirmation.
 *
 * Refresh-safety: the cart itself persists (zustand localStorage), but the step index and the
 * post-submit snapshot are in-memory only — refreshing mid-Details lands back on Review with
 * the cart intact, and refreshing on Confirmation loses the recap view (the order is already
 * stored server-side, and the customer has the ref by email). Both are accepted trade-offs.
 */
export function OrderFlow({
  labels,
  whatsapp,
  email,
}: {
  labels: OptionLabelMaps;
  /** Studio WhatsApp number, from Settings (or the CONTACT_INFO fallback). */
  whatsapp: string;
  /** Studio email, from Settings (or the CONTACT_INFO fallback). */
  email: string;
}) {
  const locale = useLocale() as CatalogLocale;
  const t = useTranslations("order");
  const tCommon = useTranslations("common");
  const tActions = useTranslations("actions");
  const items = useCartItems();
  const updateQty = useCartStore((s) => s.updateQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const clear = useCartStore((s) => s.clear);

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [submitted, setSubmitted] = useState<SubmittedOrder | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mounted = useMounted();
  useEffect(
    () => () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    },
    [],
  );

  const isRtl = locale === "ar";
  const arrow = isRtl ? "←" : "→";
  const arrowBack = isRtl ? "→" : "←";
  const currency = tCommon("currency");

  const summaryStrings = {
    sizePrefix: t("review.sizePrefix"),
    customDims: t("review.customDims"),
  };

  function handleSubmitted(order: SubmittedOrder) {
    setSubmitted(order);
    setStep(2);
    clear();
    window.scrollTo({ top: 0 });
  }

  function copyRef() {
    if (!submitted) return;
    navigator.clipboard.writeText(submitted.ref).catch(() => {});
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
  }

  const crumbLabels = [t("crumbs.review"), t("crumbs.details"), t("crumbs.confirmation")];
  const totals = computeCartTotals(items);

  const showEmpty = mounted && step === 0 && items.length === 0;
  const showReview = mounted && step === 0 && items.length > 0;
  const showForm = mounted && step === 1;
  const showDone = mounted && step === 2 && submitted !== null;

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <nav className={styles.crumbs} aria-label={crumbLabels.join(" / ")}>
          {crumbLabels.map((label, i) => (
            <div key={label} className={styles.crumbStep}>
              <div className={styles.crumbCell}>
                <span
                  className={cx(
                    styles.crumbNum,
                    step === i && styles.crumbNumCurrent,
                    step > i && styles.crumbNumDone,
                  )}
                >
                  {step > i ? "✓" : i + 1}
                </span>
                <span className={cx(styles.crumbLabel, step === i && styles.crumbLabelCurrent)}>
                  {label}
                </span>
              </div>
              {i < 2 && <span className={styles.crumbLine} aria-hidden="true" />}
            </div>
          ))}
        </nav>

        {showEmpty && (
          <div className={styles.emptyBox}>
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={styles.emptyIcon}
              aria-hidden="true"
            >
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            {/* h1, not a div: the empty cart is a first-time visitor's default view, and every
                page needs exactly one top-level heading. .emptyTitle carries its own type
                styles, so the element swap is visually identical. */}
            <h1 className={styles.emptyTitle}>{t("empty.title")}</h1>
            <p className={styles.emptySub}>{t("empty.sub")}</p>
            <div className={styles.emptyCtas}>
              <Link href="/shop" className={styles.ctaInk}>
                {t("empty.shopCta")}
              </Link>
              <Link href="/custom" className={styles.ctaDashed}>
                {t("empty.customCta")}
              </Link>
            </div>
          </div>
        )}

        {showReview && (
          <div className={styles.reviewGrid}>
            <div className={styles.itemsCol}>
              <h1 className={styles.pageTitle}>{t("review.title")}</h1>
              {items.map((item) => {
                const priced = item.unitPrice != null;
                return (
                  <div key={item.key} className={styles.itemCard}>
                    <div
                      className={styles.itemThumb}
                      style={{ backgroundImage: itemArtBackground(item) }}
                      aria-hidden="true"
                    />
                    <div className={styles.itemBody}>
                      <div className={styles.itemNameRow}>
                        <span className={styles.itemName}>{itemName(item, locale)}</span>
                        {!priced && <span className={styles.manualChip}>{tCommon("manualPrice")}</span>}
                      </div>
                      {optionSummary(item, labels, locale, summaryStrings) && (
                        <div className={styles.itemOpts}>
                          {optionSummary(item, labels, locale, summaryStrings)}
                        </div>
                      )}
                      {item.notes.trim() && (
                        <div className={styles.itemNotes}>“{item.notes.trim()}”</div>
                      )}
                      {(item.kind === "custom-shirt" ||
                        item.kind === "custom-painting" ||
                        item.kind === "custom-other") &&
                        item.files.length > 0 && (
                          <div className={styles.itemFiles}>
                            {item.files.map((f) => (
                              <span
                                key={f.bucketPath}
                                title={f.originalName}
                                className={styles.itemFileThumb}
                                style={
                                  f.previewDataUrl
                                    ? { backgroundImage: `url(${f.previewDataUrl})` }
                                    : undefined
                                }
                              />
                            ))}
                          </div>
                        )}
                      <div className={styles.itemActions}>
                        <div className={styles.itemQtyBox}>
                          <button
                            type="button"
                            className={styles.itemQtyBtn}
                            aria-label="−"
                            onClick={() => updateQty(item.key, item.qty - 1)}
                          >
                            −
                          </button>
                          <span className={styles.itemQtyVal} dir="ltr">
                            {item.qty}
                          </span>
                          <button
                            type="button"
                            className={styles.itemQtyBtn}
                            aria-label="+"
                            onClick={() => updateQty(item.key, item.qty + 1)}
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          className={styles.removeLink}
                          onClick={() => removeItem(item.key)}
                        >
                          {tActions("remove")}
                        </button>
                        <div className={styles.navSpacer} />
                        <span className={cx(styles.itemPrice, !priced && styles.itemPriceMuted)}>
                          {priced ? (
                            <span dir="ltr">{`${currency}${(item.unitPrice as number) * item.qty}`}</span>
                          ) : (
                            "—"
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <Link href="/shop" className={styles.keepShoppingLink}>
                {arrowBack} {tActions("continueShopping")}
              </Link>
            </div>

            <aside className={styles.aside}>
              <div className={styles.asideTitle}>{t("review.summary")}</div>
              <div className={styles.summaryRow}>
                <span>{t("review.itemsCount")}</span>
                <span className={styles.summaryCount} dir="ltr">
                  {totals.count}
                </span>
              </div>
              <div className={cx(styles.summaryRow, styles.summaryRowTotal)}>
                <span>{tCommon("total")}</span>
                <span className={styles.summaryTotal}>
                  {totals.est > 0 ? (
                    <span dir="ltr">{`${currency}${totals.est}${totals.manual > 0 ? " +" : ""}`}</span>
                  ) : (
                    t("review.priceAfterReview")
                  )}
                </span>
              </div>
              {totals.manual > 0 && (
                <div className={styles.manualNote}>
                  {t("review.manualNote", { count: totals.manual })}
                </div>
              )}
              <div className={styles.payNote}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#33605A"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <rect x="3" y="11" width="18" height="10" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span>{tCommon("payNote")}</span>
              </div>
              <Button
                variant="accent"
                fullWidth
                onClick={() => {
                  setStep(1);
                  window.scrollTo({ top: 0 });
                }}
              >
                {t("review.toDetails")} {arrow}
              </Button>
            </aside>
          </div>
        )}

        {showForm && (
          <DetailsForm
            items={items}
            onBack={() => {
              setStep(0);
              window.scrollTo({ top: 0 });
            }}
            onSubmitted={handleSubmitted}
          />
        )}

        {showDone && submitted && (
          <div className={styles.doneWrap}>
            <div className={styles.doneBox}>
              <div className={styles.doneIcon} aria-hidden="true">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#3F7048"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <h1 className={styles.doneTitle}>{t("confirmation.title")}</h1>
              <p className={styles.doneGreeting}>
                {t("confirmation.greeting", {
                  name: submitted.customerName.trim().split(/\s+/)[0] ?? submitted.customerName,
                  method: t(`confirmation.contactMethodNames.${submitted.contact}`),
                })}
              </p>

              <div className={styles.refBox}>
                <span className={styles.refLabel}>{t("confirmation.refLabel")}</span>
                <span className={styles.refValue} dir="ltr">
                  {submitted.ref}
                </span>
                <button type="button" className={styles.copyBtn} onClick={copyRef}>
                  {copied ? `${tActions("copied")} ✓` : tActions("copy")}
                </button>
              </div>
              <div className={styles.statusRow}>
                <span className={styles.statusPill}>{t("confirmation.statusNew")}</span>
              </div>

              <div className={styles.recapBox}>
                <div className={styles.recapTitle}>
                  {t("confirmation.itemsTitle")} (
                  <span dir="ltr">{computeCartTotals(submitted.items).count}</span>)
                </div>
                {submitted.items.map((item) => {
                  const priced = item.unitPrice != null;
                  const opts = optionSummary(item, labels, locale, summaryStrings);
                  return (
                    <div key={item.key} className={styles.recapRow}>
                      <span
                        className={styles.recapThumb}
                        style={{ backgroundImage: itemArtBackground(item) }}
                        aria-hidden="true"
                      />
                      <div className={styles.recapBody}>
                        <div className={styles.recapName}>{itemName(item, locale)}</div>
                        <div className={styles.recapOpts}>
                          {opts ? `${opts} ` : ""}
                          {t("review.qtyTimes", { qty: item.qty })}
                        </div>
                      </div>
                      <span className={cx(styles.recapPrice, !priced && styles.itemPriceMuted)}>
                        {priced ? (
                          <span dir="ltr">{`${currency}${(item.unitPrice as number) * item.qty}`}</span>
                        ) : (
                          t("confirmation.afterReview")
                        )}
                      </span>
                    </div>
                  );
                })}
                <div className={styles.recapTotalRow}>
                  <span>{tCommon("total")}</span>
                  <span className={styles.summaryTotal}>
                    {submitted.estTotal == null ? (
                      t("review.priceAfterReview")
                    ) : (
                      <span dir="ltr">{`${currency}${submitted.estTotal}`}</span>
                    )}
                  </span>
                </div>
              </div>

              <div className={styles.nextBox}>
                <div className={styles.nextTitle}>{t("confirmation.nextTitle")}</div>
                {[
                  t("confirmation.next1"),
                  t("confirmation.next2", {
                    method: t(`confirmation.contactMethodNames.${submitted.contact}`),
                  }),
                  t("confirmation.next3"),
                ].map((text, i) => (
                  <div key={text} className={styles.nextRow}>
                    <span className={cx(styles.nextNum, i === 0 && styles.nextNumFirst)}>{i + 1}</span>
                    <span className={styles.nextText}>{text}</span>
                  </div>
                ))}
              </div>

              <div className={styles.doneCtas}>
                <a
                  href={waHrefFor(
                    whatsapp,
                    t("confirmation.waMessage", {
                      name: submitted.customerName,
                      ref: submitted.ref,
                    }),
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.waBtn}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.2 1.2-1.7 1.2-.4.1-1 .1-1.6-.1a13 13 0 0 1-5.9-5.2c-.6-1-1-2.2-.6-3 .2-.4.6-.9 1-.9h.7c.2 0 .5-.1.7.5l.8 2c.1.2 0 .4-.1.6l-.5.7c-.1.2-.2.4 0 .7.5.9 1.3 1.7 2.2 2.3.3.2.5.2.7 0l.9-1c.2-.3.4-.2.7-.1l1.9.9c.3.2.5.3.5.5s.1.5-.2.9Z" />
                  </svg>
                  {t("confirmation.waCta")}
                </a>
                <a href={mailtoFor(email, t("confirmation.mailSubject", { ref: submitted.ref }))} className={styles.ctaDashedNeutral}>
                  {t("confirmation.mailCta")}
                </a>
                <Link href="/shop" className={styles.ctaDashedNeutral}>
                  {tActions("continueShopping")}
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
