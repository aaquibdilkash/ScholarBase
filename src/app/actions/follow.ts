'use server'

import prisma from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { notifyUserById } from '@/lib/notifications'

export async function toggleFollow(followingId: string): Promise<boolean | { error: string }> {
  const user = await getCurrentUser()

  if (!user) {
    return { error: "UNAUTHORIZED" }
  }

  // Guard against incorrect invocation (e.g. undefined passed from UI)
  if (!followingId) return false

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

export async function getFollowers(userId: string, currentUserId?: string) {
  const follows = await prisma.follows.findMany({
    where: { followingId: userId },
    select: {
      follower: {
        select: {
          id: true,
          name: true,
          handle: true,
          avatarUrl: true,
          followers: currentUserId
            ? { where: { followerId: currentUserId }, select: { followerId: true } }
            : false,
        },
      },
    },
    orderBy: { follower: { name: 'asc' } },
  })
  return follows.map((f) => ({
    ...f.follower,
    isFollowing: currentUserId ? (f.follower as any).followers?.length > 0 : false,
  }))
}

export async function getFollowing(userId: string, currentUserId?: string) {
  const follows = await prisma.follows.findMany({
    where: { followerId: userId },
    select: {
      following: {
        select: {
          id: true,
          name: true,
          handle: true,
          avatarUrl: true,
          followers: currentUserId
            ? { where: { followerId: currentUserId }, select: { followerId: true } }
            : false,
        },
      },
    },
    orderBy: { following: { name: 'asc' } },
  })
  return follows.map((f) => ({
    ...f.following,
    isFollowing: currentUserId ? (f.following as any).followers?.length > 0 : false,
  }))
}

