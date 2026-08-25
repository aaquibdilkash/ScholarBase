import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function GET() {
  try {
    // We partition by "recipientId" to match your Prisma schema perfectly
    const deletedCount = await prisma.$executeRawUnsafe(`
      DELETE FROM "Notification"
      WHERE id IN (
        SELECT id
        FROM (
          SELECT id, ROW_NUMBER() OVER(PARTITION BY "recipientId" ORDER BY "createdAt" DESC) as rank
          FROM "Notification"
        ) ranked
        WHERE rank > 20
      );
    `)

    return NextResponse.json({ 
      success: true, 
      message: `Trimmed old notifications. Deleted ${deletedCount} rows.` 
    })
  } catch (error) {
    console.error('Error trimming notifications:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to trim notifications.' }, 
      { status: 500 }
    )
  }
}