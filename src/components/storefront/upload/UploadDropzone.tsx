"use client";

import { useRef, type DragEvent, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { cx } from "@/lib/cx";
import { formatBytes } from "./image-processing";
import type { UploadManager } from "./use-upload-manager";
import styles from "./UploadDropzone.module.css";

/**
 * Drop-zone + thumbnail grid for the custom-order upload flow (ported from the `sUpload` step
 * of `_design-reference/Custom.dc.html`). Purely presentational — all pipeline state lives in
 * the `UploadManager` from `useUploadManager`, so the wizard owns files across steps.
 * Translations come from the `custom.upload` namespace (see src/messages/flow-*.json).
 */
export function UploadDropzone({ manager }: { manager: UploadManager }) {
  const t = useTranslations("custom.upload");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const openPicker = () => inputRef.current?.click();

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPicker();
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    manager.addFiles(e.dataTransfer.files);
  };

  return (
    <div className={styles.wrap}>
      <div
        role="button"
        tabIndex={0}
        aria-label={t("dropTitle")}
        className={styles.dropzone}
        onClick={openPicker}
        onKeyDown={onKeyDown}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <svg
          width="34"
          height="34"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="m17 8-5-5-5 5" />
          <path d="M12 3v12" />
        </svg>
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
          {t(manager.bannerError.key, manager.bannerError.values)}
        </div>
      )}

      {manager.files.length > 0 && (
        <div className={styles.grid}>
          {manager.files.map((file) => (
            <div key={file.id} className={styles.tile}>
              <div
                className={styles.thumb}
                style={file.previewDataUrl ? { backgroundImage: `url(${file.previewDataUrl})` } : undefined}
              />
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
              {file.status !== "done" && file.status !== "error" && (
                <div className={styles.progressTrack}>
                  <div className={styles.progressFill} style={{ width: `${file.progress}%` }} />
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
