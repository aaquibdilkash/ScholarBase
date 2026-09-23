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

    // SSL Configuration:
    // 1. Local Postgres instance (Docker/local server): no SSL (undefined)
    // 2. Production with CA Cert: strict verification ({ rejectUnauthorized: true, ca })
    // 3. Remote connection without local CA (localhost to Supabase): SSL enabled with fallback ({ rejectUnauthorized: false })
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
      max: process.env.NODE_ENV === "production" ? 1 : 2,
      idleTimeoutMillis: 20000,
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