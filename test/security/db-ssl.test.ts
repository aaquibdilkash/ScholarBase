/**
 * Database TLS — fail-closed in production (M6 of the launch-readiness audit).
 *
 * The policy CHANGED from the original P1-5 wording, and the history matters:
 *
 * - Originally a startup throw was requested, then rejected, because `prisma`
 *   is constructed at module import and a missing secret would fail
 *   `next build` and every cold start.
 * - The launch audit (M6) accepted the throw anyway — a misconfigured
 *   production deployment silently querying with verification DISABLED is
 *   worse than a loud cold-start failure — and solved the build problem with
 *   an explicit `NEXT_PHASE === "phase-production-build"` exemption.
 *
 * So the shipped policy is now threefold:
 *   production, runtime     -> THROW (fail closed)
 *   production, `next build` -> warn + degraded SSL (secrets not required to build)
 *   dev/test                -> warn + degraded SSL (local development works)
 *
 * As before, the `Pool` is NEVER constructed here (it would open sockets in
 * CI): the decision is re-derived from the same inputs as a policy proxy, and
 * the branch itself is additionally asserted against the real source with
 * comments stripped.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DB_SOURCE = readFileSync(join(process.cwd(), "src", "lib", "db.ts"), "utf8");

class MissingCASignal extends Error {}

/**
 * Mirrors the decision in `getPool()` in src/lib/db.ts.
 *
 * Unlike the previous version, `isProduction` and `isBuildPhase` ARE branched
 * on now — because the real module branches on them too (NODE_ENV and
 * NEXT_PHASE). A proxy that ignored them would no longer model the shipped
 * behaviour.
 */
function resolveSsl(input: {
  databaseUrl?: string;
  caCert?: string;
  isProduction?: boolean;
  isBuildPhase?: boolean;
}): { rejectUnauthorized: boolean; ca?: string } | undefined {
  const isLocalDb =
    input.databaseUrl?.includes("localhost") ||
    input.databaseUrl?.includes("127.0.0.1");

  if (isLocalDb) return undefined;
  if (input.caCert) return { rejectUnauthorized: true, ca: input.caCert };
  if (input.isProduction && !input.isBuildPhase) {
    throw new MissingCASignal();
  }
  return { rejectUnauthorized: false };
}

describe("database TLS (fail-closed in production)", () => {
  it("verifies the server certificate when a CA is configured", () => {
    // The real production shape: pooler host, CA present.
    const ssl = resolveSsl({
      databaseUrl: "postgres://u:p@aws-0-ap-south-1.pooler.supabase.com:6543/db",
      caCert: "-----BEGIN CERTIFICATE-----",
      isProduction: true,
    });

    expect(ssl).toEqual({
      rejectUnauthorized: true,
      ca: "-----BEGIN CERTIFICATE-----",
    });
  });

  it("never disables verification when a CA is available", () => {
    const ssl = resolveSsl({
      databaseUrl: "postgres://u:p@aws-0-ap-south-1.pooler.supabase.com:6543/db",
      caCert: "-----BEGIN CERTIFICATE-----",
      isProduction: true,
    });

    expect(ssl?.rejectUnauthorized).toBe(true);
  });

  it("THROWS in production runtime when no CA exists", () => {
    // The M6 fix. The old behaviour returned { rejectUnauthorized: false } with
    // only a console.error — a misconfigured deployment stayed silently
    // downgraded for its entire life.
    expect(() =>
      resolveSsl({
        databaseUrl: "postgres://u:p@aws-0-ap-south-1.pooler.supabase.com:6543/db",
        isProduction: true,
      }),
    ).toThrow(MissingCASignal);
  });

  it("does NOT throw during `next build` (secrets are not required to build)", () => {
    // NEXT_PHASE=phase-production-build is the documented escape hatch: CI can
    // build without runtime secrets, while a real production cold start still
    // fails closed.
    expect(
      resolveSsl({
        databaseUrl: "postgres://u:p@aws-0-ap-south-1.pooler.supabase.com:6543/db",
        isProduction: true,
        isBuildPhase: true,
      }),
    ).toEqual({ rejectUnauthorized: false });
  });

  it("the REAL db.ts warns loudly whenever it degrades", () => {
    // The degraded branch still exists (build phase, dev, test) and still
    // screams, so a degraded connection can never scroll past unnoticed in
    // logs. Asserted against the real source rather than a spy so the test
    // cannot pass with db.ts unchanged.
    expect(DB_SOURCE).toContain("REFUSING TO VERIFY");
    expect(DB_SOURCE).toContain("DISABLED");
    // Names the variable that fixes it, so the log is actionable.
    expect(DB_SOURCE).toContain("SUPABASE_CA_CERT_BASE64");
    expect(DB_SOURCE).toMatch(/console\.error\([\s\S]{0,200}REFUSING TO VERIFY/);
  });

  it("the REAL db.ts throws only behind the production + non-build guard", () => {
    // Comments are stripped first: the branch's own comment explains the
    // policy and necessarily uses the word "throw", so a naive scan fails on
    // correct code.
    const codeOnly = DB_SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(
      /^\s*\/\/.*$/gm,
      "",
    );
    const start = codeOnly.indexOf("} else {");
    const end = codeOnly.indexOf("sslConfig = { rejectUnauthorized: false }");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const sslBranch = codeOnly.slice(start, end);

    // The throw exists...
    expect(sslBranch).toMatch(/\bthrow new Error\(/);
    // ...and ONLY inside this exact guard.
    expect(sslBranch).toContain('process.env.NODE_ENV === "production"');
    expect(sslBranch).toContain('process.env.NEXT_PHASE !== "phase-production-build"');
  });

  it("leaves local development unencrypted and unreported", () => {
    for (const url of [
      "postgres://u:p@localhost:5432/db",
      "postgres://u:p@127.0.0.1:5432/db",
    ]) {
      expect(resolveSsl({ databaseUrl: url })).toBeUndefined();
    }
  });
});
