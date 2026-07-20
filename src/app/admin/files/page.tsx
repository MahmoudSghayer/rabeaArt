import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "../_lib/require";
import { createTranslator, getAdminLocale, getAdminMessages } from "../_lib/messages";
import { formatBytes } from "@/components/admin/format";
import {
  createSignedDownloadUrl,
  fromOrderUploadsBucketPath,
  ORDER_UPLOADS_BUCKET,
} from "@/lib/storage/uploads";
import { buildFilesWhere, FILES_PAGE_SIZE, firstValue, parseFilesQuery, type FilesSearchParams } from "./query";
import { FilesFilterBar } from "./FilesFilterBar";
import { FilesView, type FileCardData } from "./FilesView";
import pageStyles from "../admin.module.css";

/** Short-lived preview link TTL — matches `DOWNLOAD_URL_TTL_SECONDS` in
 * `src/app/api/admin/files/[fileId]/route.ts` (not imported: that's a route module, not a
 * reusable constant, and this page's decision to sign previews is independent of that route's
 * download-redirect TTL — see the DECISION note below). */
const PREVIEW_URL_TTL_SECONDS = 120;

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot === -1 || dot === filename.length - 1) return "FILE";
  return filename.slice(dot + 1).toUpperCase();
}

/**
 * DECISION (see AGENTS.md files spec): `OrderFile.bucketPath` points at a PRIVATE Supabase
 * Storage bucket — there's no public URL to hand a plain `<img src>`. Rather than build a
 * proxy-download route, this signs a short-lived (120s) preview URL SERVER-SIDE for every
 * image file on the CURRENT page only (≤24 signing calls/page load) and uses that as the
 * `<img>` src; the URL expires shortly after the page renders, which is fine since it's only
 * ever used for the one render (a stale URL just falls back to the broken-image → type-card
 * path in `FilesView.tsx`). Non-image files never get signed — no point previewing a PDF/zip.
 */
async function signPreview(bucketPath: string): Promise<string | null> {
  try {
    const path = fromOrderUploadsBucketPath(bucketPath);
    return await createSignedDownloadUrl(ORDER_UPLOADS_BUCKET, path, PREVIEW_URL_TTL_SECONDS);
  } catch (err) {
    console.error("AdminFilesPage: failed to sign a preview URL", err);
    return null;
  }
}

function buildBaseQueryString(params: FilesSearchParams): string {
  const qs = new URLSearchParams();
  const q = firstValue(params.q);
  if (q) qs.set("q", q);
  return qs.toString();
}

export default async function AdminFilesPage({ searchParams }: { searchParams: Promise<FilesSearchParams> }) {
  await requireAdminPage();
  const rawParams = await searchParams;
  const parsed = parseFilesQuery(rawParams);

  const where = buildFilesWhere(parsed);
  const skip = (parsed.page - 1) * FILES_PAGE_SIZE;

  let files: FileCardData[] = [];
  let total = 0;
  let loadError = false;

  try {
    const [items, count] = await Promise.all([
      prisma.orderFile.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: FILES_PAGE_SIZE,
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          size: true,
          bucketPath: true,
          order: { select: { id: true, ref: true, customer: { select: { name: true } } } },
        },
      }),
      prisma.orderFile.count({ where }),
    ]);

    total = count;
    const previews = await Promise.all(
      items.map((f) => (f.mimeType.startsWith("image/") ? signPreview(f.bucketPath) : Promise.resolve(null))),
    );

    files = items.map((f, i) => ({
      id: f.id,
      name: f.originalName,
      sizeLabel: formatBytes(f.size),
      extension: extensionOf(f.originalName),
      previewUrl: previews[i],
      orderId: f.order.id,
      orderRef: f.order.ref,
      customerFirstName: f.order.customer.name.split(" ")[0] ?? f.order.customer.name,
    }));
  } catch (err) {
    console.error("AdminFilesPage: failed to load files", err);
    loadError = true;
  }

  const baseQuery = buildBaseQueryString(rawParams);
  const locale = await getAdminLocale();
  const loadErrorText = loadError
    ? createTranslator(await getAdminMessages(locale), "adminFiles")("loadError")
    : null;

  return (
    <div className={pageStyles.page}>
      <FilesFilterBar key={baseQuery} initialQ={parsed.q ?? ""} />
      {loadErrorText ? (
        <div style={{ textAlign: "center", color: "#8A8070", fontSize: 13, padding: 20 }}>{loadErrorText}</div>
      ) : (
        <FilesView files={files} total={total} page={parsed.page} pageSize={FILES_PAGE_SIZE} baseQuery={baseQuery} />
      )}
    </div>
  );
}
