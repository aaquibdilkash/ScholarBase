/**
 * Global test setup: guarantees the unit suite can never touch a database.
 *
 * Why mock rather than inspect `DATABASE_URL`: locally, Vite loads the real
 * `.env`, so `DATABASE_URL` legitimately points at Supabase. Asserting on the
 * variable would either fail every local run or force an allowlist that hides
 * real misuse. Mocking the client instead makes any accidental access fail
 * loudly, in CI and on a laptop, with no environment-specific rules.
 *
 * A test that genuinely needs a database is an integration test and belongs
 * behind an explicit opt-in (a separate project/config), not in this suite.
 */
import { vi } from "vitest";

const DB_ACCESS_MESSAGE =
  "A unit test tried to access the database via @/lib/db. The unit suite must " +
  "stay DB-free so it never consumes Supabase compute or Supavisor " +
  "connections. If you need real data, write an integration test behind an " +
  "explicit opt-in rather than reaching for the client here.";

/** Any property access on the client, or on one of its delegates, throws. */
const blocked = new Proxy(
  {},
  {
    get(_target, prop) {
      // Prisma internals probe a few symbols; let those through silently.
      if (typeof prop === "symbol" || prop === "then" || prop === "$$typeof") {
        return undefined;
      }
      return new Proxy(
        {},
        {
          get() {
            throw new Error(`${DB_ACCESS_MESSAGE} (via .${String(prop)})`);
          },
          apply() {
            throw new Error(`${DB_ACCESS_MESSAGE} (via .${String(prop)}())`);
          },
        },
      );
    },
  },
);

vi.mock("@/lib/db", () => ({ default: blocked }));
