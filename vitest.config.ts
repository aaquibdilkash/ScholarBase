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
    globals: true,
    environment: "node",
    // All tests live in the top-level `test/` tree, grouped by module
    // subfolder (test/feed, test/auth, test/surveys, test/email, ...).
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.d.ts", "src/types/**"],
      thresholds: {
        functions: 50,
        statements: 50,
      },
    },
  },
});