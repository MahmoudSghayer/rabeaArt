import { beforeEach, describe, expect, it, vi } from "vitest";

// notify.ts (and resend.ts, which it imports) both import "server-only", which throws
// unconditionally outside the Next.js build system — neutralize it the same way Next's RSC
// bundler would.
vi.mock("server-only", () => ({}));

const emailLogCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailLog: {
      create: (...args: unknown[]) => emailLogCreate(...args),
    },
  },
}));

// No RESEND_API_KEY/EMAIL_FROM configured -> getEmailProvider() falls back to the Noop provider,
// which always reports `{ ok: false, error: "EMAIL_DISABLED" }` (see lib/email/resend.ts).
vi.mock("@/lib/env", () => ({
  getOptionalEnv: () => ({ emailEnabled: false }),
}));

const { sendOrderNotification } = await import("@/lib/email/notify");

describe("sendOrderNotification — provider fallback", () => {
  beforeEach(() => {
    emailLogCreate.mockReset();
    emailLogCreate.mockResolvedValue(undefined);
  });

  it("writes a failed EmailLog row with EMAIL_DISABLED when no provider is configured", async () => {
    await sendOrderNotification({
      template: "order-received",
      to: "customer@example.com",
      locale: "en",
      orderId: "order_1",
      data: { customerName: "Layla", orderRef: "RA-1042", whatsapp: "+972501234567" },
    });

    expect(emailLogCreate).toHaveBeenCalledTimes(1);
    const call = emailLogCreate.mock.calls[0][0];
    expect(call.data).toMatchObject({
      orderId: "order_1",
      to: "customer@example.com",
      template: "order-received",
      status: "failed",
      error: "EMAIL_DISABLED",
      providerMessageId: null,
    });
  });

  it("never throws even if EmailLog write itself fails", async () => {
    emailLogCreate.mockRejectedValueOnce(new Error("db down"));

    await expect(
      sendOrderNotification({
        template: "order-ready",
        to: "customer@example.com",
        locale: "ar",
        data: { customerName: "Layla", orderRef: "RA-1042", whatsapp: "+972501234567" },
      }),
    ).resolves.toBeUndefined();
  });
});
