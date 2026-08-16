import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'

const globalForPrisma = globalThis as typeof globalThis & {
    prisma?: PrismaClient
    pgPool?: Pool
}

const getPool = () => {
    if (!globalForPrisma.pgPool) {
        globalForPrisma.pgPool = new Pool({
            connectionString: process.env.DATABASE_URL,
        })
    }

    return globalForPrisma.pgPool
}

const createPrismaClient = () => new PrismaClient({ adapter: new PrismaPg(getPool()) })

const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma
}

export default prisma
