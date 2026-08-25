import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

// We strictly target parent content tables. 
// We do NOT include 'Comment' or 'Reply' in this list.
const CONTENT_TABLES = [
    'Article', 'SocialPost', 'HelpPost', 'Contribution',
    'Publication', 'ResearchTool', 'ResearchGrant', 'Course',
    'Journal', 'Result', 'ResearchSurvey', 'ResearchEvent',
    'PhdAdmission', 'JobVacancy', 'Recommendation'
]

export async function GET() {
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