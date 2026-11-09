/**
 * CAN-SPAM requires a physical postal address in commercial email. The
 * outreach sender appends the built-in address from `src/lib/email.ts` to the
 * shared footer in both the HTML and text parts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.hoisted(() =>
  vi.fn(async (_payload: { html: string; text: string }) => ({
    data: { id: "em_1" },
    error: null,
  })),
);

vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
    constructor(_apiKey: string) {}
  },
}));

vi.mock("@/lib/emails/outreachUnsubscribe", () => ({
  getOutreachUnsubscribeUrl: () => "https://scholarbase.app/unsubscribe",
}));

const baseProps = {
  recipientEmail: "jane@university.edu",
  scholarName: "Jane Scholar",
  subject: "A note from ScholarBase",
  greeting: "Hello",
  headline: "ScholarBase",
  body: "A short introduction.",
  ctaLabel: "Open ScholarBase",
  inviteUrl: "https://scholarbase.app",
  senderName: "Outreach Team",
  senderRole: "ScholarBase",
  footerText: "Reply to opt out.",
};

beforeEach(() => {
  send.mockClear();
});

describe("sendScholarOutreachEmail postal address", () => {
  it("appends the built-in address to both parts", async () => {
    const { sendScholarOutreachEmail } = await import("@/lib/email");

    const result = await sendScholarOutreachEmail(baseProps);

    expect(result.success).toBe(true);
    const [payload] = send.mock.calls[0]!;
    expect(payload.html).toContain("ScholarBase, New Delhi, India");
    expect(payload.text).toContain("ScholarBase, New Delhi, India");
  });

  it("keeps the template footer text", async () => {
    const { sendScholarOutreachEmail } = await import("@/lib/email");

    await sendScholarOutreachEmail(baseProps);

    const [payload] = send.mock.calls[0]!;
    expect(payload.text).toContain("Reply to opt out.");
    expect(payload.text).toContain("ScholarBase, New Delhi, India");
  });
});
