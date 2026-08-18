'use server'

import prisma from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { notifyUserById } from '@/lib/notifications'

export async function toggleFollow(followingId: string): Promise<{ success: boolean, data?: { newFollowState: boolean }, error?: string }> {
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: "UNAUTHORIZED" }
  }

  if (!followingId) {
    return { success: false, error: "No user to follow" }
  }

  if (user.id === followingId) {
    return { success: false, error: "You cannot follow yourself" }
  }

  const existing = await prisma.follows.findUnique({
    where: {
      followerId_followingId: {
        followerId: user.id,
        followingId: followingId,
      },
    },
  })

  try {
    if (existing) {
      await prisma.follows.delete({
        where: { followerId_followingId: { followerId: user.id, followingId } },
      })
      return { success: true, data: { newFollowState: false } }
    } else {
      await prisma.follows.create({
        data: { followerId: user.id, followingId },
      })

      const isMutualConnection = await prisma.follows.findUnique({
        where: {
          followerId_followingId: {
            followerId: followingId,
            followingId: user.id,
          },
        },
        select: { followerId: true },
      })

      await notifyUserById({
        recipientId: followingId,
        actorId: user.id,
        type: 'follow',
        targetType: 'follow',
        targetId: followingId,
        title: `${user.email?.split('@')[0] || 'Someone'} started following you`,
        body: isMutualConnection
          ? 'Someone you follow is now connected with you.'
          : 'Someone started following you.',
      })
      return { success: true, data: { newFollowState: true } }
    }
  } catch (error) {
    console.error(error)
    return { success: false, error: "Something went wrong" }
  }
}


import type { FollowerInfo } from '@/types/follow';



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
  return follows.map((f) => {
    const follower = f.follower as FollowerInfo
    return {
    ...follower,
    isFollowing: !!(currentUserId && follower.followers?.length),
    }
  })
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
  return follows.map((f) => {
    const following = f.following as FollowerInfo
    return {
    ...following,
    isFollowing: !!(currentUserId && following.followers?.length),
    }
  })
}
