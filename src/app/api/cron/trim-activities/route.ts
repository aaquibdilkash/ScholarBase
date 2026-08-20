import 'server-only';
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyCronSecret } from '@/lib/cron';

export const revalidate = 0;

export async function GET() {
  if (!(await verifyCronSecret())) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    await prisma.$executeRawUnsafe(`
      DELETE FROM "UserActivity"
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER(PARTITION BY "userId" ORDER BY "createdAt" DESC) as row_num
          FROM "UserActivity"
        ) ranked
        WHERE ranked.row_num > 10
      );
    `);

    return NextResponse.json({ success: true, message: 'User activities trimmed.' });
  } catch (error) {
    console.error('Activity Trim Error:', error);
    return NextResponse.json({ success: false, error: 'Execution failed.' }, { status: 500 });
  }
}