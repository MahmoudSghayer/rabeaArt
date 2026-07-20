"use client";

import { useEffect, useRef, useState } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { validateUpload } from "@/lib/storage/validation";
import { processProductImageFile } from "./imageProcessing";
import { productImagePublicUrl } from "./productImageUrl";
import type { ProductFormValues } from "./schema";
import styles from "./ProductForm.module.css";

const MAX_IMAGES = 6;

type PendingUpload = { id: string; name: string; error: string | null };

/**
 * Up-to-6 product photo manager: uploads via the admin's signed-upload route
 * (`/api/admin/product-images/sign`, requireRole ADMIN), client-preprocesses each file
 * (`imageProcessing.ts` — canvas re-encode, max 1600px), then appends `{path, alt, isPrimary,
 * sortOrder}` to the `images` field array once the PUT completes. Reorder is ↑/↓ buttons (no
 * drag-and-drop, per the plan) via `swap`; primary is a radio; `sortOrder` is cosmetic during
 * editing — ProductForm recomputes it from array order right before submit.
 */
export function ImagesField({ draftId }: { draftId: string }) {
  const t = useTranslations("adminProductForm");
  const { control, register } = useFormContext<ProductFormValues>();
  const { fields, append, swap, replace } = useFieldArray({ control, name: "images" });

  // Mirrors `fields` for the async upload pipeline (runUpload/addFiles run outside render, after
  // network awaits, where reading a ref is safe — only *during render* is disallowed). Kept in an
  // effect rather than assigned inline during render, per the react-hooks/refs rule.
  const fieldsRef = useRef(fields);
  useEffect(() => {
    fieldsRef.current = fields;
  }, [fields]);

  const [pending, setPending] = useState<PendingUpload[]>([]);
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  const inputRef = useRef<HTMLInputElement | null>(null);

  function room(): number {
    return MAX_IMAGES - fieldsRef.current.length - pending.length;
  }

  function updatePending(id: string, patch: Partial<PendingUpload>) {
    setPending((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function runUpload(id: string, file: File) {
    try {
      const processed = await processProductImageFile(file);
      const res = await fetch("/api/admin/product-images/sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId: draftId,
          filename: file.name,
          size: processed.blob.size,
          mimeType: processed.mimeType,
          existingCount: fieldsRef.current.length,
        }),
      });
      if (!res.ok) throw new Error("sign failed");
      const signed = (await res.json()) as { path: string; signedUrl: string };

      const putRes = await fetch(signed.signedUrl, {
        method: "PUT",
        headers: { "content-type": processed.mimeType },
        body: processed.blob,
      });
      if (!putRes.ok) throw new Error("upload failed");

      append({
        path: signed.path,
        alt: "",
        isPrimary: fieldsRef.current.length === 0,
        sortOrder: fieldsRef.current.length,
      });
      setPending((prev) => prev.filter((p) => p.id !== id));
    } catch {
      updatePending(id, { error: t("imageUploadError") });
    }
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list);
    const slots = room();

    for (const file of incoming.slice(0, Math.max(0, slots))) {
      const validation = validateUpload({ mimeType: file.type, size: file.size, filename: file.name });
      if (!validation.ok) {
        const id = crypto.randomUUID();
        setPending((prev) => [...prev, { id, name: file.name, error: t("imageInvalid") }]);
        continue;
      }
      const id = crypto.randomUUID();
      setPending((prev) => [...prev, { id, name: file.name, error: null }]);
      chainRef.current = chainRef.current.then(() => runUpload(id, file));
    }
  }

  function removeImage(index: number) {
    const removedWasPrimary = fields[index]?.isPrimary ?? false;
    const remaining = fields.filter((_, i) => i !== index);
    const hasPrimary = remaining.some((f) => f.isPrimary);
    replace(
      remaining.map((f, i) => ({
        path: f.path,
        alt: f.alt,
        sortOrder: i,
        isPrimary: removedWasPrimary && !hasPrimary ? i === 0 : f.isPrimary,
      })),
    );
  }

  function setPrimary(index: number) {
    replace(fields.map((f, i) => ({ path: f.path, alt: f.alt, sortOrder: f.sortOrder, isPrimary: i === index })));
  }

  function dismissPending(id: string) {
    setPending((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className={styles.imagesField}>
      <div className={styles.imagesGrid}>
        {fields.map((field, index) => (
          <div key={field.id} className={styles.imageTile}>
            <div
              className={styles.imageThumb}
              style={{ backgroundImage: `url(${productImagePublicUrl(field.path)})` }}
            />
            <label className={styles.imagePrimaryRadio}>
              <input type="radio" checked={field.isPrimary} onChange={() => setPrimary(index)} />
              {t("imagePrimary")}
            </label>
            <input
              type="text"
              placeholder={t("imageAltPlaceholder")}
              className={styles.imageAltInput}
              {...register(`images.${index}.alt` as const)}
            />
            <div className={styles.imageTileActions}>
              <button
                type="button"
                onClick={() => swap(index, index - 1)}
                disabled={index === 0}
                className={styles.imageMoveBtn}
                aria-label={t("imageMoveUp")}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => swap(index, index + 1)}
                disabled={index === fields.length - 1}
                className={styles.imageMoveBtn}
                aria-label={t("imageMoveDown")}
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeImage(index)}
                className={styles.imageRemoveBtn}
                aria-label={t("imageRemove")}
              >
                ×
              </button>
            </div>
          </div>
        ))}

        {pending.map((p) => (
          <div key={p.id} className={styles.imageTile}>
            <div className={styles.imageThumbPending}>{p.error ? "!" : "…"}</div>
            <div className={styles.imagePendingName}>{p.name}</div>
            {p.error && (
              <>
                <div className={styles.imageError}>{p.error}</div>
                <button type="button" onClick={() => dismissPending(p.id)} className={styles.imageRemoveBtn}>
                  {t("imageDismiss")}
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      <div className={styles.imagesFooter}>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={fields.length + pending.length >= MAX_IMAGES}
          className={styles.imagesUploadBtn}
        >
          + {t("imageAdd")}
        </button>
        <span className={styles.imagesCount}>
          {fields.length + pending.length}/{MAX_IMAGES} · {t("imageHint")}
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className={styles.hiddenInput}
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
