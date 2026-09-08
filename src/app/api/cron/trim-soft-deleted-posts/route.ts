import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyCronSecret } from '@/lib/cron'
import { CONTENT_TABLES } from '@/lib/module-registry'

export async function GET() {
    if (!(await verifyCronSecret())) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    try {
        let totalDeleted = 0;

        await prisma.$transaction(async (tx) => {
            for (const table of CONTENT_TABLES) {
                // Deletes rows where isDeleted is true AND the deletion happened 30+ days ago.
                // PostgreSQL will automatically destroy all child comments attached to these IDs.
                const deletedRows = await tx.$executeRawUnsafe(`
          DELETE FROM "${table}"
          WHERE "isDeleted" = true 
            AND "updatedAt" < NOW() - INTERVAL '30 days';
        `);

                totalDeleted += deletedRows;
            }
        });

        return NextResponse.json({
            success: true,
            message: `Trash emptied successfully. Hard-deleted ${totalDeleted} expired posts.`
        })
    } catch (error) {
        console.error('Error emptying trash:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to empty trash.' },
            { status: 500 }
        )
    }
}
