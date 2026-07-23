import { afterEach, describe, expect, it, vi } from "vitest";
import { log } from "@/lib/log";

/**
 * Guards LOG-04: customer PII must never reach a log sink. The logger redacts by key name, so
 * anything carrying PII has to be logged under a key the redaction list catches (e.g. an email
 * under a `*email` key). Order ref/id are safe correlators and must survive.
 */
describe("log redaction — customer PII", () => {
  afterEach(() => vi.restoreAllMocks());

  function capture(context: Record<string, unknown>): string {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    log.error("test", { event: "test.event", ...context });
    expect(spy).toHaveBeenCalledTimes(1);
    return spy.mock.calls[0][0] as string;
  }

  it("redacts a recipient email logged under a *email key", () => {
    const line = capture({ recipientEmail: "layla@example.com", orderRef: "RA-1042" });
    expect(line).not.toContain("layla@example.com");
    expect(line).toContain("[redacted]");
    // The safe correlator survives so an incident is still traceable to the order.
    expect(line).toContain("RA-1042");
  });

  it("redacts phone, whatsapp, address, and notes", () => {
    const line = capture({
      phone: "+972501234567",
      whatsapp: "+972501234567",
      street: "12 Al-Nasr St",
      postal: "9112001",
      instructions: "leave at the door",
      notes: "VIP customer",
    });
    for (const secret of [
      "+972501234567",
      "12 Al-Nasr St",
      "9112001",
      "leave at the door",
      "VIP customer",
    ]) {
      expect(line).not.toContain(secret);
    }
  });

  it("still redacts credentials (no regression on the original patterns)", () => {
    const line = capture({ authorization: "Bearer sk_live_abc", apiKey: "sk_live_xyz" });
    expect(line).not.toContain("sk_live_abc");
    expect(line).not.toContain("sk_live_xyz");
  });

  it("leaves non-sensitive keys intact", () => {
    const line = capture({ orderId: "cuid_123", template: "order-received", count: 3 });
    expect(line).toContain("cuid_123");
    expect(line).toContain("order-received");
  });
});
