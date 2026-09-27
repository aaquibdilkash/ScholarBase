/**
 * Integration-tier setup: the gate between "I want to run integration tests" and
 * "I accidentally pointed a destructive test at production".
 *
 * Two rules, both enforced before a single test body executes:
 *   1. `DATABASE_URL` must be present — no implicit local-database guessing.
 *   2. Its host must be loopback — a Supabase or staged-shared host is rejected,
 *      because these tests write, truncate, and drop.
 *
 * Migrations here are plain Postgres (no `auth.users`, no RLS policies), so a
 * local cluster is a faithful target. The guard is about blast radius, not
 * compatibility.
 */
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "Integration tests require DATABASE_URL to point at a throwaway local " +
      "Postgres database. Example: " +
      "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/scholarbase_test " +
      "npm run test:integration",
  );
}

let host: string;
try {
  host = new URL(url).hostname;
} catch {
  throw new Error(`DATABASE_URL is not a valid Postgres URL for the integration tier: ${url}`);
}

if (!LOOPBACK_HOSTS.has(host)) {
  throw new Error(
    `Integration tests refuse to run against "${host}". These tests write and ` +
      "truncate tables; point DATABASE_URL at a loopback Postgres instance. " +
      "Production and preview Supabase databases are never acceptable targets.",
  );
}

// Integration tests are the only tier that constructs a real Prisma client, and
// they import `@/lib/db` for real. `test/setup.ts` is intentionally NOT loaded
// here; if a future config change ever loads it, the mocked client would make
// every assertion below silently meaningless.
