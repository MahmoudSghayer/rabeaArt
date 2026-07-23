"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ProductType } from "@/generated/prisma/enums";
import { pickText, type CatalogProductDetail } from "@/lib/catalog/types";
import { useCartStore } from "@/lib/cart/store";
import { grainedArt } from "@/components/storefront/art";
import { fabricSwatch, textured } from "@/components/storefront/texture";
import { artKeyForSlug } from "@/components/storefront/product-art";
import { pushRecent } from "@/components/storefront/RecentlyViewed";
import { Chip } from "@/components/ui/Chip";
import { Ornament } from "@/components/decor";
import { cx } from "@/lib/cx";
import { Gallery, type GalleryView } from "./Gallery";
import styles from "./page.module.css";

const QTY_MIN = 1;
const QTY_MAX = 20;
const NOTES_MAX = 500;
/** How long the "Added ✓" button state and toast stay up (matches the design). */
const ADDED_RESET_MS = 2600;

/** The three pseudo-views from the design — same art gradient, different zoom crops. */
const ZOOM_VIEWS = [
  { key: "full", size: "auto", pos: "center" },
  { key: "texture", size: "260% 260%", pos: "22% 28%" },
  { key: "brush", size: "320% 320%", pos: "76% 68%" },
] as const;

const ALL_METHODS = ["print", "embroidery"] as const;
type Method = (typeof ALL_METHODS)[number] | null;

/**
 * Whether this shirt's variant stock numbers are meaningful. `trackStock` itself isn't exposed
 * on CatalogProductDetail, but it's recoverable: an untracked shirt is always `inStock` with
 * all-zero variant stock, so "some active variant has stock > 0" is the signal that per-combo
 * numbers should gate size availability. (A fully sold-out *tracked* shirt also has all zeros,
 * but that case surfaces as the whole-product sold-out state, not per-size disabling.)
 */
function hasTrackedStock(product: CatalogProductDetail): boolean {
  return product.variants.some((v) => v.active && v.stock > 0);
}

/**
 * A size is offered for a colour when an active variant row exists for the combination; when
 * stock is tracked, every such variant must additionally have stock > 0 to stay enabled.
 * An empty colour (shirt with no colour options) matches variants of any colour.
 */
function sizeAvailable(
  product: CatalogProductDetail,
  colorCode: string,
  sizeCode: string,
  tracked: boolean,
): boolean {
  const combos = product.variants.filter(
    (v) => v.active && v.sizeCode === sizeCode && (colorCode === "" || v.colorCode === colorCode),
  );
  if (combos.length === 0) return false;
  if (!tracked) return true;
  return combos.some((v) => v.stock > 0);
}

/** Default shirt size for a colour: "M" when orderable (design behaviour), else the first
 * orderable size, else the first size at all. */
function preferredSize(product: CatalogProductDetail, colorCode: string, tracked: boolean): string {
  const codes = product.shirtSizes.map((s) => s.code);
  const available = codes.filter((code) => sizeAvailable(product, colorCode, code, tracked));
  if (available.includes("M")) return "M";
  return available[0] ?? codes[0] ?? "";
}

/**
 * The interactive half of the product page: gallery + purchase panel (variant pickers, qty,
 * notes, price summary, add-to-order, accordion), the sticky mobile add-bar, and the "added"
 * toast. Receives the full server-fetched product; every price shown here is a display hint
 * only — the server reprices authoritatively at order submit (see src/lib/cart/store.ts).
 */
export function ProductView({ product }: { product: CatalogProductDetail }) {
  const rawLocale = useLocale();
  const locale = rawLocale === "en" ? "en" : "ar";
  const t = useTranslations("product");
  const tCommon = useTranslations("common");
  const tActions = useTranslations("actions");
  const tNav = useTranslations("nav");
  const accBaseId = useId();
  const notesId = useId();

  const isShirt = product.type === ProductType.SHIRT;
  const isPaint = !isShirt;
  const tracked = isShirt && hasTrackedStock(product);
  const soldOut = !product.inStock;

  const defaultColor = product.colors[0]?.code ?? "";
  const [colorCode, setColorCode] = useState(defaultColor);
  const [sizeCode, setSizeCode] = useState(() =>
    isShirt ? preferredSize(product, defaultColor, tracked) : (product.paintingSizes[0]?.code ?? ""),
  );
  const [method, setMethod] = useState<Method>(product.availableMethods[0] ?? null);
  const [frameCode, setFrameCode] = useState(
    () => product.frames.find((f) => f.code === "none")?.code ?? product.frames[0]?.code ?? "",
  );
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [view, setView] = useState(0);
  const [added, setAdded] = useState(false);
  const [toast, setToast] = useState(false);
  const [openAcc, setOpenAcc] = useState(-1);

  const addItem = useCartStore((state) => state.addItem);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Record this product in the "recently viewed" trail once per mount.
  useEffect(() => {
    pushRecent({
      slug: product.slug,
      nameAr: product.name.ar,
      nameEn: product.name.en,
      artKey: artKeyForSlug(product.slug),
    });
  }, [product.slug, product.name.ar, product.name.en]);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  const name = pickText(product.name, locale);
  const nameEcho = locale === "ar" ? product.name.en : product.name.ar;
  const desc = product.description ? pickText(product.description, locale) : "";
  const artistNote = isPaint && product.artistNote ? pickText(product.artistNote, locale) : "";
  const prepText = product.prep ? pickText(product.prep, locale) : "";

  const selectedColor = product.colors.find((c) => c.code === colorCode) ?? null;
  const selectedPaintSize = product.paintingSizes.find((s) => s.code === sizeCode) ?? null;
  const selectedFrame = product.frames.find((f) => f.code === frameCode) ?? null;

  // Display price: shirts use sale-or-price straight off the product; paintings are the
  // selected size's own price plus the selected frame's add-on. Null means "priced after
  // review" (a mid-setup product with no price configured).
  const frameAdd = selectedFrame?.add ?? 0;
  const unitPrice = isShirt
    ? product.displayPrice
    : selectedPaintSize
      ? selectedPaintSize.price + frameAdd
      : null;
  const totalPrice = unitPrice === null ? null : unitPrice * qty;
  const currency = tCommon("currency");
  const priceText = (value: number) => `${currency}${value}`;

  // --- Gallery presentation ---
  //
  // The stage is a MATERIAL now, not a flat fill: a shirt hangs against its own cloth (the
  // selected colour under a soft weave), a painting sits on primed canvas. That is the whole
  // reason `fabricSwatch`/`textured` exist — the same colour reads as fabric instead of a
  // rectangle of paint. The art itself stays a plain gradient because the gallery re-sizes and
  // re-positions it for the zoom views, and a background-size applies to every layer in the
  // stack; its canvas/print grain is layered on a pseudo-element in CSS instead.
  const artBackground = grainedArt(artKeyForSlug(product.slug));
  const stageBackground = isShirt
    ? fabricSwatch(selectedColor?.hex ?? "#EDE3CF")
    : textured("linear-gradient(180deg, #EFE7D4, #E4D6BC)", "canvas", "grain");
  const frameBorder =
    frameCode === "wood"
      ? "14px solid #8B6540"
      : frameCode === "black"
        ? "14px solid #26221C"
        : "1px solid rgba(35, 32, 27, 0.25)";
  const printBorder =
    method === "embroidery"
      ? "2.5px dashed rgba(251, 247, 238, 0.85)"
      : "2.5px solid rgba(251, 247, 238, 0.35)";

  const onSale = isShirt && product.oldPrice !== null;
  const badge = onSale
    ? { label: tCommon("saleTag"), tone: "sale" as const }
    : isPaint && product.isOriginal
      ? { label: tCommon("originalTag"), tone: "ink" as const }
      : null;

  const viewLabels: Record<(typeof ZOOM_VIEWS)[number]["key"], string> = {
    full: t("viewFull"),
    texture: t("viewTexture"),
    brush: t("viewBrush"),
  };
  const views: GalleryView[] = ZOOM_VIEWS.map((v) => ({ ...v, label: viewLabels[v.key] }));

  // Stock chip: sold out > one-of-one (original paintings) > low stock (tracked shirts ≤ 2).
  const totalStock = product.variants.reduce((sum, v) => (v.active ? sum + v.stock : sum), 0);
  const stockChip = soldOut
    ? { label: t("soldOutChip"), tone: styles.stockSoldOut }
    : isPaint && product.isOriginal
      ? { label: t("oneOfOne"), tone: styles.stockLow }
      : tracked && totalStock <= 2
        ? { label: t("lowStock"), tone: styles.stockLow }
        : null;

  const canAdd =
    !soldOut && sizeCode !== "" && (isPaint || sizeAvailable(product, colorCode, sizeCode, tracked));

  function pickColor(code: string) {
    setColorCode(code);
    // Keep the size selection orderable for the new colour.
    if (!sizeAvailable(product, code, sizeCode, tracked)) {
      setSizeCode(preferredSize(product, code, tracked));
    }
  }

  function handleAdd() {
    if (added || !canAdd) return;
    if (isShirt) {
      addItem({
        kind: "shirt",
        productId: product.id,
        slug: product.slug,
        nameAr: product.name.ar,
        nameEn: product.name.en,
        colorCode,
        sizeCode,
        method,
        qty,
        unitPrice,
        notes,
      });
    } else {
      addItem({
        kind: "painting",
        productId: product.id,
        slug: product.slug,
        nameAr: product.name.ar,
        nameEn: product.name.en,
        sizeCode,
        frameCode,
        qty,
        unitPrice,
        notes,
      });
    }
    setAdded(true);
    setToast(true);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => {
      setAdded(false);
      setToast(false);
    }, ADDED_RESET_MS);
  }

  const methodLabel = (m: Exclude<Method, null>) =>
    m === "print" ? t("methodPrint") : t("methodEmbroidery");

  const summaryParts = isShirt
    ? [
        sizeCode,
        selectedColor ? pickText(selectedColor.name, locale) : "",
        method ? methodLabel(method) : "",
      ]
    : [
        selectedPaintSize ? pickText(selectedPaintSize.label, locale) : "",
        selectedFrame ? pickText(selectedFrame.label, locale) : "",
      ];
  const summary = `${t("yourPick")} ${summaryParts.filter(Boolean).join(" · ")} × ${qty}`;

  const accItems = [
    { q: t("acc.prepTitle"), a: isShirt ? t("acc.prepShirt") : t("acc.prepPainting") },
    { q: t("acc.careTitle"), a: isShirt ? t("acc.careShirt") : t("acc.carePainting") },
    { q: t("acc.exchangeTitle"), a: t("acc.exchangeBody") },
  ];

  const addLabel = added ? t("added") : tActions("addToOrder");

  return (
    <>
      <div className={styles.grid}>
        <Gallery
          isPaint={isPaint}
          stageBackground={stageBackground}
          artBackground={artBackground}
          frameBorder={frameBorder}
          printBorder={printBorder}
          badge={badge}
          fabricLabel={
            isShirt
              ? `${t("fabricLabel")}${selectedColor ? ` · ${pickText(selectedColor.name, locale)}` : ""}`
              : null
          }
          views={views}
          activeView={view}
          onPickView={setView}
          stageAlt={name}
        />

        <div className={cx(styles.panel, !soldOut && styles.panelWithBar)}>
          <div className={styles.topRow}>
            <span className={styles.catKicker}>✳ {isPaint ? tNav("paintings") : tNav("shirts")}</span>
            {stockChip && <span className={cx(styles.stockChip, stockChip.tone)}>{stockChip.label}</span>}
          </div>

          <h1 className={styles.title}>{name}</h1>
          {nameEcho && (
            <div className={styles.nameEcho} dir={locale === "ar" ? "ltr" : "rtl"}>
              {nameEcho}
            </div>
          )}

          <div className={styles.priceRow}>
            {unitPrice !== null ? (
              <>
                <span className={styles.price} dir="ltr">
                  {priceText(unitPrice)}
                </span>
                {onSale && product.oldPrice !== null && (
                  <span className={styles.oldPrice} dir="ltr">
                    {priceText(product.oldPrice)}
                  </span>
                )}
                <span className={styles.unitNote}>{t("unitNote")}</span>
              </>
            ) : (
              <span className={styles.manualPrice}>{tCommon("manualPrice")}</span>
            )}
          </div>

          {desc && <p className={styles.desc}>{desc}</p>}

          {artistNote && (
            <figure className={styles.artistNote}>
              <blockquote className={styles.artistQuote}>«{artistNote}»</blockquote>
              <figcaption className={styles.artistSig}>— {t("artistSig")}</figcaption>
            </figure>
          )}

          {/*
            Grouped panels, not one long column of pills.

            Everything below the price used to be a single undifferentiated stack — swatches,
            sizes, method, quantity, notes, summary, button, accordion — so the eye had no way to
            tell "configure the piece" from "place the order". Three subtly elevated surfaces
            separate those jobs; each carries a corner mark so they are told apart at a glance
            without inventing new copy.
          */}
          {/*
            role="group" + aria-label names each surface for assistive tech, which previously
            saw three anonymous divs. Purely programmatic — the visible design still leans on the
            corner ornament, so this adds no layout and cannot regress it.
          */}
          <div className={styles.optionsPanel} role="group" aria-label={t("panelConfigure")}>
            <span aria-hidden="true" className={styles.panelMark}>
              <Ornament name={isShirt ? "fold" : "frame"} size={18} strokeWidth={1.5} />
            </span>

            {isShirt && (
              <>
                {product.colors.length > 0 && (
                  <div className={styles.group}>
                    <div className={styles.groupLabel}>
                      {tCommon("color")}:{" "}
                      <span className={styles.groupValue}>
                        {selectedColor ? pickText(selectedColor.name, locale) : ""}
                      </span>
                    </div>
                    <div className={styles.swatches}>
                      {product.colors.map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          title={pickText(c.name, locale)}
                          aria-label={pickText(c.name, locale)}
                          aria-pressed={colorCode === c.code}
                          onClick={() => pickColor(c.code)}
                          className={cx(styles.swatch, colorCode === c.code && styles.swatchActive)}
                          style={{ background: c.hex }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {product.shirtSizes.length > 0 && (
                  <div className={styles.group}>
                    <div className={styles.groupLabel}>
                      {tCommon("size")}: <span className={styles.groupValue}>{sizeCode}</span>
                      <span className={styles.groupHint}>{t("sizeHint")}</span>
                    </div>
                    <div className={styles.pillRow}>
                      {product.shirtSizes.map((s) => {
                        const available = sizeAvailable(product, colorCode, s.code, tracked);
                        return (
                          <Chip
                            key={s.code}
                            active={sizeCode === s.code}
                            disabled={!available}
                            onClick={() => available && setSizeCode(s.code)}
                            className={styles.sizePill}
                          >
                            {s.code}
                          </Chip>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className={styles.group}>
                  <div className={styles.groupLabel}>{tCommon("method")}</div>
                  <div className={styles.pillRow}>
                    {ALL_METHODS.map((m) => {
                      const available = product.availableMethods.includes(m);
                      const hint = available ? (m === "embroidery" ? t("embHint") : "") : t("methodNA");
                      return (
                        <Chip
                          key={m}
                          active={method === m}
                          disabled={!available}
                          onClick={() => available && setMethod(m)}
                          className={styles.methodPill}
                        >
                          {methodLabel(m)}
                          {hint && <span className={styles.pillHint}>{hint}</span>}
                        </Chip>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {isPaint && (
              <>
                <div className={styles.group}>
                  <div className={styles.groupLabel}>
                    {tCommon("size")}:{" "}
                    <span className={styles.groupValue}>
                      {selectedPaintSize ? pickText(selectedPaintSize.label, locale) : ""}
                    </span>
                  </div>
                  <div className={styles.pillRow}>
                    {product.paintingSizes.map((s) => {
                      const active = sizeCode === s.code;
                      return (
                        <Chip
                          key={s.code}
                          active={active}
                          onClick={() => setSizeCode(s.code)}
                          className={styles.paintSizePill}
                        >
                          <span>{pickText(s.label, locale)}</span>
                          <span className={cx(styles.pillPrice, active && styles.pillPriceActive)} dir="ltr">
                            {priceText(s.price)}
                          </span>
                        </Chip>
                      );
                    })}
                  </div>
                  <div className={styles.customHint}>
                    {t("customSizeQ")}{" "}
                    <Link
                      href={{ pathname: "/custom", query: { type: "painting" } }}
                      className={styles.customHintLink}
                    >
                      {t("customSizeLink")}
                    </Link>
                  </div>
                </div>

                {product.frames.length > 0 && (
                  <div className={styles.group}>
                    <div className={styles.groupLabel}>{tCommon("frame")}</div>
                    <div className={styles.pillRow}>
                      {product.frames.map((f) => {
                        const active = frameCode === f.code;
                        return (
                          <Chip
                            key={f.code}
                            active={active}
                            onClick={() => setFrameCode(f.code)}
                            className={styles.framePill}
                          >
                            {pickText(f.label, locale)}
                            {f.add > 0 ? (
                              <span className={cx(styles.frameAdd, active && styles.frameAddActive)} dir="ltr">
                                +{priceText(f.add)}
                              </span>
                            ) : (
                              <span className={cx(styles.frameAdd, active && styles.frameAddActive)}>
                                {t("free")}
                              </span>
                            )}
                          </Chip>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className={styles.orderPanel} role="group" aria-label={t("panelOrder")}>
            <span aria-hidden="true" className={styles.panelMark}>
              <Ornament name="ribbon" size={18} strokeWidth={1.5} />
            </span>

            <div className={styles.qtyRow}>
              <div>
                <div className={styles.groupLabel}>{tCommon("qty")}</div>
                <div className={styles.qtyBox}>
                  <button
                    type="button"
                    className={styles.qtyBtn}
                    onClick={() => setQty((q) => Math.max(QTY_MIN, q - 1))}
                    aria-label={t("qtyDec")}
                  >
                    −
                  </button>
                  <span className={styles.qtyVal} dir="ltr">
                    {qty}
                  </span>
                  <button
                    type="button"
                    className={styles.qtyBtn}
                    onClick={() => setQty((q) => Math.min(QTY_MAX, q + 1))}
                    aria-label={t("qtyInc")}
                  >
                    +
                  </button>
                </div>
              </div>
              <div className={styles.notesWrap}>
                <label htmlFor={notesId} className={styles.groupLabel}>
                  {tCommon("notes")} <span className={styles.groupHint}>({t("optional")})</span>
                </label>
                <input
                  id={notesId}
                  value={notes}
                  maxLength={NOTES_MAX}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("notesPh")}
                  className={styles.notesInput}
                />
              </div>
            </div>

            <div className={styles.summaryCard}>
              <div className={styles.summaryText}>{summary}</div>
              <div className={styles.summaryTotal}>
                {totalPrice === null ? (
                  tCommon("manualPrice")
                ) : (
                  <span dir="ltr">{priceText(totalPrice)}</span>
                )}
              </div>
            </div>

            {!soldOut ? (
              <div className={styles.addRow}>
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!canAdd}
                  className={cx(styles.addBtn, added && styles.addBtnAdded)}
                >
                  {addLabel}
                </button>
                <Link href="/order" className={styles.goOrder}>
                  {tActions("viewOrder")}
                </Link>
              </div>
            ) : (
              <div className={styles.addRow}>
                <span className={styles.soldOutPill}>{tCommon("outOfStock")}</span>
                <Link href="/custom" className={styles.soldOutCta}>
                  {t("soldOutCta")}
                </Link>
              </div>
            )}

            <div className={styles.prepLine}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#33605A"
                strokeWidth="2"
                className={styles.prepIcon}
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 7v5l3 2" />
              </svg>
              <span>
                {prepText ? `${tCommon("prep")}: ${prepText} · ${t("payShort")}` : t("payShort")}
              </span>
            </div>
          </div>

          <div className={styles.accWrap}>
            {accItems.map((item, i) => {
              const open = openAcc === i;
              const buttonId = `${accBaseId}-q-${i}`;
              const panelId = `${accBaseId}-a-${i}`;
              return (
                <div key={i} className={styles.accItem}>
                  <h3 className={styles.accHeading}>
                    <button
                      type="button"
                      id={buttonId}
                      className={styles.accTrigger}
                      aria-expanded={open}
                      aria-controls={panelId}
                      onClick={() => setOpenAcc(open ? -1 : i)}
                    >
                      <span className={styles.accQ}>{item.q}</span>
                      <span className={styles.accSign} aria-hidden="true">
                        {open ? "–" : "+"}
                      </span>
                    </button>
                  </h3>
                  {open && (
                    <p id={panelId} role="region" aria-labelledby={buttonId} className={styles.accA}>
                      {item.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {!soldOut && (
        <div className={styles.stickyBar}>
          <div>
            <div className={styles.barName}>{name}</div>
            <div className={styles.barPrice}>
              {totalPrice === null ? (
                tCommon("manualPrice")
              ) : (
                <span dir="ltr">{priceText(totalPrice)}</span>
              )}
            </div>
          </div>
          <div className={styles.barSpacer} />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!canAdd}
            className={cx(styles.addBtn, styles.addBtnBar, added && styles.addBtnAdded)}
          >
            {addLabel}
          </button>
        </div>
      )}

      {toast && (
        <div className={styles.toast} role="status">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#7FBF8E"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={styles.toastIcon}
            aria-hidden="true"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <span>{t("toastAdded")}</span>
          <span aria-hidden="true">·</span>
          <Link href="/order" className={styles.toastLink}>
            {t("toastGo")}
          </Link>
        </div>
      )}
    </>
  );
}
