import { describe, expect, it } from "vitest";
import {
  ALLOWED_UPLOAD_EXT,
  ALLOWED_UPLOAD_MIME,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_FILES,
  randomObjectKey,
  validateUpload,
} from "@/lib/storage/validation";

describe("constants", () => {
  it("caps files at 6 and size at 8MB", () => {
    expect(MAX_UPLOAD_FILES).toBe(6);
    expect(MAX_UPLOAD_BYTES).toBe(8 * 1024 * 1024);
  });

  it("excludes SVG from the allowed mime/ext lists", () => {
    expect(ALLOWED_UPLOAD_MIME).not.toContain("image/svg+xml");
    expect(ALLOWED_UPLOAD_EXT).not.toContain("svg");
  });

  it("has a matching extension for every allowed mime type (jpg/jpeg covers image/jpeg)", () => {
    expect(ALLOWED_UPLOAD_MIME).toEqual(["image/jpeg", "image/png", "image/webp"]);
    expect(ALLOWED_UPLOAD_EXT).toEqual(["jpg", "jpeg", "png", "webp"]);
  });
});

describe("validateUpload", () => {
  it("accepts a well-formed jpeg", () => {
    expect(validateUpload({ mimeType: "image/jpeg", size: 1024, filename: "photo.jpg" })).toEqual({
      ok: true,
    });
  });

  it("accepts every allowed mime/ext pairing", () => {
    expect(validateUpload({ mimeType: "image/png", size: 1024, filename: "art.png" })).toEqual({
      ok: true,
    });
    expect(validateUpload({ mimeType: "image/webp", size: 1024, filename: "art.webp" })).toEqual({
      ok: true,
    });
    expect(validateUpload({ mimeType: "image/jpeg", size: 1024, filename: "art.jpeg" })).toEqual({
      ok: true,
    });
  });

  it("rejects a disallowed mime type with reason 'type'", () => {
    expect(
      validateUpload({ mimeType: "image/svg+xml", size: 1024, filename: "logo.svg" }),
    ).toEqual({ ok: false, reason: "type" });
  });

  it("rejects an allowed mime type paired with a disallowed extension with reason 'ext'", () => {
    expect(validateUpload({ mimeType: "image/jpeg", size: 1024, filename: "photo.gif" })).toEqual({
      ok: false,
      reason: "ext",
    });
  });

  it("rejects a filename with no extension with reason 'ext'", () => {
    expect(validateUpload({ mimeType: "image/jpeg", size: 1024, filename: "photo" })).toEqual({
      ok: false,
      reason: "ext",
    });
  });

  it("rejects an oversized file with reason 'size'", () => {
    expect(
      validateUpload({ mimeType: "image/jpeg", size: MAX_UPLOAD_BYTES + 1, filename: "photo.jpg" }),
    ).toEqual({ ok: false, reason: "size" });
  });

  it("accepts a file exactly at the size cap", () => {
    expect(
      validateUpload({ mimeType: "image/jpeg", size: MAX_UPLOAD_BYTES, filename: "photo.jpg" }),
    ).toEqual({ ok: true });
  });

  it("rejects a zero-byte file with reason 'size'", () => {
    expect(validateUpload({ mimeType: "image/jpeg", size: 0, filename: "photo.jpg" })).toEqual({
      ok: false,
      reason: "size",
    });
  });

  it("checks mime type before extension (type reason takes precedence)", () => {
    expect(validateUpload({ mimeType: "text/html", size: 1024, filename: "photo.exe" })).toEqual({
      ok: false,
      reason: "type",
    });
  });
});

describe("randomObjectKey", () => {
  it("uses the prefix and preserves an allowed extension", () => {
    const key = randomObjectKey("order-uploads/order123", "photo.PNG".toLowerCase());
    expect(key).toMatch(/^order-uploads\/order123\/[0-9a-f-]{36}\.png$/);
  });

  it("falls back to 'bin' for a disallowed/unknown extension", () => {
    const key = randomObjectKey("order-uploads/order123", "payload.exe");
    expect(key).toMatch(/^order-uploads\/order123\/[0-9a-f-]{36}\.bin$/);
  });

  it("falls back to 'bin' when the filename has no extension", () => {
    const key = randomObjectKey("order-uploads/order123", "noext");
    expect(key).toMatch(/^order-uploads\/order123\/[0-9a-f-]{36}\.bin$/);
  });

  it("generates unique keys across calls", () => {
    const a = randomObjectKey("p", "a.jpg");
    const b = randomObjectKey("p", "a.jpg");
    expect(a).not.toBe(b);
  });
});
