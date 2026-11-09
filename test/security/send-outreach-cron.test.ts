import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

let authorized = true;
const runOutreachCron = vi.fn(
  async (..._args: unknown[]): Promise<Record<string, unknown>> => ({
    success: true,
    sent: 1,
    dryRun: false,
    pending: 5,
    dailySent: 1,
  }),
);

vi.mock("@/lib/cron", () => ({
  verifyCronSecret: vi.fn(async () => authorized),
}));

vi.mock("@/lib/outreach/sender", () => ({
  runOutreachCron: (...args: unknown[]) =>
    (runOutreachCron as (...a: unknown[]) => unknown)(...args),
}));

const get = async (query = "") => {
  const { GET } = await import("@/app/api/cron/send-outreach/route");
  return GET(
    new NextRequest(`https://scholarbase.app/api/cron/send-outreach${query}`),
  );
};

beforeEach(() => {
  authorized = true;
  runOutreachCron.mockClear();
});

describe("GET /api/cron/send-outreach", () => {
  it("rejects a request without the cron secret", async () => {
    authorized = false;

    const response = await get();

    expect(response.status).toBe(401);
    expect(runOutreachCron).not.toHaveBeenCalled();
  });

  it("sends one email by default", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect(runOutreachCron).toHaveBeenCalledWith({ limit: 1, dryRun: false });
  });

  it("supports a dry run and caps the limit", async () => {
    await get("?dryRun=1&limit=99");

    expect(runOutreachCron).toHaveBeenCalledWith({ limit: 3, dryRun: true });
  });

  it("never lets the limit fall below one", async () => {
    await get("?limit=0");

    expect(runOutreachCron).toHaveBeenCalledWith({ limit: 1, dryRun: false });
  });

  it("falls back to one for a non-numeric limit", async () => {
    await get("?limit=abc");

    expect(runOutreachCron).toHaveBeenCalledWith({ limit: 1, dryRun: false });
  });

  it("surfaces a failed run as a 500", async () => {
    runOutreachCron.mockResolvedValueOnce({
      success: false,
      sent: 0,
      dryRun: false,
      pending: 1,
      dailySent: 0,
      reason: "send_failed",
      error: "Provider down",
    });

    const response = await get();

    expect(response.status).toBe(500);
  });

  it("surfaces a thrown error as a 500", async () => {
    runOutreachCron.mockRejectedValueOnce(new Error("boom"));

    const response = await get();

    expect(response.status).toBe(500);
  });
});
