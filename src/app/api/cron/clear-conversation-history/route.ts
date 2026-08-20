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
      DELETE FROM "Message" 
      WHERE "createdAt" < NOW() - INTERVAL '7 days';
    `);

    return NextResponse.json({ success: true, message: 'Conversation history cleared.' });
  } catch (error) {
    console.error('Conversation Cleanup Error:', error);
    return NextResponse.json({ success: false, error: 'Execution failed.' }, { status: 500 });
  }
}