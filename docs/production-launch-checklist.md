# Production launch checklist

This checklist tracks the highest-priority production risks for ScholarBase before public launch on the free-tier stack: Vercel, Supabase, Cloudflare, QStash, and Redis.

## Priority order

### P1 — Security and reliability blockers

- [x] 3. Constant-time token verification for signed email and digest links
- [x] 6. Database TLS verification hardened for Supabase connections
- [x] CSP false-positive investigation: browser reports were a malformed nested `csp-report` payload, not an actual `eval()` in app code
- [x] 1. Rate limiting fail-open under Redis outage
- [ ] 2. Dependency audit and vulnerability remediation
- [x] 4. Secret fallback hardening for production envs
- [ ] 5. Enforcing CSP rollout after report-only observation ends

### P2 — Operational readiness

- [ ] Redis health alerting ~~and fail-closed policy for write endpoints~~ (fail-closed shipped with P1-1; alerting still open)
- [ ] QStash idempotency and retry monitoring for notifications and digests
- [ ] Supabase connection saturation and query budget review
- [ ] Vercel free-tier limit monitoring and performance budget review
- [ ] Cloudflare WAF / rate limits and bot mitigation review

### P3 — Launch validation

- [ ] Local Prisma + Supabase + Redis + QStash concurrency load test
- [ ] Duplicate job replay tests for digests and notifications
- [ ] Crash/retry scenario test for cron tasks
- [ ] Production secret validation on startup
- [ ] Smoke test for auth callback, email unsubscribe, and digest preference links

## Issue notes

### 1. Rate limiting under Redis outage

Status: fixed (split policy).

The limiter used to fail open globally: any Redis error — missing env vars,
network failure, Upstash quota exhaustion — returned `{ allowed: true,
degraded: true }`, silently disabling every limit in the app. An attacker who
could induce or wait for an Upstash outage got unlimited search queries
against the shared Supabase pool, unlimited contact/auth submissions against
Resend's 100/day cap, and unlimited writes.

Policy now declared per call site via `onDegraded: "open" | "closed"` in
`src/lib/rate-limit.ts`:

- **Fail closed** (`onDegraded: "closed"`) — all write paths: create/edit/delete
  across the 17 content modules (`enforceRateLimit` defaults to closed since it
  is only ever called by writes), votes, bookmarks, comments, follows,
  messages, auth (login/signup/password/contact), institution requests,
  admin outreach, survey responses, survey export (returns 503, not 429, when
  degraded), update-password. Degrade-time user messages say "Request
  protection is temporarily unavailable" (`RATE_LIMIT_DEGRADED_ERROR`) instead
  of the throttle copy, so an outage is never mistaken for user abuse.
- **Fail open** (`onDegraded: "open"`, the default) — read paths only:
  `search:*` (empty page beats a hard error; the min-length floor still keeps
  1-2 char searches off the database) and `message:read` (skipping it only
  delays badge updates).

Two actions already failed closed before this change (`adminInvite`,
`institution`) — that pattern is now the rule, not the exception.

Pinned by `test/security/rate-limit-fail-closed.test.ts` (10 tests): both
branches of both failure modes (no client vs. `limit()` throwing), normal
throttling still works, `enforceRateLimit` message selection, plus a source
scan asserting every `checkRateLimit` call site declares `onDegraded` and that
the two read paths never opt into closed — so a future write path cannot be
added fail-open by default.

Still open (P2): Redis health alerting so a degraded-mode activation pages
someone instead of only logging `warnOnce` once per namespace per instance.

### 3. Constant-time token verification

Status: fixed.

The email unsubscribe and digest preference tokens were validated via a character-by-character comparison. That pattern is not constant-time and is not recommended for security-sensitive tokens. We switched to `timingSafeEqual` after comparing the normalized byte lengths.

### 6. Database TLS verification

Status: fixed and documented.

The production database connection uses TLS verification when a CA certificate is available, and warns loudly when the database is forced onto the weaker fallback path. We avoid a startup crash in cold serverless environments while keeping the secure config as the default.

### CSP false positive: `eval` warning

Status: investigated and resolved in the handler.

The log lines below are not evidence of `eval()` in app code:

- `[csp-violation] directive= blocked= page=`

The report processor previously assumed a flat payload shape, but Chrome and CSP reports often post a nested object like:

```json
{
  "csp-report": {
    "document-uri": "https://example.com/feed",
    "blocked-uri": "https://cdn.example/evil.js",
    "violated-directive": "script-src-elem"
  }
}
```

The app now accepts both the nested and flat report shapes and logs the actual directive, blocked URI, and page without crashing.

### CSP findings from the report-only observation window

The nested-payload fix above is what made these findings visible at all — before it,
every line logged as `directive= blocked= page=` and told us nothing.

**1. `directive=script-src blocked=eval` — dev-only, benign, must STAY blocked.**

```
[csp-violation] directive=script-src blocked=eval page=http://localhost:3000/feed
```

This is the Next.js dev runtime (HMR / dev overlay), not app code. Verified rather
than assumed: `eval(` appears in **zero** of the 87 built chunks under
`.next/static/chunks`, so it does not exist in a production bundle. There is also no
`eval(` or `new Function(` anywhere in `src/`.

`'unsafe-eval'` must therefore NOT be added to the policy to silence this. Doing so
would trade a dev-only cosmetic warning for permanently allowing string-to-code
execution in production — the single most valuable thing this policy buys. Pinned by
`test/security/csp.test.ts`.

**2. `directive=connect-src blocked=wss://…supabase.co/realtime/v1/websocket` — REAL BUG, fixed.**

Supabase Realtime (messages + presence, `Sidebar.tsx`) opens a WebSocket, and CSP
matches the whole scheme, so `connect-src 'self' https://*.supabase.co` did **not**
cover it. Enforcing the policy as originally written would have silently killed
realtime in production, while every unit test stayed green — no test opens a
WebSocket. `connect-src` now includes `wss://*.supabase.co`, pinned by a test.

This is the concrete payoff of report-only: the outage was found before it shipped.

## Free-tier limits to validate before launch

### Vercel

- Function execution time limits
- Edge/runtime memory limits
- Region cold starts and SSR concurrency
- Request quota during peak traffic bursts

### Supabase

- Database connection limits
- CPU and storage quotas
- Pool sizing under concurrent writes and reads
- Query latency under traffic spikes

### Redis / Upstash

- Rate limit enforcement and fail-open behavior
- Cache eviction and latency spikes
- Redis quota exhaustion and outages

### QStash

- Duplicate job handling and retries
- Worker queue processing under burst load
- DLQ and failure monitoring

### Cloudflare

- Bot mitigation and abuse rate limits
- Anycast edge uniqueness and IP trust assumptions
- WAF / challenge patterns that alter traffic volume

## Local load-test plan

1. Run Prisma locally with a realistic dataset size and connection pool settings.
2. Simulate bursts of write-heavy traffic on feed, notifications, and messages.
3. Measure concurrent DB connections, query latency, and transaction timeouts.
4. Simulate Redis outage and verify the app fails closed only where required.
5. Replay QStash jobs with duplicate payloads to confirm idempotency.
6. Run concurrent sign-ups, form submissions, and message sends behind Cloudflare-like request headers.
7. Record max throughput and the exact breakpoints that trigger free-tier warnings.

## Recommended next actions

1. Review the remaining P1 items in order.
2. Run a full load test in a staging environment with live credentials.
3. Add alerting and operational runbooks before any public launch.
