import type { AllowedUploadMime } from "@/lib/storage/validation";

/**
 * Client-side image pre-processing for product photos — same canvas-based downscale approach as
 * `src/components/storefront/upload/image-processing.ts` (load → draw scaled → re-encode), but
 * with product-photography-appropriate settings instead of that module's order-attachment ones:
 * a much larger longest-edge cap (1600px vs 760px) and a higher JPEG quality, since these images
 * are shown full-size on public product pages rather than as small admin thumbnails. Not reused
 * directly because `UPLOAD_MAX_DIM`/`JPEG_QUALITY` are internal constants there, not parameters.
 */

const UPLOAD_MAX_DIM = 1600;
const JPEG_QUALITY = 0.85;

export type ProcessedProductImage = {
  /** The bytes to upload — the original file, or a downscaled JPEG re-encode. */
  blob: Blob;
  mimeType: AllowedUploadMime;
  /** Local object URL for an immediate thumbnail preview; caller must revoke it when done. */
  previewUrl: string;
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
 * Decodes `file`, downscaling to at most 1600px on the longest edge (re-encoded as JPEG) when
 * needed; smaller images upload as their original bytes/format. Throws on any decode/encode
 * failure — the caller (ImagesField) surfaces that as a per-file error. Caller must have already
 * validated `file.type`/`file.size` against the upload allowlist (see `validateUpload`).
 */
export async function processProductImageFile(file: File): Promise<ProcessedProductImage> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const needsDownscale = Math.max(img.naturalWidth, img.naturalHeight) > UPLOAD_MAX_DIM;
    if (needsDownscale) {
      const canvas = drawScaled(img, UPLOAD_MAX_DIM);
      const blob = await canvasToJpegBlob(canvas);
      return { blob, mimeType: "image/jpeg", previewUrl: URL.createObjectURL(blob) };
    }
    return { blob: file, mimeType: file.type as AllowedUploadMime, previewUrl: URL.createObjectURL(file) };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
