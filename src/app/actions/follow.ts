'use server'

import prisma from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { notifyUserById } from '@/lib/notifications'
import { handleFollowTransaction } from '@/lib/transactions'

export async function toggleFollow(followingId: string): Promise<{ success: boolean, error?: string }> {
  const authUser = await getCurrentUser()

  if (!authUser) {
    return { success: false, error: "UNAUTHORIZED" }
  }

  if (!followingId || authUser.id === followingId) {
    return { success: false, error: "Invalid user to follow" }
  }

  try {
    const { wasFollowing } = await handleFollowTransaction(authUser.id, followingId);

    // Fire-and-forget notification only on a new follow action
    if (!wasFollowing) {
      const follower = await prisma.user.findUnique({
          where: { id: authUser.id },
          select: { name: true }
      });
      notifyUserById({
        recipientId: followingId,
        actorId: authUser.id,
        type: 'follow',
        targetType: 'user',
        targetId: authUser.id,
        title: `${follower?.name || 'Someone'} started following you`,
        body: `You have a new follower: ${follower?.name || 'a new user'}.`,
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error in toggleFollow:', error);
    return { success: false, error: "Something went wrong" }
  }
}

export async function getFollowers(userId: string, currentUserId?: string, take: number = 50) {
  const follows = await prisma.follows.findMany({
    where: { followingId: userId },
    take,
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
    orderBy: { createdAt: 'desc' },
  });

  return follows.map((f) => {
      const { followers, ...follower } = f.follower;
      return {
          ...follower,
          isFollowing: !!followers?.length,
          isOwnProfile: currentUserId === follower.id,
      };
  });
}

export async function getFollowing(userId: string, currentUserId?: string, take: number = 50) {
  const follows = await prisma.follows.findMany({
    where: { followerId: userId },
    take,
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
    orderBy: { createdAt: 'desc' },
  });
  
  return follows.map((f) => {
      const { followers, ...following } = f.following;
      return {
          ...following,
          isFollowing: !!followers?.length,
          isOwnProfile: currentUserId === following.id,
      }
  });
}
