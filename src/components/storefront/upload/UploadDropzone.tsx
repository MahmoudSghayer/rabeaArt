"use client";

import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Ornament } from "@/components/decor";
import { cx } from "@/lib/cx";
import { formatBytes } from "./image-processing";
import type { UploadManager } from "./use-upload-manager";
import styles from "./UploadDropzone.module.css";

/**
 * Drop-zone + thumbnail grid for the custom-order upload flow (ported from the `sUpload` step
 * of `_design-reference/Custom.dc.html`). Purely presentational — all pipeline state lives in
 * the `UploadManager` from `useUploadManager`, so the wizard owns files across steps.
 * Translations come from the `custom.upload` namespace (see src/messages/flow-*.json).
 *
 * The one piece of local state is `dragOver`, and it exists because a drop target that does not
 * visibly react is a drop target people do not trust. It is tracked with a DEPTH COUNTER rather
 * than a boolean: `dragenter`/`dragleave` fire for every descendant the pointer crosses, so a
 * naive boolean flickers off the moment the cursor passes over the icon or the caption.
 */
export function UploadDropzone({ manager }: { manager: UploadManager }) {
  const t = useTranslations("custom.upload");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dragDepth = useRef(0);
  const [dragOver, setDragOver] = useState(false);

  const openPicker = () => inputRef.current?.click();

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPicker();
    }
  };

  const onDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragDepth.current += 1;
    setDragOver(true);
  };

  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragOver(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragOver(false);
    manager.addFiles(e.dataTransfer.files);
  };

  return (
    <div className={styles.wrap}>
      <div
        role="button"
        tabIndex={0}
        aria-label={t("dropTitle")}
        className={cx(styles.dropzone, dragOver && styles.dropzoneOver)}
        onClick={openPicker}
        onKeyDown={onKeyDown}
        onDragEnter={onDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {/* Decorative only: the stitched border, the drag glow and the paper the icon sits on. */}
        <span aria-hidden="true" className={styles.dropSeam} />
        <span aria-hidden="true" className={styles.dropGlow} />

        <span aria-hidden="true" className={styles.dropPlate}>
          <span className={styles.dropSheetBack} />
          <span className={styles.dropSheetFront} />
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={styles.dropIcon}
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <path d="m17 8-5-5-5 5" />
            <path d="M12 3v12" />
          </svg>
        </span>

        <div className={styles.dropTitle}>{t("dropTitle")}</div>
        <div className={styles.dropHint} dir="ltr">
          {t("dropHint")}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className={styles.hiddenInput}
        onChange={(e) => {
          manager.addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {manager.bannerError && (
        <div className={styles.errorBanner} role="alert">
          <Ornament name="scissors" size={15} className={styles.errorMark} />
          <span>{t(manager.bannerError.key, manager.bannerError.values)}</span>
        </div>
      )}

      {manager.files.length > 0 && (
        <div className={styles.grid}>
          {manager.files.map((file) => (
            <div
              key={file.id}
              className={cx(
                styles.tile,
                file.status === "done" && styles.tileDone,
                file.status === "error" && styles.tileError,
              )}
            >
              <span aria-hidden="true" className={styles.thumbFrame}>
                <span
                  className={styles.thumb}
                  style={file.previewDataUrl ? { backgroundImage: `url(${file.previewDataUrl})` } : undefined}
                />
                {/* The canvas weave sits OVER the photograph, so a preview reads as an image
                    printed on cloth rather than a floating JPEG. */}
                <span className={styles.thumbWeave} />
              </span>
              <button
                type="button"
                title={t("removeImg")}
                aria-label={t("removeImg")}
                className={styles.removeBtn}
                onClick={() => manager.removeFile(file.id)}
              >
                ×
              </button>
              <div className={styles.fileName} dir="ltr">
                {file.name}
              </div>
              <div className={styles.fileMeta}>
                <span className={styles.fileSize} dir="ltr">
                  {formatBytes(file.size)}
                </span>
                {file.ext && (
                  <span className={styles.fileExt} dir="ltr">
                    {file.ext}
                  </span>
                )}
              </div>
              {/* Progress as a seam being sewn: the pale running stitch is the path, the sienna
                  one is the thread that has actually been pulled through. A finished file keeps
                  its closed seam instead of the bar vanishing, so "done" has a resting state. */}
              {file.status !== "error" && (
                <div className={styles.progressTrack}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${file.status === "done" ? 100 : file.progress}%` }}
                  />
                </div>
              )}
              {file.error && (
                <div className={cx(styles.fileError)} role="alert">
                  {t(file.error.key, file.error.values)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
