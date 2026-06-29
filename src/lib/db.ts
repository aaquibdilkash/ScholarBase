import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const prismaClientSingleton = () => {
    // 1. Create a standard Postgres connection pool using your environment URL
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    })

    // 2. Wrap the pool in the Prisma Adapter
    const adapter = new PrismaPg(pool)

    // 3. Initialize the client with the adapter
    return new PrismaClient({ adapter })
}

declare const globalThis: {
    prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma