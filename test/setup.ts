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

vi.mock("@/lib/db", () => ({ default: blocked }))

/**
 * Outbound-network guard.
 *
 * The unit suite must not reach Supabase, Resend, Upstash, Cloudinary or QStash.
 * Rather than enumerate hosts and hope the list is complete, only loopback
 * addresses are permitted; everything else fails the test with the offending
 * URL. A test that legitimately needs HTTP stubs `globalThis.fetch` itself,
 * which replaces this wrapper entirely.
 */
const nativeFetch = globalThis.fetch

function assertAllowedUrl(input: RequestInfo | URL): void {
  let raw: string
  if (typeof input === "string") raw = input
  else if (input instanceof URL) raw = input.toString()
  else if (input && typeof input === "object" && "url" in input) raw = String((input as Request).url)
  else raw = String(input)

  let host: string
  try {
    host = new URL(raw).hostname
  } catch {
    throw new Error(
      `A unit test attempted an outbound request to an unparseable URL (${raw}). ` +
        "Stub globalThis.fetch instead of performing real network I/O.",
    )
  }

  const isLoopback = host === "localhost" || host === "127.0.0.1" || host === "::1" || host === ""
  if (!isLoopback) {
    throw new Error(
      `A unit test attempted a real outbound request to "${host}". The unit ` +
        "suite must stay offline so it never talks to Supabase, Resend, Upstash, " +
        "Cloudinary or QStash. Stub globalThis.fetch for this test.",
    )
  }
}

// `fetch` never throws synchronously in real life, so neither does the guard:
// violations surface as a rejected promise, which keeps `.rejects.toThrow(...)`
// and ordinary `try/catch` around `await fetch(...)` both working.
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  try {
    assertAllowedUrl(input)
  } catch (error) {
    return Promise.reject(error)
  }
  return nativeFetch(input, init)
}) as typeof fetch

/**
 * Supabase-coupling guard.
 *
 * Migrations in this repo are vanilla Postgres (no `auth.users`, no RLS), so a
 * throwaway database is structurally safe — but nothing should *point* at the
 * production project during a test run. This is a belt to the mocked client's
 * braces: if a real client is ever constructed with a Supabase DSN, fail loudly.
 */
const SUPABASE_HOST = /\.supabase\.(co|in|red)\s*$/i

for (const key of ["DATABASE_URL", "DIRECT_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"] as const) {
  const value = process.env[key]
  if (!value) continue
  let host: string | null = null
  try {
    host = new URL(value).hostname
  } catch {
    continue
  }
  if (host && SUPABASE_HOST.test(host)) {
    throw new Error(
      `${key} points at the hosted Supabase project "${host}". No test run may ` +
        "target Supabase: use a throwaway local Postgres (integration tier) or " +
        "the in-memory fake (unit tier).",
    )
  }
}

