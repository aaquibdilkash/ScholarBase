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
        // No CA configured, so certificate verification has to be disabled to
        // connect at all. That is a real downgrade — an on-path attacker could
        // read or tamper with every query — so it is LOUD rather than silent.
        //
        // P1-5 originally specified "throw at startup". That was rejected: `prisma`
        // is constructed at module import (below), so throwing here would fail
        // `next build` and every cold serverless start on a misconfigured env,
        // converting a hardening measure into an outage.
        //
        // It is also NOT a live vulnerability today: production sets
        // SUPABASE_CA_CERT_BASE64, so the branch above is taken and verification
        // is on. This only fires if that variable is missing or undecodable, and
        // the log exists so that shows up in monitoring instead of passing
        // unnoticed.
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