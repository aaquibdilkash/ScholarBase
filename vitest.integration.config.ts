import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Integration tier — the only tier allowed to open a real Postgres connection.
 *
 * It exists as a separate config (not just a folder) for one reason: the unit
 * tier mocks `@/lib/db` globally, so an integration test placed in the same run
 * could never see a real client. Keeping the tiers in separate configs makes the
 * boundary mechanical rather than a convention someone has to remember.
 *
 * Run explicitly: `npm run test:integration`. The default `npm test` never
 * selects these files.
 *
 * Scope: this tier covers the 19 raw-SQL sites (`pg_trgm`, `to_tsvector`,
 * `pg_class`, cron procs) and Prisma behaviours the in-memory fake deliberately
 * refuses to emulate. It must point at a throwaway local database — the setup
 * file refuses anything else.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    name: "integration",
    globals: true,
    environment: "node",
    include: ["test/integration/**/*.test.ts"],
    // No `test/setup.ts` here on purpose: that file mocks the database client,
    // which is exactly what this tier must not do.
    setupFiles: ["test/setup-integration.ts"],
    // Integration tests mutate shared state within a file, but files must not
    // race each other's rows.
    fileParallelism: false,
    // A fresh checkout has no integration tests yet; the tier must not fail CI
    // for being empty until it is deliberately populated.
    passWithNoTests: true,
    testTimeout: 30_000,
  },
});
