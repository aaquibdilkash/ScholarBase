/**
 * P1-1 — rate-limit fail-open / fail-closed policy.
 *
 * Redis (Upstash) is the enforcement point for every limiter in the app. When
 * it goes down — missing env, network error, quota exhausted — the app must
 * make a deliberate choice per caller, not a global one:
 *
 *  - WRITES (create/edit/delete, votes, follows, messages, auth, contact,
 *    exports) FAIL CLOSED. An unguarded write burst during an outage spends
 *    the shared Supabase pool, Resend's 100/day cap, and QStash fan-out —
 *    exactly the resources AGENTS.md Rule 1 calls precious.
 *  - READS (search, feed browse, mark-as-read) FAIL OPEN. Returning an empty
 *    page or a hot cache hit is a better outage than locking every reader
 *    out, and the min-length floor already keeps 1-2 char searches off the
 *    database entirely.
 *
 * This file pins both halves:
 *  1. Behavioural — what checkRateLimit/enforceRateLimit actually return when
 *     the Redis client cannot be constructed or limiter.limit() throws.
 *  2. A source scan — every checkRateLimit call in the app must declare its
 *     policy explicitly (onDegraded), so a future write path cannot be
 *     added fail-open by default.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Upstash mocks. Behaviour is switched per test via the control vars.
// ---------------------------------------------------------------------------

let fromEnvThrows = false;
let limitMode: "ok" | "throw" | "deny" = "ok";

vi.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: vi.fn(() => {
      if (fromEnvThrows) throw new Error("Missing UPSTASH_REDIS_REST_URL");
      return {};
    }),
  },
}));

vi.mock("@upstash/ratelimit", () => {
  const limit = vi.fn(async () => {
    if (limitMode === "throw") throw new Error("connection timed out");
    if (limitMode === "deny") return { success: false };
    return { success: true };
  });
  class Ratelimit {
    limit = limit;
    constructor(_config: unknown) {}
    static slidingWindow(_limit: number, _window: string) {
      return { kind: "sliding" };
    }
  }
  return { Ratelimit };
});

// Distinct from "@/lib/rate-limit" statics in mocks elsewhere: this file
// exercises the REAL implementation with Upstash stubbed underneath.
import {
  checkRateLimit,
  enforceRateLimit,
  RATE_LIMIT_DEGRADED_ERROR,
  RATE_LIMIT_ERROR,
} from "@/lib/rate-limit";

beforeEach(() => {
  fromEnvThrows = false;
  limitMode = "ok";
});

// The limiter caches clients per `${namespace}:${limit}:${window}`, so each
// test uses its own namespace to avoid inheriting a cached null/limiter.
describe("checkRateLimit degraded policy", () => {
  it("fails OPEN by default (reads keep serving when limit() throws)", async () => {
    limitMode = "throw";
    const outcome = await checkRateLimit({
      namespace: "p11:read:throw",
      key: "k",
      limit: 5,
      window: "1 m",
    });
    expect(outcome).toEqual({ allowed: true, limited: false, degraded: true });
  });

  it("fails OPEN by default when the Redis client cannot be built", async () => {
    fromEnvThrows = true;
    const outcome = await checkRateLimit({
      namespace: "p11:read:noenv",
      key: "k",
      limit: 5,
      window: "1 m",
    });
    expect(outcome).toEqual({ allowed: true, limited: false, degraded: true });
  });

  it("fails CLOSED with onDegraded: closed when limit() throws", async () => {
    limitMode = "throw";
    const outcome = await checkRateLimit({
      namespace: "p11:write:throw",
      key: "k",
      limit: 5,
      window: "1 m",
      onDegraded: "closed",
    });
    expect(outcome).toEqual({ allowed: false, limited: false, degraded: true });
  });

  it("fails CLOSED with onDegraded: closed when the client cannot be built", async () => {
    fromEnvThrows = true;
    const outcome = await checkRateLimit({
      namespace: "p11:write:noenv",
      key: "k",
      limit: 5,
      window: "1 m",
      onDegraded: "closed",
    });
    expect(outcome).toEqual({ allowed: false, limited: false, degraded: true });
  });

  it("still throttles normally when Redis is healthy (closed)", async () => {
    limitMode = "deny";
    const outcome = await checkRateLimit({
      namespace: "p11:write:deny",
      key: "k",
      limit: 5,
      window: "1 m",
      onDegraded: "closed",
    });
    expect(outcome).toEqual({ allowed: false, limited: true, degraded: false });
  });
});

describe("enforceRateLimit fails closed (write paths)", () => {
  it("throws the degraded message when Redis is down", async () => {
    limitMode = "throw";
    await expect(
      enforceRateLimit({
        namespace: "p11:enforce:throw",
        key: "k",
        limit: 5,
        window: "10 m",
      }),
    ).rejects.toThrow(RATE_LIMIT_DEGRADED_ERROR);
  });

  it("throws the throttle message when over the limit", async () => {
    limitMode = "deny";
    await expect(
      enforceRateLimit({
        namespace: "p11:enforce:deny",
        key: "k",
        limit: 5,
        window: "10 m",
      }),
    ).rejects.toThrow(RATE_LIMIT_ERROR);
  });

  it("passes when Redis is healthy", async () => {
    await expect(
      enforceRateLimit({
        namespace: "p11:enforce:ok",
        key: "k",
        limit: 5,
        window: "10 m",
      }),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Source scan: every checkRateLimit call site must declare its policy.
// ---------------------------------------------------------------------------

describe("call-site policy declarations (source scan)", () => {
  const READ_ALLOWLIST = new Set([
    // Search is deliberately uncached and served to anonymous callers;
    // degrading to an empty page beats a hard error (see search-guardrails).
    "search:",
    // markConversationAsRead is a passive read-shaped write — silently
    // skipping it during an outage only delays badge updates.
    "message:read",
  ]);

  function* walk(dir: string): Generator<string> {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) yield* walk(full);
      else if (entry.name.endsWith(".ts")) yield full;
    }
  }

  it("every write-path checkRateLimit declares onDegraded", () => {
    const missing: string[] = [];
    for (const dir of ["src/app/actions", "src/app/api"]) {
      for (const file of walk(dir)) {
        const source = readFileSync(file, "utf8");
        for (const match of source.matchAll(/checkRateLimit\(\{/g)) {
          // Slice out the object literal — braces are balanced and this file's
          // call sites never nest another object literal inside the config.
          const start = match.index ?? 0;
          const end = source.indexOf("})", start);
          const block = source.slice(start, end);
          if (block.includes("onDegraded")) continue;
          const ns = block.match(/namespace:\s*[`"']([^`"']+)/)?.[1] ?? "?";
          const isRead = [...READ_ALLOWLIST].some((p) => ns.startsWith(p));
          if (!isRead) missing.push(`${file} → namespace ${ns}`);
        }
      }
    }
    expect(missing, "checkRateLimit calls missing onDegraded:").toEqual([]);
  });

  it("read paths never opt into fail-closed", () => {
    const violations: string[] = [];
    for (const file of [
      "src/lib/search-rate-limit.ts",
      "src/app/actions/messages.ts",
    ]) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/checkRateLimit\(\{/g)) {
        const start = match.index ?? 0;
        const end = source.indexOf("})", start);
        const block = source.slice(start, end);
        const ns = block.match(/namespace:\s*[`"']([^`"']+)/)?.[1] ?? "";
        if (
          (ns.startsWith("search:") || ns.startsWith("message:read")) &&
          block.includes('onDegraded: "closed"')
        ) {
          violations.push(`${file} → ${ns}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

