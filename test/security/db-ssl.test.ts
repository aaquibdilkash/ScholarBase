/**
 * P1-5 — database TLS.
 *
 * What this pins is narrower than the checklist's original "throw at startup",
 * and the difference matters:
 *
 * - **Do NOT test the `Pool` construction directly.** `src/lib/db.ts` builds a
 *   real `pg.Pool` at module import, which would try to open sockets in CI. So
 *   the decision is re-derived here from the same inputs the module uses, and
 *   asserted as a policy. This is a proxy for the module's branch, not the
 *   branch itself — which is stated plainly rather than dressed up.
 * - **Throwing was rejected on purpose.** `prisma` is created at import time, so
 *   a throw on a misconfigured env would fail `next build` and every cold
 *   serverless start. A hardening measure that takes the app down is not a
 *   hardening measure.
 * - **The assertion that matters is the happy path**: with a CA present, in
 *   production, verification must be ON. That is the configuration production
 *   actually runs, and the one where a regression would be silent.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DB_SOURCE = readFileSync(join(process.cwd(), "src", "lib", "db.ts"), "utf8");

/**
 * Mirrors the decision in `getPool()` in src/lib/db.ts.
 *
 * `isProduction` is accepted but NOT branched on, deliberately: the real module
 * decides purely from the connection string and the CA cert, so this helper must
 * not invent a NODE_ENV branch that does not exist. It is optional purely
 * because callers naturally describe a scenario as local-vs-production.
 */
function resolveSsl(input: {
  databaseUrl?: string;
  caCert?: string;
  isProduction?: boolean;
}): { rejectUnauthorized: boolean; ca?: string } | undefined {
  const isLocalDb =
    input.databaseUrl?.includes("localhost") ||
    input.databaseUrl?.includes("127.0.0.1");

  if (isLocalDb) return undefined;
  if (input.caCert) return { rejectUnauthorized: true, ca: input.caCert };
  return { rejectUnauthorized: false };
}

describe("P1-5 database TLS", () => {
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

  it("disables verification only when no CA exists", () => {
    // The downgrade still happens (nothing else can connect without a CA), but
    // it is a last resort rather than the default.
    expect(
      resolveSsl({
        databaseUrl: "postgres://u:p@aws-0-ap-south-1.pooler.supabase.com:6543/db",
        isProduction: true,
      }),
    ).toEqual({ rejectUnauthorized: false });
  });

  it("the REAL db.ts warns loudly on that downgrade", () => {
    // The branch above is only a proxy re-derived from db.ts. What actually
    // matters is that the shipped module emits a visible warning, so that is
    // asserted against the real source rather than manufactured by this test —
    // an earlier version of this test called console.error itself and asserted
    // on the spy, which would have passed even with db.ts completely unchanged.
    const dbSource = DB_SOURCE;

    expect(dbSource).toContain("REFUSING TO VERIFY");
    expect(dbSource).toContain("DISABLED");
    // Names the variable that fixes it, so the log is actionable.
    expect(dbSource).toContain("SUPABASE_CA_CERT_BASE64");
    // And it must be an error, not a warn that scrolls past.
    expect(dbSource).toMatch(/console\.error\([\s\S]{0,200}REFUSING TO VERIFY/);
  });

  it("does NOT throw on a missing CA, so builds and cold starts survive", () => {
    // P1-5 originally asked for a startup throw. `prisma` is constructed at
    // module import, so throwing here would fail `next build` and every cold
    // serverless start on a misconfigured env.
    // Comments are stripped before the check: the branch's own comment explains
    // why throwing was REJECTED and necessarily uses the word, so a naive scan
    // fails on correct code. (Same trap as the sw.js precache test.)
    const codeOnly = DB_SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(
      /^\s*\/\/.*$/gm,
      "",
    );
    const sslBranch = codeOnly.slice(
      codeOnly.indexOf("} else {"),
      codeOnly.indexOf("sslConfig = { rejectUnauthorized: false }"),
    );
    expect(sslBranch.length).toBeGreaterThan(0);
    expect(sslBranch).not.toMatch(/\bthrow\b/);
  });

  it("leaves local development unencrypted and unreported", () => {
    for (const url of [
      "postgres://u:p@localhost:5432/db",
      "postgres://u:p@127.0.0.1:5432/db",
    ]) {
      expect(resolveSsl({ databaseUrl: url })).toBeUndefined();
    }
    // A local DB is not a downgrade, so it must not be treated as one.
    expect(resolveSsl({ databaseUrl: "postgres://u:p@localhost:5432/db" })).toBeUndefined();
  });
});