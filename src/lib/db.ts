import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import type { ConnectionOptions } from "node:tls";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

function getDatabaseCACert(): string | undefined {
  if (process.env.SUPABASE_CA_CERT_BASE64) {
    try {
      return Buffer.from(
        process.env.SUPABASE_CA_CERT_BASE64.trim(),
        "base64"
      ).toString("utf-8");
    } catch {
      console.error("[Database SSL] Failed to decode SUPABASE_CA_CERT_BASE64");
    }
  }

  if (process.env.SUPABASE_CA_CERT) {
    return process.env.SUPABASE_CA_CERT.replace(/\\n/g, "\n");
  }

  return undefined;
}

const getPool = () => {
  if (!globalForPrisma.pgPool) {
    const caCert = getDatabaseCACert();
    const isLocalDb =
      process.env.DATABASE_URL?.includes("localhost") ||
      process.env.DATABASE_URL?.includes("127.0.0.1");

    let sslConfig: boolean | ConnectionOptions | undefined = undefined;

    if (!isLocalDb) {
      if (caCert) {
        sslConfig = { rejectUnauthorized: true, ca: caCert };
      } else {
        // No CA configured, so certificate verification would have to be
        // disabled to connect at all — an on-path attacker could read or
        // tamper with every query.
        //
        // PRODUCTION FAILS CLOSED. This used to log and continue
        // (rejectUnauthorized: false), which left a misconfigured deployment
        // silently downgraded forever. The guard below makes that impossible:
        // the pool is built at module import, so a missing CA stops the
        // serverless function at cold start instead of querying in the clear.
        //
        // The two escape hatches are deliberate:
        //  - NEXT_PHASE=phase-production-build: `next build` runs with
        //    NODE_ENV=production but must not require runtime secrets, or a
        //    docs-only change could not be built in CI.
        //  - non-production (dev/test): loud warning + degraded SSL keeps
        //    local development working; the log is an error, not a warn, so
        //    it cannot scroll past unnoticed.
        if (
          process.env.NODE_ENV === "production" &&
          process.env.NEXT_PHASE !== "phase-production-build"
        ) {
          throw new Error(
            "[Database SSL] Missing SUPABASE_CA_CERT_BASE64 (or SUPABASE_CA_CERT): " +
              "refusing to start in production with TLS certificate verification " +
              "disabled. Set SUPABASE_CA_CERT_BASE64 to the base64-encoded Supabase " +
              "CA certificate.",
          );
        }
        console.error(
          "[Database SSL] REFUSING TO VERIFY: no SUPABASE_CA_CERT_BASE64 or " +
            "SUPABASE_CA_CERT found, so TLS certificate verification is " +
            "DISABLED for this database connection. Set SUPABASE_CA_CERT_BASE64 " +
            "in the environment to restore verification.",
        );
        sslConfig = { rejectUnauthorized: false };
      }
    }

    globalForPrisma.pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // 1 connection per serverless lambda in production prevents Supavisor exhaustion
      max: process.env.NODE_ENV === "production" ? 1 : 2,
      idleTimeoutMillis: 15000,
      connectionTimeoutMillis: 10000,
      allowExitOnIdle: true,
      ssl: sslConfig,
    });

    globalForPrisma.pgPool.on("error", (err) => {
      console.error("[pgPool] Unexpected idle client error:", err);
    });
  }

  return globalForPrisma.pgPool;
};

const createPrismaClient = () => {
  const pool = getPool();
  const adapter = new PrismaPg(pool);

  // Only log verbose queries if explicitly requested via environment variable
  const shouldLogQueries = process.env.PRISMA_LOG_QUERIES === "true";

  return new PrismaClient({
    adapter,
    log: shouldLogQueries ? ["query", "error", "warn"] : ["error", "warn"],
  });
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Maintain client singleton across warm lambda executions in all environments
globalForPrisma.prisma = prisma;

export default prisma;