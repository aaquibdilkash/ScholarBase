import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [],
  resolve: {
    // Mirrors the `@/*` -> `src/*` alias in tsconfig.json so tests can import
    // production modules by their canonical path.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` is a Next build-time marker package, not a direct
      // dependency, so Vitest cannot resolve it. Two modules import it
      // (`lib/cloudinary.ts`, the trim-maintenance cron route), which means any
      // server component that transitively reaches Cloudinary fails to load in
      // the unit tier. The stub keeps the import in the source untouched.
      "server-only": fileURLToPath(
        new URL("./test/stubs/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    name: "unit",
    globals: true,
    environment: "node",
    // The unit tier is everything under `test/` except the tiers that need real
    // infrastructure. Integration tests live in `test/integration/**` and run
    // only under `vitest.integration.config.ts`.
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    exclude: ["test/integration/**", "test/ui/**", "node_modules/**", ".next/**"],
    // Blocks database and outbound-network access from the unit suite, so
    // `npm test` can never consume Supabase compute or a Supavisor connection.
    setupFiles: ["test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.d.ts", "src/types/**"],
      // Ratchet, not aspiration: these are the measured Phase 0 numbers, floored
      // slightly to absorb run-to-run noise. CI now fails if coverage regresses,
      // and raising them is a deliberate act as new tests land. The old 50/50
      // thresholds were decorative: nothing invoked `--coverage`, so the suite
      // passed at 3.21% statements.
      // Re-measured 2026-09-30 against the current suite (1514 tests): 19.57%
      // statements, 11.88% branches, 12.84% functions, 20.26% lines. Floored a
      // little below each so CI passes today and FAILS on any regression —
      // that is the point of a ratchet. The previous 5/5/5 was set when the
      // suite ran at 3.21% and was never re-measured as the tests landed.
      //
      // These numbers are low in absolute terms because the unit tier mocks the
      // database and the network, so untested surface is concentrated in the
      // pages, cron routes and admin reads. Raising them is a deliberate act
      // alongside new tests, not a config tweak.
      thresholds: {
        statements: 19,
        functions: 12,
        branches: 11,
        lines: 19,
      },
    },
  },
});