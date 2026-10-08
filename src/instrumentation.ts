/**
 * Next.js instrumentation hooks (M7 — error monitoring).
 *
 * Two exports, per node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md:
 *
 *  - `register()` — runs once per server instance. It loads the Sentry server
 *    config in the Node.js runtime only; the Edge runtime (src/proxy.ts) is
 *    deliberately left un-instrumented for now — it is a thin CSP/header
 *    layer and wiring the edge SDK would double the bundle for it.
 *  - `onRequestError` — the hook Next calls for ANY failed request:
 *    Server Actions, Route Handlers, and Server Component renders. This is
 *    precisely the surface the launch audit cares about (voting, search,
 *    messaging, cron-adjacent routes), because an action that throws today
 *    surfaces only as a user complaint.
 *
 * No DSN -> nothing is initialised -> these hooks are inert no-ops, so CI,
 * builds and local dev are unaffected.
 */
import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
}

export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context,
) => {
  Sentry.captureRequestError(error, request, context);
};
