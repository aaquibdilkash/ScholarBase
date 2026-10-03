/**
 * Content-Security-Policy construction.
 *
 * PHASE 1 ONLY — this ships as `Content-Security-Policy-Report-Only` on purpose.
 * An enforcing CSP on the Next.js App Router is the classic way to cause a total
 * outage: one wrong directive and every page is blank. Report-only records the
 * same violations while blocking nothing, so we can see what actually breaks
 * before letting it break anything. Flipping to enforcing is a separate,
 * deliberate commit once the observation window is clean.
 *
 * Why a nonce at all: the App Router emits inline bootstrap scripts for the RSC
 * payload and hydration. `'unsafe-inline'` would permit an injected inline
 * script, which defeats most of the point — a nonce makes the policy actually
 * constrain script execution. `'strict-dynamic'` then lets Next.js load its own
 * dynamically-generated chunk scripts without enumerating every hashed filename,
 * which is impossible to keep in sync across builds.
 *
 * `style-src` keeps `'unsafe-inline'` for now. Tailwind and React both emit
 * style attributes, and `nextjs-toploader` injects a `<style>` element at
 * runtime. Removing it is the most valuable tightening still available, and it
 * is deliberately NOT part of Phase 1 — it needs a class-to-hash refactor across
 * every component.
 */

/**
 * The header we actually send.
 *
 * PHASE 2 — this is now ENFORCING. It shipped as
 * `Content-Security-Policy-Report-Only` first, which let us find two real problems
 * without a single outage: Supabase Realtime's `wss://` was missing from
 * `connect-src`, and `worker-src` was silently inheriting `script-src`. Both
 * would have shipped as production breakage.
 *
 * Rollback is deliberately one line: change this constant back to
 * `Content-Security-Policy-Report-Only` and redeploy.
 */
export const CSP_HEADER = "Content-Security-Policy";

/**
 * Where violations are posted.
 *
 * NOT temporary, and this was corrected after originally planning to delete it
 * at the end of Phase 1. Reports are MORE valuable while enforcing, not less —
 * this is how a violation surfaces without waiting for a user to report a broken
 * page. With the policy working, volume should be near zero, so the log cost is
 * negligible.
 *
 * It remains log-only and not backed by the database: CSP reports are a
 * high-volume, low-value firehose, and a table for this would cost schema and
 * free-tier space (AGENTS.md Rule 1).
 */
export const CSP_REPORT_URI = "/api/csp-report";

/**
 * The single place the policy string is assembled.
 *
 * A function rather than a constant because the nonce is per-request. A module
 * level constant would invite "optimising" this into a static header in
 * `next.config.ts`, which is exactly what makes a nonce useless — and
 * `next.config.ts` cannot hold it anyway, since `headers()` there emits one
 * fixed value for every request.
 */
/**
 * `'unsafe-eval'` is granted in DEVELOPMENT ONLY.
 *
 * React's development build calls `eval()` for stack-trace reconstruction, and
 * Turbopack's HMR client uses it too. Without this, enforcing CSP makes
 * `next dev` unusable — every page logs "eval() is not supported in this
 * environment" and React's error decoding is dead.
 *
 * It is deliberately NOT granted in production. Verified: none of the 87 built
 * chunks under `.next/static/chunks` contain `eval(`, and no `src/` file uses it.
 * Adding it unconditionally "to stop the console noise" would permanently allow
 * string-to-code execution in production, which is the single most valuable
 * thing this policy buys. Pinned by a test.
 */
const IS_DEV = process.env.NODE_ENV !== "production";

export function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    // `strict-dynamic` lets the nonced bootstrap script load Next's chunks.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com${
      IS_DEV ? " 'unsafe-eval'" : ""
    }`,
    // See the note above: required by Tailwind/React attributes and TopLoader.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://res.cloudinary.com https://lh3.googleusercontent.com",
    // Supabase client auth runs in the browser. Vercel Analytics posts to
    // /_vercel/*, already covered by 'self'.
    //
    // `wss://` is NOT optional here. Supabase Realtime (message + notification
    // presence, see Sidebar.tsx) opens a WebSocket, and `https://*.supabase.co`
    // does not cover it — CSP matches the full scheme. The report-only window
    // caught this as `directive=connect-src blocked=wss://…supabase.co/
    // realtime/v1/websocket`. Enforcing without this line would have silently
    // killed realtime in production while looking fine in every test.
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    // Cloudflare Turnstile is an iframe widget.
    "frame-src https://challenges.cloudflare.com",
    // Explicit, because `worker-src` FALLS BACK to script-src when unset — the
    // headless sweep surfaced this as:
    //   Creating a worker from '/sw.js' violates ... "script-src"
    // It happens to work today only because script-src contains 'self'. Stating
    // it means tightening script-src (e.g. dropping 'self' in Phase 2) cannot
    // silently take the service worker — and with it PWA installability — down.
    "worker-src 'self'",
    // Baseline hardening. `frame-ancestors` supersedes X-Frame-Options, which
    // stays in next.config.ts for older clients.
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    `report-uri ${CSP_REPORT_URI}`,
  ].join("; ");
}