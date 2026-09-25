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