import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

const getPool = () => {
  if (!globalForPrisma.pgPool) {
    globalForPrisma.pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // 1. Cap connections per serverless lambda (1 in prod serverless, up to 5 in local dev)
      max: process.env.NODE_ENV === "production" ? 1 : 5,
      // 2. Terminate idle clients quickly so Supavisor doesn't drop frozen sockets
      idleTimeoutMillis: 20000,
      // 3. Fail fast instead of hanging forever if database compute is overloaded
      connectionTimeoutMillis: 10000,
      // 4. Ensure SSL handshake succeeds across cloud environments
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : undefined,
    });

    // Prevent uncaught idle pool errors from crashing the Node.js process
    globalForPrisma.pgPool.on("error", (err) => {
      console.error("Unexpected error on idle pg client:", err);
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

// Cache on globalThis in all environments to prevent multi-chunk instantiation
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;