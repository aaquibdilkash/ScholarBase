import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'

const createPrismaClient = () => {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    })

    return new PrismaClient({ adapter: new PrismaPg(pool) })
}

const globalForPrisma = globalThis as typeof globalThis & {
    prisma?: ReturnType<typeof createPrismaClient>
}

const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma
}

export default prisma