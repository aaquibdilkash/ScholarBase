'use server'

import prisma from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { notifyUserById } from '@/lib/notifications'
import { handleFollowTransaction } from '@/lib/transactions'

export async function toggleFollow(followingId: string): Promise<{ success: boolean; isFollowing: boolean; error?: string }> {
  const authUser = await getCurrentUser()

  if (!authUser) {
    return { success: false, isFollowing: false, error: "UNAUTHORIZED" }
  }

  if (!followingId || authUser.id === followingId) {
    return { success: false, isFollowing: false, error: "Invalid user to follow" }
  }

  try {
    const { wasFollowing } = await handleFollowTransaction(authUser.id, followingId);

    const isNowFollowing = !wasFollowing;

    if (!isNowFollowing) {
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

    return { success: true, isFollowing: isNowFollowing };
  } catch (error) {
    console.error('Error in toggleFollow:', error);
    return { success: false, isFollowing: false, error: "Something went wrong" }
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

export async function getFollowersWithCursor(
  userId: string,
  currentUserId?: string,
  take: number = 20,
  cursor?: string
) {
  const follows = await prisma.follows.findMany({
    where: { 
      followingId: userId,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
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
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const hasMore = follows.length === take;
  const nextCursor = hasMore ? follows[follows.length - 1].createdAt.toISOString() : null;

  return {
    users: follows.map((f) => {
      const { followers, ...follower } = f.follower;
      return {
        ...follower,
        isFollowing: !!followers?.length,
        isOwnProfile: currentUserId === follower.id,
      };
    }),
    nextCursor,
    hasMore,
  };
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

export async function getFollowingWithCursor(
  userId: string,
  currentUserId?: string,
  take: number = 20,
  cursor?: string
) {
  const follows = await prisma.follows.findMany({
    where: { 
      followerId: userId,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
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
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const hasMore = follows.length === take;
  const nextCursor = hasMore ? follows[follows.length - 1].createdAt.toISOString() : null;

  return {
    users: follows.map((f) => {
      const { followers, ...following } = f.following;
      return {
        ...following,
        isFollowing: !!followers?.length,
        isOwnProfile: currentUserId === following.id,
      };
    }),
    nextCursor,
    hasMore,
  };
}
