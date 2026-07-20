'use server'

import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { notifyUserById } from '@/lib/notifications'

export async function toggleFollow(followingId: string): Promise<boolean | undefined> {
  const user = await requireCurrentUser('Log in to follow this scholar and track their research.')

  // Guard against incorrect invocation (e.g. undefined passed from UI)
  if (!followingId) return

  const existing = await prisma.follows.findUnique({
    where: {
      followerId_followingId: {
        followerId: user.id,
        followingId: followingId,
      },
    },
  })

  if (existing) {
    await prisma.follows.delete({
      where: { followerId_followingId: { followerId: user.id, followingId } },
    })
  } else {
    await prisma.follows.create({
      data: { followerId: user.id, followingId },
    })

    await notifyUserById({
      recipientId: followingId,
      actorId: user.id,
      type: 'follow',
      targetType: 'follow',
      targetId: followingId,
      title: `${user.email?.split('@')[0] || 'Someone'} started following you`,
      body: 'Someone you follow is now connected with you.',
    })
  }

  // Return the new state so the client can render the correct label.
  const updated = await prisma.follows.findUnique({
    where: {
      followerId_followingId: {
        followerId: user.id,
        followingId: followingId,
      },
    },
    select: { followerId: true },
  })

  revalidatePath(`/scholar/${followingId}`)
  revalidatePath('/feed')

  return updated ? true : false
}

