import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [],
  resolve: {
    // Mirrors the `@/*` -> `src/*` alias in tsconfig.json so tests can import
    // production modules by their canonical path.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
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
      thresholds: {
        statements: 5,
        functions: 5,
        branches: 5,
      },
    },
  },
});