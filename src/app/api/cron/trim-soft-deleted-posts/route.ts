import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyCronSecret } from '@/lib/cron'
import { CONTENT_TABLES } from '@/lib/module-registry'
import {
  deleteAllNotificationsForContent,
} from '@/lib/notifications'
import type { ModuleKey } from '@/lib/transactions'

/** Map the CronContentTable names (PascalCase) to ENTITY_CONFIG module keys. */
const TABLE_TO_MODULE: Record<string, ModuleKey> = {
  Article: 'ARTICLE',
  SocialPost: 'SOCIAL_POST',
  HelpPost: 'HELP_POST',
  Contribution: 'CONTRIBUTION',
  Publication: 'PUBLICATION',
  ResearchTool: 'RESEARCH_TOOL',
  ResearchGrant: 'RESEARCH_GRANT',
  Course: 'COURSE',
  Journal: 'JOURNAL',
  Result: 'RESULT',
  ResearchSurvey: 'RESEARCH_SURVEY',
  CallForPaper: 'CALL_FOR_PAPER',
  Admission: 'ADMISSION',
  AcademicPosition: 'ACADEMIC_POSITION',
  Recommendation: 'RECOMMENDATION',
  JournalReview: 'JOURNAL_REVIEW',
}

export async function GET() {
  if (!(await verifyCronSecret())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    let totalDeleted = 0;
    let totalNotificationsDeleted = 0;

    await prisma.$transaction(async (tx) => {
      for (const table of CONTENT_TABLES) {
        // Capture the ids of rows about to be hard-deleted so we can purge their
        // notifications first. Raw SQL bypasses Prisma hooks, so we must do this
        // explicitly — comments and their `::comment::` notification ids included.
        const rowsToDelete = await tx.$queryRawUnsafe<{ id: string }[]>(`
          SELECT "id" FROM "${table}"
          WHERE "isDeleted" = true
            AND "updatedAt" < NOW() - INTERVAL '30 days';
        `);

        const moduleKey = TABLE_TO_MODULE[table];
        for (const row of rowsToDelete) {
          await deleteAllNotificationsForContent(tx, moduleKey!, row.id);
          totalNotificationsDeleted += 1;
        }

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
      message: `Trash emptied successfully. Hard-deleted ${totalDeleted} expired posts, purged ${totalNotificationsDeleted} notification rows.`
    })
  } catch (error) {
    console.error('Error emptying trash:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to empty trash.' },
      { status: 500 }
    )
  }
}
