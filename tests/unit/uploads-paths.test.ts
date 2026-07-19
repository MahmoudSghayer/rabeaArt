import { describe, expect, it, vi } from "vitest";

// uploads.ts imports "server-only" (and transitively, via lib/supabase/admin, another
// "server-only" import) which throws unconditionally outside the Next.js build system — neutral
// stub it here the same way Next's RSC bundler would strip it.
vi.mock("server-only", () => ({}));

const {
  ORDER_UPLOADS_BUCKET,
  StorageError,
  fromOrderUploadsBucketPath,
  toOrderUploadsBucketPath,
} = await import("@/lib/storage/uploads");

describe("toOrderUploadsBucketPath / fromOrderUploadsBucketPath", () => {
  it("prefixes a bucket-relative path with the bucket name", () => {
    expect(toOrderUploadsBucketPath("draft-1/f47ac10b.jpg")).toBe(
      `${ORDER_UPLOADS_BUCKET}/draft-1/f47ac10b.jpg`,
    );
  });

  it("round-trips a bucket-relative path through both conversions", () => {
    const relative = "3fa85f64-5717-4562-b3fc-2c963f66afa6/f47ac10b-58cc-4372-a567-0e02b2c3d479.png";
    expect(fromOrderUploadsBucketPath(toOrderUploadsBucketPath(relative))).toBe(relative);
  });

  it("throws a StorageError when the bucketPath is in a different bucket", () => {
    expect(() => fromOrderUploadsBucketPath("product-images/draft-1/f47ac10b.jpg")).toThrow(StorageError);
  });

  it("throws a StorageError with code INVALID_PATH for a malformed bucketPath", () => {
    try {
      fromOrderUploadsBucketPath("not-a-bucket-path");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(StorageError);
      expect((err as InstanceType<typeof StorageError>).code).toBe("INVALID_PATH");
    }
  });
});
