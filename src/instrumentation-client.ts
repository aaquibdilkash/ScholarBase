/**
 * Client-side observability bootstrap (M7 of the launch-readiness audit:
 * "find out from an alert, not a user complaint").
 *
 * This file runs in the browser before the app becomes interactive (Next.js
 * file convention — see node_modules/next/dist/docs/.../instrumentation-client.md).
 * Initialising here means uncaught errors, promise rejections and failed
 * fetches are captured even when a page never hydrates far enough to reach a
 * React error boundary.
 *
 * Gated on the DSN: no `NEXT_PUBLIC_SENTRY_DSN` (local dev, CI, vitest) means
 * the SDK never initialises and never touches the network. The DSN is public
 * by design — it only identifies the project, it cannot authorise anything.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    // ERRORS-ONLY posture for the free Developer tier (see docs/launch-ops-runbook.md).
    // This project launches for error DETECTION, not performance profiling:
    // a zero transaction sample rate means spans are never created and the
    // quota only ever carries real crashes. Raise to 0.1 deliberately when
    // there is a profiling question worth spending quota on - never by accident.
    tracesSampleRate: 0,
    // The single biggest quota thief on the client is not your code - it is
    // browser/extension noise firing `window.onerror`. These four are the
    // classic false positives; each one kept lets a real crash through that
    // would otherwise be silently dropped past the monthly cap.
    ignoreErrors: [
      "ResizeObserver loop completed with undelivered notifications",
      "ResizeObserver loop limit exceeded",
      "Network request failed",
      "Load failed",
    ],
  });
}
