'use server'

import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'

export async function markNotificationRead(notificationId: string) {
    const user = await requireCurrentUser('Log in to view your notifications.')

    await prisma.notification.updateMany({
        where: { id: notificationId, recipientId: user.id },
        data: { readAt: new Date() },
    })

}

export async function markAllNotificationsRead() {
    const user = await requireCurrentUser('Log in to view your notifications.')

    await prisma.notification.updateMany({
        where: { recipientId: user.id, readAt: null },
        data: { readAt: new Date() },
    })

}
