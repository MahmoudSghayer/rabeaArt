import type { AllowedUploadMime } from "@/lib/storage/validation";

/**
 * Client-side image pre-processing for the custom-order upload flow. Ports the downscale
 * behaviour of `readImageFile` in `_design-reference/store.js`: images larger than 760px on
 * their longest edge are re-encoded to JPEG (quality 0.72) before upload; smaller images are
 * uploaded as their original bytes (keeping their PNG/WebP mime). A separate, much smaller
 * JPEG data-URL preview is always produced for thumbnails — it ends up persisted inside the
 * cart's localStorage (StagedFile.previewDataUrl), so it's capped tightly to keep the cart
 * payload light.
 */

/** Longest-edge cap for the uploaded bytes (matches the design prototype's `max=760`). */
const UPLOAD_MAX_DIM = 760;
/** Longest-edge cap for the localStorage thumbnail preview. */
const PREVIEW_MAX_DIM = 240;
const JPEG_QUALITY = 0.72;

export type ProcessedImage = {
  /** The bytes to upload — the original file, or a downscaled JPEG re-encode. */
  blob: Blob;
  /** Mime of `blob` ("image/jpeg" when re-encoded, otherwise the original file's mime). */
  mimeType: AllowedUploadMime;
  /** Small JPEG data URL for thumbnails; safe to persist in the cart. */
  previewDataUrl: string;
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image failed to decode"));
    img.src = url;
  });
}

function drawScaled(img: HTMLImageElement, maxDim: number): HTMLCanvasElement {
  const k = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas encode failed"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

/**
 * Decodes `file`, producing the upload bytes and a small preview. Throws on any decode/encode
 * failure (corrupt file, unsupported codec) — callers surface that as a per-file error.
 * The caller is responsible for having validated `file.type` against the upload allowlist
 * before calling (see `validateUpload` in @/lib/storage/validation).
 */
export async function processImageFile(file: File): Promise<ProcessedImage> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const previewDataUrl = drawScaled(img, PREVIEW_MAX_DIM).toDataURL("image/jpeg", JPEG_QUALITY);

    const needsDownscale = Math.max(img.naturalWidth, img.naturalHeight) > UPLOAD_MAX_DIM;
    if (needsDownscale) {
      const blob = await canvasToJpegBlob(drawScaled(img, UPLOAD_MAX_DIM));
      return { blob, mimeType: "image/jpeg", previewDataUrl };
    }
    return { blob: file, mimeType: file.type as AllowedUploadMime, previewDataUrl };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** "1.2 MB" / "340 KB" — ported from `fmtBytes` in `_design-reference/store.js`. */
export function formatBytes(bytes: number): string {
  return bytes > 1048576
    ? `${(bytes / 1048576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
