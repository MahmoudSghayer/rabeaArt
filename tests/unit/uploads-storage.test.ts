import { beforeEach, describe, expect, it, vi } from "vitest";
import { StorageApiError } from "@supabase/supabase-js";

// uploads.ts (and lib/supabase/admin, which it imports) both import "server-only", which throws
// unconditionally outside the Next.js build system — neutralize it the same way Next's RSC
// bundler would.
vi.mock("server-only", () => ({}));

const mockFrom = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ storage: { from: mockFrom } }),
}));

const {
  ORDER_UPLOADS_BUCKET,
  StorageError,
  createSignedOrderUploadUrl,
  getObjectMetadata,
  removeObject,
  createSignedDownloadUrl,
  listObjectsUnder,
  listTopLevelPrefixes,
} = await import("@/lib/storage/uploads");

beforeEach(() => {
  mockFrom.mockReset();
});

describe("createSignedOrderUploadUrl", () => {
  it("returns path/token/signedUrl on success", async () => {
    const createSignedUploadUrl = vi.fn().mockResolvedValue({
      data: { path: "draft-1/uuid.jpg", token: "tok", signedUrl: "https://x/y" },
      error: null,
    });
    mockFrom.mockReturnValue({ createSignedUploadUrl });

    const result = await createSignedOrderUploadUrl({ draftId: "draft-1", filename: "photo.jpg" });

    expect(mockFrom).toHaveBeenCalledWith(ORDER_UPLOADS_BUCKET);
    expect(result).toEqual({ path: "draft-1/uuid.jpg", token: "tok", signedUrl: "https://x/y" });
  });

  it("throws a StorageError when the SDK returns an error", async () => {
    const createSignedUploadUrl = vi.fn().mockResolvedValue({
      data: null,
      error: new StorageApiError("boom", 500, "internal"),
    });
    mockFrom.mockReturnValue({ createSignedUploadUrl });

    await expect(
      createSignedOrderUploadUrl({ draftId: "draft-1", filename: "photo.jpg" }),
    ).rejects.toThrow(StorageError);
  });
});

describe("getObjectMetadata", () => {
  it("returns size/mimeType/createdAt on success", async () => {
    const info = vi.fn().mockResolvedValue({
      data: { size: 1024, contentType: "image/png", createdAt: "2026-07-01T00:00:00.000Z" },
      error: null,
    });
    mockFrom.mockReturnValue({ info });

    const result = await getObjectMetadata("order-uploads", "draft-1/uuid.png");

    expect(result).toEqual({ size: 1024, mimeType: "image/png", createdAt: "2026-07-01T00:00:00.000Z" });
  });

  it("returns null for a 404 (not found)", async () => {
    const info = vi.fn().mockResolvedValue({
      data: null,
      error: new StorageApiError("not found", 404, "404"),
    });
    mockFrom.mockReturnValue({ info });

    const result = await getObjectMetadata("order-uploads", "draft-1/missing.png");

    expect(result).toBeNull();
  });

  it("throws a StorageError for a non-404 error", async () => {
    const info = vi.fn().mockResolvedValue({
      data: null,
      error: new StorageApiError("boom", 500, "internal"),
    });
    mockFrom.mockReturnValue({ info });

    await expect(getObjectMetadata("order-uploads", "draft-1/uuid.png")).rejects.toThrow(StorageError);
  });
});

describe("removeObject", () => {
  it("resolves on success", async () => {
    const remove = vi.fn().mockResolvedValue({ data: [], error: null });
    mockFrom.mockReturnValue({ remove });

    await expect(removeObject("order-uploads", "draft-1/uuid.png")).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledWith(["draft-1/uuid.png"]);
  });

  it("throws a StorageError on failure", async () => {
    const remove = vi.fn().mockResolvedValue({
      data: null,
      error: new StorageApiError("boom", 500, "internal"),
    });
    mockFrom.mockReturnValue({ remove });

    await expect(removeObject("order-uploads", "draft-1/uuid.png")).rejects.toThrow(StorageError);
  });
});

describe("createSignedDownloadUrl", () => {
  it("returns the signed URL", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: "https://x/y" }, error: null });
    mockFrom.mockReturnValue({ createSignedUrl });

    const url = await createSignedDownloadUrl("order-uploads", "draft-1/uuid.png", 120);

    expect(url).toBe("https://x/y");
    expect(createSignedUrl).toHaveBeenCalledWith("draft-1/uuid.png", 120);
  });
});

describe("listObjectsUnder", () => {
  it("skips folder entries (null id) and maps file metadata", async () => {
    const list = vi.fn().mockResolvedValue({
      data: [
        { id: null, name: "subfolder", metadata: null, created_at: null },
        {
          id: "file-1",
          name: "uuid.png",
          metadata: { size: 2048, mimetype: "image/png" },
          created_at: "2026-07-01T00:00:00.000Z",
        },
      ],
      error: null,
    });
    mockFrom.mockReturnValue({ list });

    const entries = await listObjectsUnder("order-uploads", "draft-1");

    expect(entries).toEqual([
      {
        name: "uuid.png",
        path: "draft-1/uuid.png",
        size: 2048,
        mimeType: "image/png",
        createdAt: "2026-07-01T00:00:00.000Z",
      },
    ]);
  });
});

describe("listTopLevelPrefixes", () => {
  it("returns only folder-entry names", async () => {
    const list = vi.fn().mockResolvedValue({
      data: [
        { id: null, name: "draft-1", metadata: null, created_at: null },
        {
          id: "file-1",
          name: "stray-file.png",
          metadata: { size: 1, mimetype: "image/png" },
          created_at: "2026-07-01T00:00:00.000Z",
        },
      ],
      error: null,
    });
    mockFrom.mockReturnValue({ list });

    const prefixes = await listTopLevelPrefixes("order-uploads");

    expect(prefixes).toEqual(["draft-1"]);
  });
});
