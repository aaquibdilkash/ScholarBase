/**
 * Server-side Sentry init, imported lazily from `src/instrumentation.ts`'s
 * `register()` so the SDK only loads in the Node.js runtime of a real server
 * (never during `vitest`, never in the Edge runtime, and never at all when
 * no DSN is configured).
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    // ERRORS-ONLY posture, mirroring the client (see
    // instrumentation-client.ts). `tracesSampleRate: 0` disables performance
    // spans on the server too; a Server Action that throws is still captured
    // as an ERROR via instrumentation.ts `onRequestError`. The route is
    // serverless - there is no long-lived process profiling anything - so the
    // only thing 0.1 sampling would buy here is quota burn.
    tracesSampleRate: 0,
  });
}
