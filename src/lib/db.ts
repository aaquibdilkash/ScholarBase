import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

/**
 * Resolves the Supabase Root CA certificate.
 * Decodes the base64-encoded certificate string configured in Vercel.
 */
function getDatabaseCACert(): string | undefined {
  if (process.env.SUPABASE_CA_CERT_BASE64) {
    try {
      return Buffer.from(
        process.env.SUPABASE_CA_CERT_BASE64.trim(),
        "base64"
      ).toString("utf-8");
    } catch (err) {
      console.error("[Database SSL] Failed to decode SUPABASE_CA_CERT_BASE64:", err);
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

    // SSL Configuration:
    // - Localhost (NODE_ENV !== "production"): undefined (keeps local dev working smoothly)
    // - Vercel Preview / Prod with CA: rejectUnauthorized = true (strict TLS certificate verification)
    // - Fallback: rejectUnauthorized = false if the env variable is somehow omitted
    const sslConfig =
      process.env.NODE_ENV === "production"
        ? caCert
          ? { rejectUnauthorized: true, ca: caCert }
          : { rejectUnauthorized: false }
        : undefined;

    globalForPrisma.pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Cap at 1 connection per serverless execution context
      max: process.env.NODE_ENV === "production" ? 1 : 1,
      // Discard stale idle sockets before Supavisor drops them
      idleTimeoutMillis: 20000,
      // Fail fast within 10s if the database or pooler is unreachable
      connectionTimeoutMillis: 10000,
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
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;