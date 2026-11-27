# Tooling speedup — analysis and deferred migration plan

Status: **deferred**. Captures the investigation of "why are tsc, lint, tests, and build slow, and should we upgrade TypeScript/lint/test/build tooling?". Safe, behavior-preserving items can land now; TypeScript 7 and the lint replacement are explicitly **waiting** until `@typescript-eslint` supports TypeScript 7.

Companion files: `AGENTS.md` (standing rules), `docs/ci-build-caching` (Next docs, installed under `node_modules/next/dist/docs/01-app/02-guides/ci-build-caching.md`).

## 1. Baseline measured on this checkout (2026-11-27)

| Step | Time | Notes |
|---|---:|---|
| `tsc --noEmit` cold/full | **29.2 s**, ~2.0 GB RAM | `--incremental false`; 853 TS/TSX/MTS files, strict mode |
| `tsc --noEmit` warm incremental | **6.2 s** | reuses `tsconfig.tsbuildinfo` |
| `eslint` cold | **31.9 s**, ~1.25 GB RAM | no cache |
| `eslint` with `--cache --cache-strategy content`, warm | **2.2 s** | |
| `eslint` with `--concurrency auto` (cold) | 26.0 s, ~2.7 GB RAM | worse warm (3.5 s) + concurrency warning |
| `vitest run` | **32.1 s** | 215 files, 3,185 tests, ~447 MB RAM |
| `next build` | **not measured** | writes `.next`; measure with `/usr/bin/time npm run build` |

`npm run typecheck` and `npm run lint` already run in CI in that order (`lint -> typecheck -> test:coverage`), then a production build on pull requests. Deploy jobs depend on `verify` + `integration`.

## 2. Installed tooling versions

- Node 24.18.0 (local), CI/Docker Node 22
- `next` 16.3.7
- `typescript` 5.9.3 (devDependency `^5`)
- `eslint` 9.39.5, `eslint-config-next` 16.3.7
- `@typescript-eslint/parser` 8.67.0 installed (latest published 8.74.0)
- `vitest` 4.1.11, `@vitest/coverage-v8` 4.1.11
- `@prisma/client` / `prisma` 7.10.0

Relevant `tsconfig.json` settings already present: `"strict": true`, `"skipLibCheck": true`, `"incremental": true`, `"target": "ES2017"`, `"moduleResolution": "bundler"`, `"jsx": "react-jsx"`. `noEmit: true`.

## 3. Verdict on the proposed changes

### 3.1 Upgrade to TypeScript 7.0.2 — BLOCKED, wait

- Latest stable is 7.0.2 (7.1.0-beta also exists). Microsoft’s 8–12x faster claim is real and belongs to 7.0 (Go rewrite).
- Next.js 16.3.7 **already supports** TS 7: `experimental.useTypeScriptCli` defaults to `true` (`node_modules/next/dist/server/config-shared.js`), and Next runs the project-local `tsc` CLI instead of the JS compiler API. So `next build` itself would be fine.
- **Blocker:** `@typescript-eslint/parser` latest (8.74.0) declares `peerDependencies.typescript >=4.8.4 <6.1.0`. TS 7’s package `exports` only expose `./unstable/*` and `./lib/version.cjs` — no `lib/typescript.js` compiler API. Installing `typescript@7` therefore either fails `npm ci` peer resolution (npm 11 strict) or breaks `npm run lint` at runtime.
- **Decision: wait.** Revisit when `@typescript-eslint` ships TS 7 support. Then upgrade `typescript` and `eslint-config-next` together and run the full gate (`lint -> typecheck -> test:coverage` + build).

### 3.2 TypeScript 6.0.3 — optional, not a speed win

- 6.0.3 is the newest version compatible with `@typescript-eslint` (peer `<6.1.0`) and is supported by Next 16.
- TS 6 is a transition release (last JS-based compiler). It flips defaults (`strict: true`, `module: esnext`, `target: es2025`, `types: []`, `noUncheckedSideEffectImports: true`, `rootDir` = config dir) and deprecates legacy options. Our `tsconfig.json` would need `"types": ["node"]` and possibly other adjustments; no measured performance benefit.
- **Decision:** do not migrate for speed. Only do it as a deliberate prep step before TS 7, on a branch, with `ignoreDeprecations: "6.0"` if needed.

### 3.3 Replace ESLint with Biome/Oxlint — NO

- Would drop `eslint-config-next` rules (`@next/next/*`) and the current TypeScript-ESLint rules; Biome has no Next-specific rules and Oxlint’s parity is incomplete.
- A formatter migration would rewrite the entire codebase — a huge diff, against the “smallest viable diff” rule.
- **Decision:** keep ESLint. Optimize it instead (see §4.1).

### 3.4 Use Vitest — already done

No change. 3,185 tests run in 32 s. Not the bottleneck.

### 3.5 Turbopack — already default

Next 16 uses Turbopack for both `next dev` and `next build`; `next.config.ts` does not pass `--webpack`. `turbopackFileSystemCacheForBuild` defaults to `true` since 16.3.0. No change needed.

### 3.6 `typescript.ignoreBuildErrors: true` — NOT blindly

- It skips Next’s type-check entirely, including route types generated at build time.
- CI runs `tsc --noEmit` *before* `next build`, and on a fresh checkout `.next/types` and `next-env.d.ts` do not exist, so `tsc` does not cover route types.
- Safe only if `next typegen` is added to the typecheck step first (see §4.5). Even then it is a deliberate safety tradeoff, not a free win.

### 3.7 Docker `.next/cache` mount — NOT a CI win as written

- A `RUN --mount=type=cache,target=/app/.next/cache` only persists if the BuildKit builder survives. GitHub-hosted runners are ephemeral; `cache-to: type=gha` exports layers, not cache mounts. Would need `buildkit-cache-dance` or a registry cache.
- Keep the mount as a local/long-lived-builder optimization only.

### 3.8 `incremental` + `skipLibCheck` — already set

Both already `true`. Nothing to do.

## 4. Safe, behavior-preserving plan (can land now)

### 4.1 ESLint caching (safe, biggest immediate win)

`package.json`:

```json
"lint": "eslint --cache --cache-location node_modules/.cache/eslint/.eslintcache --cache-strategy content"
```

- Same rules, same config; only unchanged files are skipped.
- Measured 31.9 s cold → 2.2 s warm.
- `--cache-strategy content` is important: a fresh checkout gives every file a new mtime, so the default metadata strategy would miss; content hashing still matches unchanged files.
- Cache lives under `node_modules/.cache` (already ignored).
- CI: add `actions/cache` for `node_modules/.cache/eslint`, keyed on `package-lock.json` + `eslint.config.mjs` (+ branch restore-keys).
- Do **not** add `--concurrency auto`: it cuts cold lint to ~26 s but makes warm runs slower (~3.5 s) and emits a concurrency warning.

### 4.2 Persist `.next/cache` in CI (safe)

Next 16.3 already enables `turbopackFileSystemCacheForBuild` by default, but CI does not preserve `.next/cache`. Add an `actions/cache` step before `npm run build` in the `verify` job (see installed docs `ci-build-caching.md`), with restore-keys on the lockfile. Helps repeated PR pushes because Turbopack rebuilds only changed modules.

### 4.3 Remove duplicate `npx prisma generate` in Docker (safe, small)

The `deps` stage already runs `npm ci`, whose `postinstall` runs `prisma generate` (generator has no custom output, so the client lands in `node_modules`, which is copied to the build stage). The build stage’s `RUN npx prisma generate && npm run build` generates it a second time. Drop the `npx prisma generate &&` part; verify with one Docker build.

### 4.4 Optional: cache `tsconfig.tsbuildinfo` in CI

Cold typecheck 29 s → ~6 s warm. Restore the file in CI (key on `package-lock.json` + `tsconfig.json` + branch, restore-keys). Validate cache correctness on a branch first.

### 4.5 Optional: single typecheck pass (safety tradeoff)

Only if you want to remove the duplicate typecheck (CI runs `tsc`, then `next build` runs `tsc` again):

1. Make `typecheck` run `next typegen && tsc --noEmit` (generates route types so `tsc` covers them).
2. Then set `typescript.ignoreBuildErrors: true`.
3. Keep the CI `typecheck` step as a required gate.

This is a deliberate safety change, not a free optimization. Do not do it until the route-type flow is verified.

## 5. What NOT to do

- Upgrade to TypeScript 7 now (blocked by `@typescript-eslint`).
- Replace ESLint with Biome/Oxlint (not a drop-in).
- Set `ignoreBuildErrors: true` without `next typegen` (route types go unchecked).
- Rely on a Docker `.next/cache` mount on GitHub-hosted runners (cache mounts are not exported by the GHA cache backend).
- Migrate to TypeScript 6 just for speed (no benefit, default changes).

## 6. Deferred trigger

Revisit the TypeScript 7 migration when `@typescript-eslint` supports it (latest 8.74.0 still `<6.1.0`). At that point:

1. Upgrade `typescript` and `eslint-config-next` together.
2. Add `"types": ["node"]` (and other TS 6/7 default adjustments) to `tsconfig.json`.
3. Re-run `npm run lint && npm run typecheck && npm run test:coverage` plus `npm run build`.
4. Measure before/after with `/usr/bin/time`.

Until then, the safe items in §4 are the standing speedup work.