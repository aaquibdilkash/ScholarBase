# Launch Ops Runbook (Phase 1/2 hardening)

Operational items that code changes alone cannot close. Each is either a
manual dashboard action or an environment variable that must exist **before**
the corresponding code reaches production.

## 1. Required environment variables

| Variable | Where | Required? | What happens if missing |
|---|---|---|---|
| `EMAIL_UNSUBSCRIBE_SECRET` | Coolify staging + production environment | **YES — deploy-breaking by design** | Outreach email signing/verification throws at first use instead of silently borrowing `CRON_SECRET`. Set it to any long random value (`openssl rand -hex 32`). Existing links signed under the old fallback stop verifying; they are outreach one-click-unsubscribe links only, so the blast radius is old marketing emails. |
| `SUPABASE_CA_CERT_BASE64` | Coolify application environment | **YES — startup failing by design** | `src/lib/db.ts` throws at import in production when the CA is absent. `next build` is exempt via `NEXT_PHASE`; the running Coolify container must have the certificate. |
| `NEXT_PUBLIC_SENTRY_DSN` | Coolify build environment + Sentry project | Recommended | Sentry initialises disabled; the app runs but you are back to finding out from user complaints. |
| `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` | Coolify/CI build environment only | Recommended | Enables source-map upload during the image build. Never expose `SENTRY_AUTH_TOKEN` to the browser or runtime container. |
| `TURNSTILE_SECRET_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Coolify application environment | Already required | Contact form now fails closed without them (same as the institution form). |

## 2. Lock origin traffic to Cloudflare (rate-limit bypass)

`getClientIp()` trusts `cf-connecting-ip` unconditionally. If the Coolify
deployment URL is directly reachable, anyone can spoof that header and walk
around IP-keyed rate limits (login attempts, contact form, search). The code
cannot fix this — it is an edge configuration:

1. **Origin firewall rule (recommended):** at the reverse proxy/firewall, allow
   only traffic from Cloudflare’s published IP ranges and trusted operations
   networks.
   (Cloudflare publishes these at
   <https://www.cloudflare.com/ips/>; refresh them periodically or use an
   Upstash/CDN-maintained list.)
2. **Alternative — Authenticated Origin Pulls:** enable this in Cloudflare (SSL/TLS
   → Origin Server) and require the Cloudflare client certificate at Coolify’s
   side at the Coolify origin if the plan supports it.
3. **Verify:** `curl -H "cf-connecting-ip: 1.2.3.4" https://<origin-host>/`
   from a non-Cloudflare network must fail (403) once rule 1 is active; the
   same request via `https://scholarbase.app` (through Cloudflare) works.

Do NOT try to “fix” this in `rate-limit.ts` — any header check without an
origin trust decision is spoofable by definition.

## 3. Supabase dashboard (go/no-go, from the launch audit)

1. Run `supabase/realtime/broadcast-messages.sql` against the **production**
   self-hosted production Supabase instance (the repo runbook only verified it on staging). Manual test:
   Account B tries to subscribe to Account A’s conversation → must receive
   nothing.
2. Auth → enable **“Secure email change”** (dual-confirmation) so a stolen
   session cannot silently redirect an account’s email.

## 4. Sentry on the free Developer tier ($0, no card)

Wired in three files: `src/instrumentation-client.ts` (browser bootstrap),
`src/instrumentation.ts` (`register()` + `onRequestError`, which captures
failed Server Actions / routes / renders), and `src/sentry.server.config.ts`
(Node runtime). All three are no-ops until a DSN exists.
**Do NOT run the Sentry CLI wizard** (`npx @sentry/wizard`): it generates
`sentry.client.config.ts` / `sentry.edge.config.ts` + wraps `next.config.ts`,
duplicating and conflicting with the tested wiring above.

Sentry quota safety and deployment notes:

- The Developer plan has **no payment method by construction**, and Sentry's
  own docs state quota-exhausted data **is dropped, not charged**. Charging
  requires you to opt into a paid plan or a PAYG budget with a card — which
  this project never does. There is also **spike protection** for
  errors/spans/replays in Settings > Subscription — turn it on.
- This project launches **ERRORS-ONLY**, so the error quota is the only one
  that can ever move: `tracesSampleRate: 0` in both init files means spans
  are never created, replay is never configured, and the client keeps an
  `ignoreErrors` list for ResizeObserver/ad-blocker noise. A healthy launch
  produces tens of crashes a month, not thousands — asserted in
  `test/security/sentry-wiring.test.ts`.
- If you ever want profiling, raise `tracesSampleRate` to 0.1 deliberately —
  never by accident — and watch the spans graph for a week first. Same for
  error-only replay (`replaysOnErrorSampleRate: 1.0`), which needs an explicit
  recording integration we do not install today.
- Confirm your exact quotas on Settings > Subscription (Developer numbers
  move over time); the in-repo posture above makes you robust to whatever
  they are.

Deliberate scope cuts, revisit post-launch:
- Edge runtime (`src/proxy.ts`) not instrumented (thin CSP/header layer).
- `next.config.ts` enables `withSentryConfig` only when all three build
  credentials exist. It uploads source maps and deletes them from the build
  output afterwards; runtime capture still works without those credentials.
- `src/app/error.tsx` and `src/app/global-error.tsx` explicitly report errors
  caught by the App Router boundaries, including errors that do not reach the
  browser's global handlers.

Setup steps: create the project at sentry.io, set `NEXT_PUBLIC_SENTRY_DSN` in
the Coolify build environment, then rebuild the image (NEXT_PUBLIC_ vars bake
at build time). CSP already allows `https://*.ingest.sentry.io`,
`https://*.ingest.us.sentry.io`, and `https://*.ingest.de.sentry.io` under
`connect-src` — the last one matters because this org lives in the EU region;
asserted region-aware by `test/security/sentry-wiring.test.ts`.
Then verify with `POST /api/monitoring/sentry-test` (see §5 below).

## 5. Verify Sentry end-to-end after deploy

Log in as admin on the live site and run this in the browser console:

```js
await (await fetch("/api/monitoring/sentry-test", { method: "POST" })).json()
```

- `{ success: true, initialized: true, flushed: true, eventId }` → a test exception was flushed to Sentry; it should
  appear under Issues within seconds, and DevTools Network should show an
  envelope POST to `o*.ingest*.sentry.io` (proves the CSP allowlist works).
- `{ success: false, initialized: false }` → the SDK never initialised in
  that server instance: restart the dev server locally or rebuild/redeploy the
  Coolify image so `register()` picks up the DSN, then retry.
- `{ success: false, initialized: true, flushed: false, eventId }` →
  captured locally but the transport never drained: check the server
  terminal for Sentry transport errors, `curl -I https://<dsn-host>` for
  egress, and confirm the DSN key/project in Sentry Settings > Projects >
  Client Keys.
- `{ configured: false }` → the deployment lacks the DSN: set the env var
  in Coolify and **rebuild/redeploy** (NEXT_PUBLIC_ vars are inlined at build time).
- `403` → you are not admin-logged-in on that tab.
