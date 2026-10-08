import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Admin-only end-to-end check that Sentry is actually receiving events (M7
 * of the launch-readiness audit).
 *
 * Reading the DSN from the environment proves nothing - the interesting
 * questions are whether the SDK initialised, whether CSP lets the envelope
 * reach the ingest endpoint, and whether the deployed build even contains the
 * NEXT_PUBLIC_ var (it is inlined at build time, so a dashboard-only change
 * silently does nothing). One captured exception answers all three at once:
 * if it does not appear in the Sentry dashboard within a few seconds, one of
 * them is broken.
 *
 * POST only (it has a side effect) and admin-gated via `requireAdmin()`,
 * which does a fresh database lookup per call - a client-supplied role is
 * never trusted. Errors collapse to 403 without distinguishing logged-out
 * from non-admin, so the endpoint cannot be used to probe for admin accounts.
 */
export async function POST() {
  try {
    await requireAdmin("Sign in to run this check.");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const configured = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN?.trim());
  if (!configured) {
    return NextResponse.json({
      success: false,
      configured: false,
      message:
        "NEXT_PUBLIC_SENTRY_DSN is not set in this deployment - nothing would be sent. Set it and redeploy (it is inlined at build time).",
    });
  }

  const eventId = Sentry.captureException(
    new Error(`Sentry verification event - ${new Date().toISOString()}`),
  );
  // Serverless can freeze the process before the transport drains its queue;
  // flush explicitly so the event leaves before this response is returned.
  // The boolean matters: `true` means the transport drained, `false` means
  // the event was created locally (eventId exists, isInitialized is true)
  // but never reached ingest - the exact false-positive in the screenshots.
  const flushed = await Sentry.flush(3_000);

  // captureException is a no-op returning undefined when the SDK never
  // initialised (e.g. register() never ran, or dev server started before the
  // DSN was added to .env). Reporting success unconditionally is exactly how
  // a dashboard stays empty while every check stays green.
  const initialized = Sentry.isInitialized();
  if (!initialized || !eventId) {
    return NextResponse.json({
      success: false,
      configured: true,
      initialized: false,
      flushed,
      message:
        "DSN is set but the Sentry SDK is not initialised in this server instance - restart the dev server (or redeploy) so instrumentation register() picks up the DSN, then retry.",
    });
  }

  if (!flushed) {
    return NextResponse.json({
      success: false,
      configured: true,
      initialized: true,
      flushed: false,
      eventId,
      message:
        "Event was captured locally but the transport failed to deliver it within 3s - check the server terminal for Sentry transport errors, verify outbound HTTPS to the DSN host is reachable (curl the ingest host), and confirm the DSN key/project match Sentry Settings > Projects > Client Keys.",
    });
  }

  return NextResponse.json({
    success: true,
    configured: true,
    initialized: true,
    flushed: true,
    eventId,
    message:
      "Test event sent. It should appear in the Sentry dashboard within a few seconds.",
  });
}
