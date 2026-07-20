"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StagedFile } from "@/lib/cart/store";
import {
  MAX_UPLOAD_FILES,
  validateUpload,
  type AllowedUploadMime,
} from "@/lib/storage/validation";
import { processImageFile } from "./image-processing";

/**
 * Client-side manager for the signed-upload pipeline used by the custom-order wizard:
 *
 *   1. validate + downscale locally (see image-processing.ts)          → progress 5
 *   2. POST /api/uploads/sign  {draftId, filename, size, mimeType, …} → progress 10
 *   3. PUT  <signedUrl>        (raw bytes; Supabase signed upload URL) → progress 70
 *   4. POST /api/uploads/verify {draftId, path}                        → progress 100 (done)
 *
 * Files are processed strictly sequentially (a promise chain) so `existingCount` sent to the
 * sign endpoint is always accurate and the per-IP rate limits aren't hammered by a multi-drop.
 * Verified files become cart-ready `StagedFile`s; anything mid-pipeline or failed blocks the
 * wizard's step advance (see `allVerified`).
 */

/** The full bucketPath form the order schemas validate (`startsWith("order-uploads/")`).
 * Mirrors `toOrderUploadsBucketPath` in src/lib/storage/uploads.ts — that helper is
 * server-only, so the client re-states the prefix here; both derive from the same
 * "order-uploads" bucket name and the sign endpoint's bucket-relative `path`. */
const ORDER_UPLOADS_BUCKET_PREFIX = "order-uploads/";

/** Sign-endpoint `filename` is capped at 200 chars — keep the END of the name (the extension). */
const MAX_FILENAME_LEN = 200;

export type UploadErrorKey =
  | "errorTooMany"
  | "errorType"
  | "errorSize"
  | "errorRead"
  | "errorSign"
  | "errorUpload"
  | "errorVerify"
  | "errorRejected";

/** A translation-ready error: `key` under the `custom.upload` namespace + ICU values. */
export type UploadError = { key: UploadErrorKey; values?: Record<string, string | number> };

export type UploadFileStatus = "processing" | "signing" | "uploading" | "verifying" | "done" | "error";

export type ManagedUploadFile = {
  id: string;
  name: string;
  /** Uppercased display extension, e.g. "JPG". */
  ext: string;
  /** Byte size of what is (or will be) uploaded — post-downscale. */
  size: number;
  /** Small JPEG data URL for the thumbnail; empty string until decoding finishes. */
  previewDataUrl: string;
  /** 0–100 across the sign→upload→verify milestones. */
  progress: number;
  status: UploadFileStatus;
  error: UploadError | null;
  /** Set once verified — the cart-ready form. */
  staged: StagedFile | null;
};

export type UploadManager = {
  files: ManagedUploadFile[];
  /** Latest add-time error (unsupported type, over-size, over-count) — shown as a banner. */
  bannerError: UploadError | null;
  addFiles: (list: FileList | File[] | null) => void;
  removeFile: (id: string) => void;
  /** Drops every file (in-flight pipelines abort their state updates). */
  reset: () => void;
  /** Cart-ready files, in list order. */
  stagedFiles: StagedFile[];
  /** True when at least one file exists and every file is verified. */
  allVerified: boolean;
  /** True while any file is still in the pipeline (not done, not failed). */
  anyPending: boolean;
};

function truncateName(name: string): string {
  return name.length > MAX_FILENAME_LEN ? name.slice(name.length - MAX_FILENAME_LEN) : name;
}

function displayExt(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toUpperCase().slice(0, 4);
}

export function useUploadManager(draftId: string): UploadManager {
  const [files, setFiles] = useState<ManagedUploadFile[]>([]);
  const [bannerError, setBannerError] = useState<UploadError | null>(null);

  // Latest-value refs so the sequential async pipeline always sees current values without
  // re-binding (synced in effects; `addFiles` also updates filesRef eagerly so multiple files
  // added in one event tick count each other before the next render flushes).
  const filesRef = useRef<ManagedUploadFile[]>(files);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);
  const draftIdRef = useRef(draftId);
  useEffect(() => {
    draftIdRef.current = draftId;
  }, [draftId]);
  const removedIdsRef = useRef<Set<string>>(new Set());
  const chainRef = useRef<Promise<void>>(Promise.resolve());

  const patchFile = useCallback((id: string, patch: Partial<ManagedUploadFile>) => {
    if (removedIdsRef.current.has(id)) return;
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  const runPipeline = useCallback(
    async (id: string, file: File) => {
      if (removedIdsRef.current.has(id)) return;
      const fail = (key: UploadErrorKey) =>
        patchFile(id, { status: "error", error: { key, values: { name: file.name } } });

      // 1) Decode + downscale locally.
      let processed;
      try {
        processed = await processImageFile(file);
      } catch {
        fail("errorRead");
        return;
      }
      if (removedIdsRef.current.has(id)) return;
      patchFile(id, {
        previewDataUrl: processed.previewDataUrl,
        size: processed.blob.size,
        status: "signing",
        progress: 5,
      });

      // 2) Sign. `existingCount` counts the other live (non-failed) slots at this moment —
      // accurate because pipelines run one at a time.
      const existingCount = filesRef.current.filter(
        (f) => f.id !== id && !removedIdsRef.current.has(f.id) && f.status !== "error",
      ).length;
      const filename = truncateName(file.name);
      let signed: { path: string; signedUrl: string };
      try {
        const res = await fetch("/api/uploads/sign", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            draftId: draftIdRef.current,
            filename,
            size: processed.blob.size,
            mimeType: processed.mimeType,
            existingCount,
          }),
        });
        if (!res.ok) {
          fail("errorSign");
          return;
        }
        signed = (await res.json()) as { path: string; signedUrl: string };
      } catch {
        fail("errorSign");
        return;
      }
      if (removedIdsRef.current.has(id)) return;
      patchFile(id, { status: "uploading", progress: 10 });

      // 3) Upload the bytes straight to storage (Supabase signed upload URLs accept PUT).
      try {
        const res = await fetch(signed.signedUrl, {
          method: "PUT",
          headers: { "content-type": processed.mimeType },
          body: processed.blob,
        });
        if (!res.ok) {
          fail("errorUpload");
          return;
        }
      } catch {
        fail("errorUpload");
        return;
      }
      if (removedIdsRef.current.has(id)) return;
      patchFile(id, { status: "verifying", progress: 70 });

      // 4) Verify — the server reads the object's real metadata and is the authority on
      // whether the upload is acceptable.
      try {
        const res = await fetch("/api/uploads/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ draftId: draftIdRef.current, path: signed.path }),
        });
        if (res.status === 422) {
          fail("errorRejected");
          return;
        }
        if (!res.ok) {
          fail("errorVerify");
          return;
        }
        const verified = (await res.json()) as { ok: boolean; size: number; mimeType: string };
        if (removedIdsRef.current.has(id)) return;
        const staged: StagedFile = {
          bucketPath: `${ORDER_UPLOADS_BUCKET_PREFIX}${signed.path}`,
          originalName: filename,
          // The verify endpoint only returns ok after checking the mime against the allowlist.
          mimeType: verified.mimeType as AllowedUploadMime,
          size: verified.size,
          previewDataUrl: processed.previewDataUrl,
        };
        patchFile(id, { status: "done", progress: 100, size: verified.size, staged });
      } catch {
        fail("errorVerify");
      }
    },
    [patchFile],
  );

  const addFiles = useCallback(
    (list: FileList | File[] | null) => {
      setBannerError(null);
      const incoming = Array.from(list ?? []);
      if (incoming.length === 0) return;

      const room = MAX_UPLOAD_FILES - filesRef.current.length;
      if (incoming.length > room) {
        setBannerError({ key: "errorTooMany", values: { max: MAX_UPLOAD_FILES } });
      }

      for (const file of incoming.slice(0, Math.max(0, room))) {
        const validation = validateUpload({ mimeType: file.type, size: file.size, filename: file.name });
        if (!validation.ok) {
          setBannerError({
            key: validation.reason === "size" ? "errorSize" : "errorType",
            values: { name: file.name },
          });
          continue;
        }
        const id = crypto.randomUUID();
        const entry: ManagedUploadFile = {
          id,
          name: file.name,
          ext: displayExt(file.name),
          size: file.size,
          previewDataUrl: "",
          progress: 2,
          status: "processing",
          error: null,
          staged: null,
        };
        setFiles((prev) => [...prev, entry]);
        filesRef.current = [...filesRef.current, entry];
        chainRef.current = chainRef.current.then(() => runPipeline(id, file));
      }
    },
    [runPipeline],
  );

  const removeFile = useCallback((id: string) => {
    removedIdsRef.current.add(id);
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setBannerError(null);
  }, []);

  const reset = useCallback(() => {
    for (const f of filesRef.current) removedIdsRef.current.add(f.id);
    setFiles([]);
    setBannerError(null);
  }, []);

  const stagedFiles = useMemo(
    () => files.filter((f) => f.staged !== null).map((f) => f.staged as StagedFile),
    [files],
  );

  return {
    files,
    bannerError,
    addFiles,
    removeFile,
    reset,
    stagedFiles,
    allVerified: files.length > 0 && files.every((f) => f.status === "done"),
    anyPending: files.some((f) => f.status !== "done" && f.status !== "error"),
  };
}
