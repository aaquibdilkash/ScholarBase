<!-- BEGIN:nextjs-agent-rules -->
# ScholarBase — agent guide

This is **Next.js 16.3.7**, not the Next.js from model training. Read the relevant guide under `node_modules/next/dist/docs/` before changing framework behavior. Next 16 uses `src/proxy.ts` as the middleware/proxy entrypoint; there is no `middleware.ts`.

Stack: App Router + React 19 + strict TypeScript; Prisma 7.10 on PostgreSQL/Supabase; Upstash Redis/QStash; Cloudinary; Resend. CI and Docker use Node 22 and npm (`package-lock.json`).

Operating assumptions: Supabase compute and connections are scarce, reads should be zero-compute, interactions should feel instant, and reputation is integrity-sensitive.

## Standing directive — lean, fast, secure

Every change is also a cleanup pass. The default answer to "should we add this?" is no unless it replaces something or removes a bottleneck.

- **Delete before adding.** Remove dead exports, unused components/hooks/types, orphaned routes, commented-out blocks, and dependencies nobody imports. Verify with a grep for every symbol before deleting it; never leave two implementations of the same thing.
- **One primitive per concern.** URLs, dates, formatting, pagination, query builders, rate limits, and loading/error/empty states reuse the existing helper or component (`getBaseUrl`, `src/lib/format*`, `src/components/ui/*`, tri-split). Do not fork a helper to change one line.
- **No new dependency** unless it cannot be written with the existing stack in a few lines. Check maintenance, license, and bundle cost first; prefer the standard library, existing deps, and `node:crypto`.
- **Consistency is part of done.** A new page, list, form, or email must match the closest existing one: same tokens/spacing, same loading/error/empty states, same pagination and caching, same action result shape.
- **Server first.** New UI is a Server Component unless it needs state, effects, or event handlers; `"use client"` belongs at the leaf. Never ship a client component that only renders server data.
- **Measure, then optimize.** Establish a baseline first: query count per request, `EXPLAIN (ANALYZE, BUFFERS)` on hot paths, `npm run build` bundle output, and real page timings. No speculative rewrites of working code. The standing rules in "Read performance (zero-compute)" and "Database" apply to every new list, along with its indexes and tri-split wiring.
- **Security is not optional work.** Validate input at the boundary, never interpolate SQL (Prisma or parameterized `$queryRaw` only), never expose secrets or service keys to the client, keep writes `onDegraded: "closed"`, keep the CSP/nonce contract in `src/proxy.ts`, and keep auth/role checks server-side.
- **Caution protocol.** Smallest viable diff; one concern per change; no drive-by refactors inside a bug fix; preserve public action response shapes, migration history, soft-delete, and reputation invariants. If a cleanup would change behavior, state the tradeoff and ask before doing it.
- **Bug fixes ship with a test** that fails before and passes after. Finish every change with `npm run lint && npm run typecheck && npm run test:coverage` (plus `npm run build` for framework/routing changes); never lower coverage thresholds to go green.

## Map

- `src/app/` — routes and Server Actions. Actions live in `src/app/actions/`; the README's `src/actions/` does not exist.
- `src/lib/` — server domain logic. Vote/comment/bookmark/follow writes all route through `src/lib/transactions.ts` (`ENTITY_CONFIG` maps every content module).
- `src/lib/tri-split/` — list/page stack: cached viewer-agnostic rows plus one indexed live overlay. New lists should use `createTriSplitList` / `createContentList`; never accept a viewer id from the client.
- `prisma/schema.prisma` + `prisma/migrations/` — schema and history. For a new content/list module, wire the schema, `ENTITY_CONFIG`, `CONTENT_TABLES` (`src/lib/module-registry.ts`), and the tri-split registry.
- Tests live in `test/`, grouped by the `src/` module they cover; import source through the `@/` alias, not relative paths.

## Commands

```bash
npm install                 # postinstall runs prisma generate
npx prisma generate         # re-run if the client is stale
npm run dev
npm run build
npm run start

npm run lint                # eslint
npm run typecheck           # tsc --noEmit

npm test                    # unit tier, same as test:unit
npx vitest run test/transactions/vote-matrix.test.ts  # one file
npm run test:watch
npm run test:coverage       # CI gate
npm run test:integration    # needs a loopback DATABASE_URL
npm run test:all            # coverage + integration
```

CI order is `lint -> typecheck -> test:coverage`, then a production build on pull requests. Match that order before finishing a change.

## Testing guardrails

- `npm test` is unit-only. `test/setup.ts` mocks `@/lib/db` and blocks non-loopback `fetch`; a DB/network test placed in the unit tier fails by design. Stub `globalThis.fetch` when a test needs HTTP.
- `test/integration/**` is the only tier allowed to use real Postgres. `test/setup-integration.ts` requires a loopback `DATABASE_URL` and refuses Supabase. CI applies migrations only when that folder actually contains tests.
- Coverage thresholds in `vitest.config.ts` are a deliberate ratchet. Raise them with new tests; never lower them to make a suite pass.

## Next.js and runtime quirks

- `src/proxy.ts` creates a per-request CSP nonce and must forward `x-nonce` plus the request-side `Content-Security-Policy`. Apply CSP to every response object you return: Supabase token refresh replaces the response, so a bare `NextResponse.next()` silently drops it.
- `next build` intentionally runs without runtime secrets. `src/lib/env.ts` uses `SKIP_ENV_VALIDATION`/build placeholders; production validation happens at runtime. `NEXT_PUBLIC_*` values are compiled into the client at build time.
- `next.config.ts`: standalone output, `deploymentId = SOURCE_COMMIT`, 6 MB Server Action body limit, unoptimized images. The Docker build uses `SKIP_ENV_VALIDATION=true` and placeholder QStash/Resend keys.
- Sentry is already wired in `src/instrumentation*.ts` and `src/sentry.server.config.ts`. Do not run the Sentry wizard; it generates conflicting config files.
- Realtime messaging uses Broadcast-from-Database private channels (`privateChannel()` in `src/lib/realtime.ts`). Do not add Postgres Changes listeners; SQL and policies live in `supabase/realtime/`.

## Database

- Runtime uses the pooled `DATABASE_URL` through one `pg` Pool + `PrismaPg` adapter in `src/lib/db.ts`. Do not create another `PrismaClient` or pool; `DB_POOL_MAX` defaults to 10.
- Prisma CLI/migrations use `DIRECT_URL` via `prisma.config.ts`. Keep `DATABASE_URL` pooled and `DIRECT_URL` direct; never run `prisma migrate reset` or `db push` against a live/Coolify database.
- Remote/production database startup requires `SUPABASE_CA_CERT_BASE64` (or `SUPABASE_CA_CERT`); local/internal Docker hosts skip TLS. `next build` is exempt.
- Inside `prisma.$transaction`, do not call helpers that hit the global client (for example `isUserAdmin`); resolve them before opening the transaction to avoid a second pool checkout/deadlock. `deleteCommentTransaction` is the reference.
- Coolify database work is done through an SSH tunnel; follow `docs/prisma-coolify-migration-runbook.md`. Migration recovery is in `Prisma.md`.

## Read performance (zero-compute)

- Use materialized counters (`totalVotes`, `totalComments`, `totalBookmarks`, `totalReplies`, `followersCount`, `followingCount`) and indexed counts. Never use dynamic `_count` or per-row aggregations on feeds.
- Fetch viewer state in the main query (`votes: { where: { userId } }`) or through the tri-split overlay, not with a second query per row.
- Unread notifications use indexed `count`; unread messages use the raw SQL join in `getUnreadMessageCount`; admin totals use `pg_class.reltuples`.
- New feeds/lists need matching indexes: `createdAt(sort: Desc)`, `trendingScore(sort: Desc)`, `[parentId, createdAt(sort: Desc)]`, and `[recipientId, readAt, createdAt(sort: Desc)]` for notifications. The user directory relies on descending `trendingScore`/`reputation` indexes.

## Writes, reputation, and deletion

- Votes, comments, replies, follows, and bookmarks run inside `prisma.$transaction` and return updated counters/rows. Use `transactions.ts`; do not write ad-hoc counter updates.
- Vote matrix: new vote = upsert + increment `totalVotes` + increment author reputation; toggle off = delete + reverse both; switch = update + double-adjust both. Self-votes are rejected server-side.
- Reputation is 1 vote = 1 point. Content creation grants none; survey participation's +1 is the only non-vote grant. User-facing delete paths reverse the author's reputation by the deleted content's `totalVotes`.
- `updatedAt` changes on counter updates. Use `editedAt` to detect real content edits.
- Comments/replies are never hard-deleted: set `isDeleted`, `deletedByType`, and `deletedById`. Render a tombstone only when `totalReplies > 0`; hide it otherwise. Permission order is in `src/lib/deletion.ts`.
- Main content uses soft delete (`isDeleted: true`); `trim-soft-deleted-posts` hard-deletes rows whose `updatedAt` is more than 30 days old. Do not add direct `.delete()` calls for content rows.

## Auth, mutations, and rate limits

- User-facing mutations use `getActiveUser()` and return a normal `{ success: false, ... }` result when the account is frozen. `requireActiveUser()` throws and is for admin/intentional hard failures; `requireCurrentUser()` is for appeals, notification reads, and private settings where frozen users must still read.
- Server Actions return the persisted row (`{ success: true, data }`). Update React Query with `setQueryData`, or use `useOptimistic` for vote/follow/bookmark micro-interactions. Do not use `revalidatePath` for those; purge cached lists with `revalidateTag(tag, { expire: 0 })` or the tri-split `revalidate()`.
- Writes pass `onDegraded: "closed"` to `checkRateLimit`; reads default to fail-open. Keep that policy.

## Background jobs and deployment

- Cron routes in `src/app/api/cron/{daily-digest,weekly-digest,trim-maintenance,trim-soft-deleted-posts}` must call `verifyCronSecret()` (Bearer `CRON_SECRET`). `update-trending` is a Postgres function documented in `src/app/api/cron/update-trending/update-trending.md`, not an app route.
- QStash jobs in `src/app/api/jobs/*` are wrapped with `verifySignatureAppRouter`; do not bypass signature verification.
- CI on pushes to `staging`/`production` builds an ARM64 image, pushes it to GHCR, and triggers Coolify; `main`/`development` do not auto-deploy. The Docker `migrate` stage runs `prisma migrate deploy`.

## Stale sources and historical labels

- README has stale details (Prisma 7.9, `src/actions`, Vercel deployment). Trust `package.json`, `.github/workflows/ci.yml`, `Dockerfile`, `next.config.ts`, and this file.
- Code comments cite “RULE 1–7”; the numbering is historical and not aligned with the sections here. Follow the surrounding prose and the actual implementation.

<!-- END:nextjs-agent-rules -->
