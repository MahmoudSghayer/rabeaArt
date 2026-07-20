"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { cx } from "@/lib/cx";
import styles from "./files.module.css";

export type FileCardData = {
  id: string;
  name: string;
  sizeLabel: string;
  extension: string;
  /** Server-signed 120s preview URL (see page.tsx) — null when the file isn't an image, or when
   * signing failed (object missing, storage error). */
  previewUrl: string | null;
  orderId: string;
  orderRef: string;
  customerFirstName: string;
};

export interface FilesViewProps {
  files: FileCardData[];
  total: number;
  page: number;
  pageSize: number;
  baseQuery: string;
}

function pageHref(baseQuery: string, page: number): string {
  const qs = baseQuery ? `${baseQuery}&page=${page}` : `page=${page}`;
  return `/admin/files?${qs}`;
}

/** A single grid card's thumbnail: tries the signed preview image, falling back to the
 * file-type card (extension chip) on load error — covers both "not an image" (no `previewUrl` at
 * all) and "signed URL exists but the fetch failed" (broken `<img>`). */
function FileThumb({ file }: { file: FileCardData }) {
  const [broken, setBroken] = useState(false);
  const showImage = file.previewUrl && !broken;

  return (
    <div className={styles.thumbWrap}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL, not a static/optimizable asset
        <img src={file.previewUrl!} alt="" className={styles.thumbImg} onError={() => setBroken(true)} />
      ) : (
        <div className={styles.thumbType}>
          <span className={styles.fileIcon} aria-hidden="true">
            🗎
          </span>
          <span className={styles.extChip}>{file.extension}</span>
        </div>
      )}
    </div>
  );
}

export function FilesView({ files, total, page, pageSize, baseQuery }: FilesViewProps) {
  const t = useTranslations("adminFiles");
  const tCommon = useTranslations("adminCommon");
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  if (files.length === 0) {
    return <div className={styles.empty}>{t("noFiles")}</div>;
  }

  return (
    <>
      <div className={styles.grid}>
        {files.map((file) => (
          <div key={file.id} className={styles.card}>
            <FileThumb file={file} />
            <div className={styles.name} dir="ltr">
              {file.name}
            </div>
            <div className={styles.metaRow}>
              <span dir="ltr">{file.sizeLabel}</span>
              <span dir="ltr">{file.extension}</span>
            </div>
            <div className={styles.actions}>
              <Link href={`/admin/orders/${file.orderId}`} className={styles.orderBtn}>
                <span dir="ltr">{file.orderRef}</span> · {file.customerFirstName}
              </Link>
              <a href={`/api/admin/files/${file.id}`} download className={styles.dlBtn}>
                {tCommon("download")}
              </a>
            </div>
          </div>
        ))}
      </div>

      {pageCount > 1 && (
        <div className={styles.pagination}>
          <Link
            href={pageHref(baseQuery, Math.max(1, page - 1))}
            className={cx(styles.pageBtn, page <= 1 && styles.pageBtnDisabled)}
            aria-disabled={page <= 1}
          >
            {tCommon("previous")}
          </Link>
          <span className={styles.pageInfo}>
            {tCommon("page")} {page} {tCommon("of")} {pageCount}
          </span>
          <Link
            href={pageHref(baseQuery, Math.min(pageCount, page + 1))}
            className={cx(styles.pageBtn, page >= pageCount && styles.pageBtnDisabled)}
            aria-disabled={page >= pageCount}
          >
            {tCommon("next")}
          </Link>
        </div>
      )}
    </>
  );
}
