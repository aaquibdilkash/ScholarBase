/**
 * The admin-only Sentry verification endpoint.
 *
 * Three properties matter and each is a different failure mode:
 *  1. Non-admins get 403 and trigger NO event (an unauthenticated caller
 *     must not be able to pollute the quota or probe for admin accounts).
 *  2. An admin with a configured DSN gets a captured + FLUSHED event (the
 *     flush is what makes the check trustworthy on serverless).
 *  3. Missing DSN reports configured:false instead of pretending success
 *     (the NEXT_PUBLIC_ var is inlined at build time - a dashboard-only
 *     change leaves it absent until redeploy).
 *  4. DSN set but SDK uninitialised reports success:false + initialized:false
 *     (dev server started before the DSN was added, or register() never ran:
 *     captureException is then a no-op and the dashboard stays silently
 *     empty while the check claims success).
 *  5. Captured-but-not-flushed reports success:false + flushed:false (the SDK
 *     created the event locally but the transport never drained: revoked key,
 *     wrong project, or blocked egress. Same empty-dashboard symptom, but the
 *     fix is DSN/egress, not restart/redeploy).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captureExceptionMock = vi.fn();
const flushMock = vi.fn(async () => true);
const isInitializedMock = vi.fn();
let adminSession: { id: string } | null = null;

vi.mock("@sentry/nextjs", () => ({
  captureException: captureExceptionMock,
  flush: flushMock,
  isInitialized: isInitializedMock,
}));
vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(async () => {
    if (!adminSession) throw new Error("Not authorized. Admin access required.");
    return adminSession;
  }),
}));

const post = async () => {
  const { POST } = await import("@/app/api/monitoring/sentry-test/route");
  return POST();
};

const savedDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

beforeEach(() => {
  adminSession = { id: "u-admin" };
  captureExceptionMock.mockClear();
  captureExceptionMock.mockReturnValue("evt-test-1");
  flushMock.mockClear();
  isInitializedMock.mockClear();
  isInitializedMock.mockReturnValue(true);
});

afterEach(() => {
  if (savedDsn === undefined) delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  else process.env.NEXT_PUBLIC_SENTRY_DSN = savedDsn;
});

describe("POST /api/monitoring/sentry-test", () => {
  it("rejects non-admins with 403 and captures nothing", async () => {
    adminSession = null;
    process.env.NEXT_PUBLIC_SENTRY_DSN =
      "https://public@o123.ingest.us.sentry.io/456";

    const res = await post();

    expect(res.status).toBe(403);
    expect(captureExceptionMock).not.toHaveBeenCalled();
    expect(flushMock).not.toHaveBeenCalled();
  });

  it("admin + configured DSN captures and flushes the test event", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN =
      "https://public@o123.ingest.us.sentry.io/456";

    const res = await post();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      configured: true,
      initialized: true,
      flushed: true,
      eventId: "evt-test-1",
    });
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(captureExceptionMock).toHaveBeenCalledWith(expect.any(Error));
    // Without an explicit flush a serverless function can freeze first.
    expect(flushMock).toHaveBeenCalledTimes(1);
  });

  it("DSN set but SDK uninitialised reports failure, not success", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN =
      "https://public@o123.ingest.us.sentry.io/456";
    captureExceptionMock.mockReturnValue(undefined);
    isInitializedMock.mockReturnValue(false);

    const res = await post();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      success: false,
      configured: true,
      initialized: false,
    });
  });

  it("captured-but-not-flushed reports failure, not success", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN =
      "https://public@o123.ingest.us.sentry.io/456";
    // SDK initialised and eventId created, but transport never drained.
    flushMock.mockResolvedValueOnce(false);

    const res = await post();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      success: false,
      configured: true,
      initialized: true,
      flushed: false,
      eventId: "evt-test-1",
    });
  });

  it("reports configured:false instead of faking success without a DSN", async () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;

    const res = await post();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ success: false, configured: false });
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });
});
