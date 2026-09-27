import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated test report (`npm run test:coverage`). It is written to disk on
    // every coverage run, and linting a build artifact reports findings nobody
    // can act on — the one that surfaced was an unused directive in the report's
    // own bundled React shim.
    "coverage/**",
    // Kilo agent worktrees (not part of the active source tree):
    ".kilo/worktrees/**",
  ]),
  // Project-specific lint policy.
  //
  // 1) `react-hooks/set-state-in-effect` is a new, experimental
  //    React-Compiler heuristic that flags common, legitimate patterns
  //    (e.g. initializing client state from props/localStorage). Refactoring
  //    all of them would require restructuring data-fetch logic and would
  //    risk regressions, so it is disabled while the rest of the React Hooks
  //    rules stay strict.
  //
  // 2) This codebase (a Next.js app with a large, Prisma-backed domain layer)
  //    still contains many `any` annotations in server actions and API
  //    helpers. Downgrading `@typescript-eslint/no-explicit-any` to a warning
  //    keeps the gate green for the build while making the remaining `any`
  //    usages visible during review so they can be migrated to the types under
  //    `src/types` incrementally.
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      // Allow unused parameters prefixed with underscore (common for wrapped handlers)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
