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
        await prisma.$transaction([
            prisma.$executeRawUnsafe(`DELETE FROM "PhdAdmission" WHERE "deadline" < NOW();`),
            prisma.$executeRawUnsafe(`DELETE FROM "JobVacancy" WHERE "deadline" < NOW();`),
            prisma.$executeRawUnsafe(`DELETE FROM "ResearchEvent" WHERE "deadline" < NOW();`)
        ]);

        return NextResponse.json({ success: true, message: 'Deadlines cleaned up.' });
    } catch (error) {
        console.error('Deadline Cleanup Error:', error);
        return NextResponse.json({ success: false, error: 'Execution failed.' }, { status: 500 });
    }
}