import 'server-only';
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyCronSecret } from '@/lib/cron';

export const revalidate = 0;

export async function GET() {
  if (!(await verifyCronSecret())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const results: Record<string, number | string> = {};

  // 1. MESSAGES: Keep only the latest 100 messages per conversation
  try {
    const deletedMessages = await prisma.$executeRawUnsafe(`
      DELETE FROM "Message"
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER(
            PARTITION BY "conversationId" 
            ORDER BY "createdAt" DESC
          ) AS rank
          FROM "Message"
        ) ranked
        WHERE ranked.rank > 100
      );
    `);
    results.messagesDeleted = deletedMessages;
  } catch (error) {
    console.error('[Cron] Failed to trim messages:', error);
    results.messagesDeleted = 'Failed';
  }

  // 2. USER ACTIVITIES: Keep only the latest 20 activities per user
  try {
    const deletedActivities = await prisma.$executeRawUnsafe(`
      DELETE FROM "UserActivity"
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER(
            PARTITION BY "userId" 
            ORDER BY "createdAt" DESC
          ) AS rank
          FROM "UserActivity"
        ) ranked
        WHERE ranked.rank > 20
      );
    `);
    results.activitiesDeleted = deletedActivities;
  } catch (error) {
    console.error('[Cron] Failed to trim user activities:', error);
    results.activitiesDeleted = 'Failed';
  }

  // 3. NOTIFICATIONS: Purge read > 14 days and cap unread at 20 per recipient
  try {
    // Step 3a: Remove stale read notifications
    const deletedReadNotifications = await prisma.$executeRawUnsafe(`
      DELETE FROM "Notification"
      WHERE "readAt" IS NOT NULL 
        AND "createdAt" < NOW() - INTERVAL '14 days';
    `);

    // Step 3b: Keep only the latest 20 unread notifications per user
    const deletedUnreadNotifications = await prisma.$executeRawUnsafe(`
      DELETE FROM "Notification"
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER(
            PARTITION BY "recipientId" 
            ORDER BY "createdAt" DESC
          ) AS rank
          FROM "Notification"
          WHERE "readAt" IS NULL
        ) ranked
        WHERE ranked.rank > 20
      );
    `);

    results.notificationsDeleted = deletedReadNotifications + deletedUnreadNotifications;
  } catch (error) {
    console.error('[Cron] Failed to trim notifications:', error);
    results.notificationsDeleted = 'Failed';
  }

  return NextResponse.json({
    success: true,
    message: 'System maintenance completed.',
    results,
  });
}