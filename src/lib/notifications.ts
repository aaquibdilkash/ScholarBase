import prisma from '@/lib/db'
import { normalizeHandle } from '@/lib/form'

export type NotificationTargetType = 'article' | 'post' | 'comment' | 'follow' | 'support' | 'vacancy' | 'admission' | 'event' | 'recommendation'

export async function createNotification({
    recipientId,
    actorId,
    type,
    targetType,
    targetId,
    title,
    body,
}: {
    recipientId: string
    actorId: string
    type: string
    targetType?: NotificationTargetType
    targetId?: string
    title: string
    body: string
}) {
    if (recipientId === actorId) {
        return
    }

    await prisma.notification.create({
        data: {
            recipientId,
            actorId,
            type,
            targetType,
            targetId,
            title,
            body,
        },
    })
}

export async function notifyFollowersOfActivity({
    actorId,
    type,
    targetType,
    targetId,
    title,
    body,
}: {
    actorId: string
    type: string
    targetType: NotificationTargetType
    targetId: string
    title: string
    body: string
}) {
    const followers = await prisma.follows.findMany({
        where: { followingId: actorId },
        select: { followerId: true },
    })

    await Promise.all(
        followers.map((follower) =>
            createNotification({
                recipientId: follower.followerId,
                actorId,
                type,
                targetType,
                targetId,
                title,
                body,
            }),
        ),
    )
}

export async function notifyMentionedUsers({
    actorId,
    content,
    type,
    targetType,
    targetId,
    titleFactory,
    bodyFactory,
}: {
    actorId: string
    content: string
    type: string
    targetType: NotificationTargetType
    targetId: string
    titleFactory: (handle: string) => string
    bodyFactory: (handle: string) => string
}) {
    const handles = Array.from(
        new Set(
            Array.from(content.matchAll(/@([a-zA-Z0-9._-]+)/g), (match) =>
                normalizeHandle(match[1]),
            ).filter((handle): handle is string => Boolean(handle)),
        ),
    )

    if (handles.length === 0) {
        return
    }

    const users = await prisma.user.findMany({
        where: { handle: { in: handles } },
        select: { id: true, handle: true },
    })

    await Promise.all(
        users.map((mentioned) =>
            createNotification({
                recipientId: mentioned.id,
                actorId,
                type,
                targetType,
                targetId,
                title: titleFactory(mentioned.handle || 'someone'),
                body: bodyFactory(mentioned.handle || 'someone'),
            }),
        ),
    )
}

export async function notifyUserById({
    recipientId,
    actorId,
    type,
    targetType,
    targetId,
    title,
    body,
}: {
    recipientId: string
    actorId: string
    type: string
    targetType: NotificationTargetType
    targetId: string
    title: string
    body: string
}) {
    await createNotification({
        recipientId,
        actorId,
        type,
        targetType,
        targetId,
        title,
        body,
    })
}
