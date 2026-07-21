"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useCartStore, type NewCartItem } from "@/lib/cart/store";
import { pickText, type CatalogLocale, type LocalizedText } from "@/lib/catalog/types";
import { grainedArt } from "@/components/storefront/art";
import { canvasSurface, printSurface, textured } from "@/components/storefront/texture";
import { Ornament, type OrnamentName } from "@/components/decor";
import { cx } from "@/lib/cx";
import { Button } from "@/components/ui/Button";
import { UploadDropzone } from "@/components/storefront/upload/UploadDropzone";
import { useUploadManager } from "@/components/storefront/upload/use-upload-manager";
import type { WizardOptions } from "./fallback-options";
import styles from "./CustomWizard.module.css";

export type WizardType = "shirt" | "painting" | "other";

type ValidationKey =
  | "customSize"
  | "otherMinLen"
  | "placementRequired"
  | "uploadMinOne"
  | "uploadWaiting";

/**
 * Base label snapshot written onto the CartItem (labelAr/labelEn) — data, not UI copy: it ends
 * up stored on the order forever, so it's hardcoded in both languages regardless of the active
 * locale (mirrors CUSTOM_ITEM_LABELS in src/lib/orders/submit.ts).
 */
const CUSTOM_LABEL_BASE: Record<WizardType, LocalizedText> = {
  shirt: { ar: "قميص مخصص", en: "Custom shirt" },
  painting: { ar: "لوحة مخصصة", en: "Custom painting" },
  other: { ar: "طلب فني خاص", en: "Custom art request" },
};

/** Rough per-shirt-type guide prices for the review step's est line — display-only hint,
 * ported from the design prototype; the server never sees or trusts these numbers. */
const ROUGH_SHIRT_BASE: Record<string, number> = {
  classic: 90,
  oversized: 110,
  longsleeve: 120,
  hoodie: 180,
};
const ROUGH_EMBROIDERY_ADD = 35;

/**
 * One ornament per flow, so the wizard header says which kind of piece is being made without
 * relying on the title alone — same vocabulary as the homepage ordering steps.
 */
const FLOW_ORNAMENT: Record<WizardType, OrnamentName> = {
  shirt: "fold",
  painting: "frame",
  other: "star",
};

const ORIENT_ICON: Record<string, { w: number; h: number }> = {
  portrait: { w: 13, h: 20 },
  landscape: { w: 20, h: 13 },
  square: { w: 15, h: 15 },
};

const QTY_MIN = 1;
const QTY_MAX = 30;

function defaultCode(list: Array<{ code: string }>, preferred: string): string {
  if (list.some((o) => o.code === preferred)) return preferred;
  return list[0]?.code ?? preferred;
}

export function CustomWizard({
  options,
  customOtherEnabled,
  initialType,
}: {
  options: WizardOptions;
  customOtherEnabled: boolean;
  initialType: WizardType | null;
}) {
  const locale = useLocale() as CatalogLocale;
  const t = useTranslations("custom");
  const tCommon = useTranslations("common");
  const tActions = useTranslations("actions");
  const addItem = useCartStore((s) => s.addItem);

  const isRtl = locale === "ar";
  const arrow = isRtl ? "←" : "→";
  const arrowBack = isRtl ? "→" : "←";

  const [type, setType] = useState<WizardType | null>(initialType);
  const [step, setStep] = useState(0);
  const [added, setAdded] = useState(false);
  // Shirt flow
  const [stype, setStype] = useState(() => defaultCode(options.shirtTypes, "classic"));
  const [color, setColor] = useState(() => defaultCode(options.colors, "ink"));
  const [size, setSize] = useState(() => defaultCode(options.shirtSizes, "M"));
  const [method, setMethod] = useState(() => defaultCode(options.methods, "print"));
  const [placement, setPlacement] = useState<string[]>(["front"]);
  // Painting flow
  const [psize, setPsize] = useState(() => defaultCode(options.paintingSizes, "A4"));
  const [dimsW, setDimsW] = useState("");
  const [dimsH, setDimsH] = useState("");
  const [orient, setOrient] = useState(() => defaultCode(options.orientations, "portrait"));
  const [material, setMaterial] = useState(() => defaultCode(options.materials, "canvas"));
  const [pstyle, setPstyle] = useState(() => defaultCode(options.paintStyles, "hand"));
  // Shared
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState<ValidationKey | null>(null);
  // Per-wizard-session upload draft id — regenerated on "start another piece" so each custom
  // item's staged files group under their own storage prefix.
  const [draftId, setDraftId] = useState(() => crypto.randomUUID());

  const upload = useUploadManager(draftId);

  const stepsDef = type ? (t.raw(`steps.${type}`) as string[]) : [];
  const last = stepsDef.length - 1;
  const uploadStep = type === "other" ? 1 : 2;

  function validate(): ValidationKey | null {
    if (step === 0 && type === "painting" && psize === "custom" && (!dimsW || !dimsH)) return "customSize";
    if (step === 0 && type === "other" && notes.trim().length < 10) return "otherMinLen";
    if (step === 1 && type === "shirt" && placement.length === 0) return "placementRequired";
    if (step === uploadStep && upload.files.length === 0) return "uploadMinOne";
    if (step === uploadStep && !upload.allVerified) return "uploadWaiting";
    return null;
  }

  function goNext() {
    const e = validate();
    if (e) {
      setErr(e);
      return;
    }
    setErr(null);
    setStep(step + 1);
  }

  function goBack() {
    setErr(null);
    setStep(Math.max(0, step - 1));
  }

  function backToChooser() {
    setType(null);
    setStep(0);
    setErr(null);
  }

  function restart() {
    setType(null);
    setStep(0);
    setNotes("");
    setErr(null);
    setQty(1);
    setDimsW("");
    setDimsH("");
    setAdded(false);
    upload.reset();
    setDraftId(crypto.randomUUID());
  }

  function buildItem(): NewCartItem {
    const base = CUSTOM_LABEL_BASE[type as WizardType];
    const files = upload.stagedFiles;
    if (type === "shirt") {
      const m = options.methods.find((x) => x.code === method);
      return {
        kind: "custom-shirt",
        labelAr: `${base.ar} — ${m?.label.ar ?? method}`,
        labelEn: `${base.en} — ${m?.label.en ?? method}`,
        qty,
        unitPrice: null,
        options: { type: stype, color, size, method, placement },
        notes,
        files,
      };
    }
    if (type === "painting") {
      const s = options.paintStyles.find((x) => x.code === pstyle);
      return {
        kind: "custom-painting",
        labelAr: `${base.ar} — ${s?.label.ar ?? pstyle}`,
        labelEn: `${base.en} — ${s?.label.en ?? pstyle}`,
        qty,
        unitPrice: null,
        options: {
          size: psize,
          ...(psize === "custom" ? { dims: `${dimsW}×${dimsH} cm` } : {}),
          orientation: orient,
          material,
          style: pstyle,
        },
        notes,
        files,
      };
    }
    return {
      kind: "custom-other",
      labelAr: base.ar,
      labelEn: base.en,
      qty: 1,
      unitPrice: null,
      options: {},
      notes,
      files,
    };
  }

  function submitItem() {
    const e = validate();
    if (e) {
      setErr(e);
      return;
    }
    addItem(buildItem());
    setAdded(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---------------------------------------------------------------- success
  if (added) {
    return (
      <div className={styles.successStage}>
        <span aria-hidden="true" className={styles.successSeam} />
        <div className={styles.successBox}>
          <div className={styles.successIcon} aria-hidden="true">
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
          <h2 className={styles.successTitle}>{t("success.title")}</h2>
          <p className={styles.successSub}>{t("success.sub")}</p>
          <div className={styles.successCtas}>
            <Link href="/order" className={styles.ctaAccent}>
              {t("success.reviewCta")}
            </Link>
            <button type="button" onClick={restart} className={styles.ctaOutline}>
              {t("success.againCta")}
            </button>
            <Link href="/shop" className={styles.ctaOutline}>
              {t("success.shopCta")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- chooser
  if (!type) {
    /*
      Each card is a different MATERIAL, not three crops of the same gradient: the shirt is a
      hand-pulled print, the painting a stretched canvas, the open request a loose weave. That is
      the whole promise of the page shown rather than described.
    */
    const cards: Array<{ id: WizardType; art: string; ornament: OrnamentName }> = [
      { id: "shirt", art: printSurface(grainedArt("dawn")), ornament: "fold" },
      { id: "painting", art: canvasSurface(grainedArt("rivers")), ornament: "frame" },
    ];
    if (customOtherEnabled) {
      cards.push({
        id: "other",
        art: textured(grainedArt("letters"), "weaveSoft", "grain"),
        ornament: "star",
      });
    }

    return (
      <div className={styles.chooserGrid}>
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            className={styles.typeCard}
            onClick={() => {
              setType(card.id);
              setStep(0);
              setErr(null);
            }}
          >
            {/*
              `background`, not `backgroundImage`, so the tile also clears any inherited
              background-color in one declaration. Either works: printSurface() emits plain
              <image> layers, guarded by tests/unit/texture.test.ts.
            */}
            <div className={styles.typeCardArt} style={{ background: card.art }}>
              <span aria-hidden="true" className={styles.typeCardScrim} />
              <span aria-hidden="true" className={styles.typeCardMark}>
                <Ornament name={card.ornament} size={20} />
              </span>
              <span className={styles.typeCardTag}>{t(`chooser.${card.id}.tag`)}</span>
            </div>
            <div className={styles.typeCardBody}>
              <div className={styles.typeCardTitle}>{t(`chooser.${card.id}.title`)}</div>
              <div className={styles.typeCardDesc}>{t(`chooser.${card.id}.desc`)}</div>
              <div className={styles.typeCardStart}>
                {t("chooser.startHere")} {arrow}
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  }

  // ---------------------------------------------------------------- wizard
  const colorObj = options.colors.find((c) => c.code === color);

  const sizeLabelForReview =
    psize === "custom"
      ? dimsW && dimsH
        ? `${dimsW}×${dimsH} ${t("fields.cm")}`
        : t("review.customDims")
      : psize;

  const reviewRows: Array<{ k: string; v: string }> =
    type === "shirt"
      ? [
          {
            k: t("fields.shirtType"),
            v: pickText(options.shirtTypes.find((x) => x.code === stype)?.label, locale) || stype,
          },
          { k: t("fields.fabricColor"), v: pickText(colorObj?.name, locale) || color },
          { k: tCommon("size"), v: size },
          { k: tCommon("qty"), v: `× ${qty}` },
          {
            k: tCommon("method"),
            v: pickText(options.methods.find((x) => x.code === method)?.label, locale) || method,
          },
          {
            k: t("fields.placement"),
            v:
              placement
                .map((p) => pickText(options.placements.find((x) => x.code === p)?.label, locale) || p)
                .join(" + ") || "—",
          },
        ]
      : type === "painting"
        ? [
            { k: t("fields.paintSize"), v: sizeLabelForReview },
            {
              k: t("fields.orientation"),
              v: pickText(options.orientations.find((x) => x.code === orient)?.label, locale) || orient,
            },
            {
              k: t("fields.material"),
              v: pickText(options.materials.find((x) => x.code === material)?.label, locale) || material,
            },
            {
              k: t("fields.styleQ"),
              v: pickText(options.paintStyles.find((x) => x.code === pstyle)?.label, locale) || pstyle,
            },
            { k: tCommon("qty"), v: `× ${qty}` },
          ]
        : [{ k: t("review.requestType"), v: t("review.requestTypeValue") }];

  const roughBase = type === "shirt" ? ROUGH_SHIRT_BASE[stype] : undefined;
  const estLine =
    type === "shirt" && roughBase !== undefined
      ? t("review.estLineShirt", {
          amount: `${tCommon("currency")}${(roughBase + (method === "embroidery" ? ROUGH_EMBROIDERY_ADD : 0)) * qty}`,
        })
      : t("review.estLineOther");

  const qtyStepper = (
    <div>
      <div className={styles.fieldLabel}>{tCommon("qty")}</div>
      <div className={styles.qtyBox}>
        <button
          type="button"
          className={styles.qtyBtn}
          aria-label="−"
          onClick={() => setQty(Math.max(QTY_MIN, qty - 1))}
        >
          −
        </button>
        <span className={styles.qtyVal} dir="ltr">
          {qty}
        </span>
        <button
          type="button"
          className={styles.qtyBtn}
          aria-label="+"
          onClick={() => setQty(Math.min(QTY_MAX, qty + 1))}
        >
          +
        </button>
      </div>
    </div>
  );

  // How far the thread has been pulled through the ribbon, 0–100.
  const progressPct = last > 0 ? Math.round((step / last) * 100) : 0;

  return (
    <div className={styles.wizStage}>
      <span aria-hidden="true" className={styles.wizStageGlow} />
      <div className={styles.wizBox}>
        <div className={styles.wizHead}>
          <div className={styles.wizHeadTop}>
            <button type="button" className={styles.backChooserBtn} onClick={backToChooser}>
              {arrowBack} {t("changeType")}
            </button>
            <span className={styles.flowTitle}>
              <Ornament name={FLOW_ORNAMENT[type]} size={16} className={styles.flowMark} />
              {t(`flowTitle.${type}`)}
            </span>
          </div>

          {/*
            The step bar as a progress RIBBON: a running stitch behind the pills, sienna up to
            where you are and pale ink beyond it. The pills keep their "N · label" text — the
            E2E suite matches that literally.
          */}
          <div className={styles.ribbon}>
            <span aria-hidden="true" className={styles.ribbonTrack} />
            <span
              aria-hidden="true"
              className={styles.ribbonFill}
              style={{ inlineSize: `${progressPct}%` }}
            />
            <div className={styles.stepsBar}>
              {stepsDef.map((label, i) => (
                <span
                  key={label}
                  className={cx(
                    styles.stepPill,
                    i === step && styles.stepPillCurrent,
                    i < step && styles.stepPillDone,
                  )}
                >
                  {i + 1} · {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.wizBody}>
          {/* Shirt — Base */}
          {type === "shirt" && step === 0 && (
            <div className={styles.stepCol}>
              <div>
                <div className={styles.fieldLabel}>{t("fields.shirtType")}</div>
                <div className={styles.optGrid}>
                  {options.shirtTypes.map((o) => (
                    <button
                      key={o.code}
                      type="button"
                      className={cx(styles.optBtn, stype === o.code && styles.optBtnOn)}
                      onClick={() => setStype(o.code)}
                    >
                      {pickText(o.label, locale)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className={styles.fieldLabel}>
                  {t("fields.fabricColor")}:{" "}
                  <span className={styles.fieldValue}>{pickText(colorObj?.name, locale)}</span>
                </div>
                <div className={styles.swatchRow}>
                  {options.colors.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      title={pickText(c.name, locale)}
                      aria-pressed={color === c.code}
                      className={cx(styles.swatch, color === c.code && styles.swatchOn)}
                      style={{ background: c.hex }}
                      onClick={() => setColor(c.code)}
                    />
                  ))}
                </div>
              </div>
              <div className={styles.rowWrap}>
                <div>
                  <div className={styles.fieldLabel}>{tCommon("size")}</div>
                  <div className={styles.sizeRow}>
                    {options.shirtSizes.map((s) => (
                      <button
                        key={s.code}
                        type="button"
                        className={cx(styles.sizeBtn, size === s.code && styles.optBtnOn)}
                        onClick={() => setSize(s.code)}
                      >
                        {s.code}
                      </button>
                    ))}
                  </div>
                </div>
                {qtyStepper}
              </div>
            </div>
          )}

          {/* Shirt — Method */}
          {type === "shirt" && step === 1 && (
            <div className={styles.stepCol}>
              <div>
                <div className={styles.fieldLabel}>{tCommon("method")}</div>
                <div className={styles.cardGrid}>
                  {options.methods.map((m) => (
                    <button
                      key={m.code}
                      type="button"
                      className={cx(styles.selCard, method === m.code && styles.selCardOn)}
                      onClick={() => setMethod(m.code)}
                    >
                      <div className={styles.selCardTitle}>{pickText(m.label, locale)}</div>
                      {(m.code === "print" || m.code === "embroidery") && (
                        <div className={styles.selCardDesc}>{t(`methods.${m.code}.desc`)}</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className={styles.fieldLabel}>{t("fields.placement")}</div>
                <div className={styles.fieldHint}>{t("fields.placementHint")}</div>
                <div className={styles.chipRow}>
                  {options.placements.map((p) => {
                    const on = placement.includes(p.code);
                    return (
                      <button
                        key={p.code}
                        type="button"
                        aria-pressed={on}
                        className={cx(styles.pillBtn, on && styles.optBtnOn)}
                        onClick={() =>
                          setPlacement(on ? placement.filter((x) => x !== p.code) : [...placement, p.code])
                        }
                      >
                        {on ? "✓ " : ""}
                        {pickText(p.label, locale)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Painting — Base */}
          {type === "painting" && step === 0 && (
            <div className={styles.stepCol}>
              <div>
                <div className={styles.fieldLabel}>{t("fields.paintSize")}</div>
                <div className={styles.sizeRow}>
                  {options.paintingSizes.map((s) => (
                    <button
                      key={s.code}
                      type="button"
                      className={cx(styles.psizeBtn, psize === s.code && styles.optBtnOn)}
                      onClick={() => setPsize(s.code)}
                    >
                      {s.code === "custom" ? t("fields.customSizeLabel") : s.code}
                    </button>
                  ))}
                </div>
                {psize === "custom" && (
                  <div className={styles.dimsRow}>
                    <input
                      value={dimsW}
                      onChange={(e) => setDimsW(e.target.value.replace(/\D/g, ""))}
                      placeholder={t("fields.widthPh")}
                      inputMode="numeric"
                      className={styles.dimInput}
                    />
                    <span className={styles.dimSep}>×</span>
                    <input
                      value={dimsH}
                      onChange={(e) => setDimsH(e.target.value.replace(/\D/g, ""))}
                      placeholder={t("fields.heightPh")}
                      inputMode="numeric"
                      className={styles.dimInput}
                    />
                    <span className={styles.dimUnit}>{t("fields.cm")}</span>
                  </div>
                )}
              </div>
              <div>
                <div className={styles.fieldLabel}>{t("fields.orientation")}</div>
                <div className={styles.chipRow}>
                  {options.orientations.map((o) => {
                    const icon = ORIENT_ICON[o.code] ?? { w: 13, h: 13 };
                    return (
                      <button
                        key={o.code}
                        type="button"
                        className={cx(styles.orientBtn, orient === o.code && styles.optBtnOn)}
                        onClick={() => setOrient(o.code)}
                      >
                        <span
                          className={styles.orientIcon}
                          style={{ width: icon.w, height: icon.h }}
                          aria-hidden="true"
                        />
                        {pickText(o.label, locale)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className={styles.fieldLabel}>{t("fields.material")}</div>
                <div className={styles.chipRow}>
                  {options.materials.map((m) => (
                    <button
                      key={m.code}
                      type="button"
                      className={cx(styles.psizeBtn, material === m.code && styles.optBtnOn)}
                      onClick={() => setMaterial(m.code)}
                    >
                      {pickText(m.label, locale)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Painting — Style */}
          {type === "painting" && step === 1 && (
            <div>
              <div className={styles.fieldLabel}>{t("fields.styleQ")}</div>
              <div className={styles.cardGrid}>
                {options.paintStyles.map((s) => (
                  <button
                    key={s.code}
                    type="button"
                    className={cx(styles.selCard, pstyle === s.code && styles.selCardOn)}
                    onClick={() => setPstyle(s.code)}
                  >
                    <div className={styles.selCardTitle}>{pickText(s.label, locale)}</div>
                    {(s.code === "printed" || s.code === "hand" || s.code === "interpret") && (
                      <div className={styles.selCardDesc}>{t(`paintStyles.${s.code}.desc`)}</div>
                    )}
                  </button>
                ))}
              </div>
              <div className={styles.qtyBlock}>{qtyStepper}</div>
            </div>
          )}

          {/* Other — Idea */}
          {type === "other" && step === 0 && (
            <div>
              <div className={styles.fieldLabel}>{t("fields.otherQ")}</div>
              <div className={styles.fieldHint}>{t("fields.otherHint")}</div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={6}
                placeholder={t("fields.otherPh")}
                className={styles.textarea}
              />
            </div>
          )}

          {/* Upload step (all flows) */}
          {step === uploadStep && (
            <div className={styles.stepCol}>
              <UploadDropzone manager={upload} />
              {type !== "other" && (
                <div>
                  <div className={styles.fieldLabel}>{t("upload.instructions")}</div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    placeholder={t("upload.instructionsPh")}
                    className={styles.textarea}
                  />
                </div>
              )}
            </div>
          )}

          {/* Review step */}
          {step === last && (
            <div className={styles.stepCol}>
              <div className={styles.reviewGrid}>
                {reviewRows.map((row) => (
                  <div key={row.k} className={styles.reviewCell}>
                    <div className={styles.reviewK}>{row.k}</div>
                    <div className={styles.reviewV}>{row.v}</div>
                  </div>
                ))}
              </div>
              {upload.files.length > 0 && (
                <div>
                  <div className={styles.reviewFilesLabel}>
                    {t("review.attached")} (<span dir="ltr">{upload.files.length}</span>)
                  </div>
                  <div className={styles.reviewThumbRow}>
                    {upload.files.map((f) => (
                      <div
                        key={f.id}
                        title={f.name}
                        className={styles.reviewThumb}
                        style={
                          f.previewDataUrl ? { backgroundImage: `url(${f.previewDataUrl})` } : undefined
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
              {notes.trim() && (
                <div className={styles.reviewNotes}>
                  <div className={styles.reviewK}>{tCommon("notes")}</div>
                  <div className={styles.reviewNotesText}>{notes.trim()}</div>
                </div>
              )}
              <div className={styles.estRow}>
                <div className={styles.estLine}>{estLine}</div>
                <span className={styles.manualChip}>{tCommon("manualPrice")}</span>
              </div>
            </div>
          )}

          {err && (
            <div className={styles.errBanner} role="alert">
              {t(`validation.${err}`)}
            </div>
          )}

          <div className={styles.navRow}>
            {step > 0 && (
              <Button variant="outline" onClick={goBack}>
                {tActions("back")}
              </Button>
            )}
            <div className={styles.navSpacer} />
            {step < last && (
              <Button variant="primary" onClick={goNext}>
                {tActions("next")} {arrow}
              </Button>
            )}
            {step === last && (
              <Button variant="accent" onClick={submitItem}>
                {tActions("addToOrder")}
              </Button>
            )}
            </div>
        </div>
      </div>
    </div>
  );
}
