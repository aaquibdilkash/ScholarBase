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
    
    // Internal Docker network hostnames and loopback targets communicate inside 
    // the isolated bridge network and do not require external TLS validation.
    const isInternalDb =
      process.env.DATABASE_URL?.includes("localhost") ||
      process.env.DATABASE_URL?.includes("127.0.0.1") ||
      process.env.DATABASE_URL?.includes("supabase-supavisor") ||
      process.env.DATABASE_URL?.includes("supabase-db") ||
      process.env.DATABASE_URL?.includes(".internal");

    let sslConfig: boolean | ConnectionOptions | undefined = undefined;

    if (!isInternalDb) {
      if (caCert) {
        sslConfig = { rejectUnauthorized: true, ca: caCert };
      } else {
        // Enforce strict TLS certificate verification when connecting to external/remote databases
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
      // Uses application pool limit or defaults to 10
      max: Number(process.env.DB_POOL_MAX ?? 10),
      idleTimeoutMillis: 15000,
      connectionTimeoutMillis: 10000,
      allowExitOnIdle: true,
      ssl: sslConfig, // Stays undefined for internal Docker traffic
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