'use server'

import prisma from '@/lib/db'
import { requireCurrentUser, isAuthorizedOrAdmin } from '@/lib/auth'
import { readFormValue } from '@/lib/form'
import { revalidatePath } from 'next/cache'
import { redirect } from "next/navigation";
import { notifyFollowersOfActivity, notifyMentionedUsers } from '@/lib/notifications'
import { deleteFromCloudinary } from '@/app/actions/cloudinary'
import { countVotesForTarget, countCommentsForTarget, reverseReputationForContent } from '@/app/actions/interactions'

export async function getFeed(userId?: string, tab?: string, q?: string) {
    const isFollowingTab = tab === "following";
    const hasQuery = Boolean(q && q.trim().length > 0);
    let followingIds: string[] = [];

    if (isFollowingTab) {
        const following = await prisma.follows.findMany({
            where: { followerId: userId },
            select: { followingId: true },
        });
        followingIds = following.map((f) => f.followingId);
    }

    const posts = await prisma.socialPost.findMany({
        where: {
            ...(isFollowingTab ? { authorId: { in: followingIds } } : {}),
            ...(hasQuery
                ? {
                    OR: [
                        {
                            content: {
                                contains: q,
                                mode: "insensitive",
                            },
                        },
                        {
                            author: {
                                name: {
                                    contains: q,
                                    mode: "insensitive",
                                },
                            },
                        },
                        {
                            author: {
                                handle: {
                                    contains: q,
                                    mode: "insensitive",
                                },
                            },
                        },
                    ],
                }
                : {}),
        },
        include: {
            author: {
                include: {
                    followers: userId
                        ? {
                            where: { followerId: userId },
                            select: { followerId: true },
                        }
                        : false,
                },
            },
            votes: {
                select: { id: true, userId: true, voteType: true, socialPostId: true },
            },
            _count: {
                select: { comments: true, votes: true },
            },
        },
        orderBy: { createdAt: "desc" },
    });

    return posts;
}

export async function getPost(id: string, userId?: string) {
    return prisma.socialPost.findUnique({
        where: { id },
        select: {
            id: true,
            content: true,
            imageUrl: true,
            createdAt: true,
            updatedAt: true,
            authorId: true,
            author: {
                select: {
                    id: true,
                    name: true,
                    handle: true,
                    avatarUrl: true,
                    followers: userId
                        ? {
                            where: { followerId: userId },
                            select: { followerId: true },
                        }
                        : false,
                },
            },
            votes: { select: { userId: true, voteType: true } },
            comments: {
                where: { parentId: null },
                select: {
                    id: true,
                    content: true,
                    createdAt: true,
                    updatedAt: true,
                    parentId: true,
                    author: {
                        select: {
                            id: true,
                            name: true,
                            avatarUrl: true,
                        },
                    },
                    votes: { select: { userId: true, voteType: true } },
                    replies: {
                        select: {
                            id: true,
                            content: true,
                            createdAt: true,
                            updatedAt: true,
                            parentId: true,
                            author: {
                                select: { id: true, name: true, avatarUrl: true },
                            },
                            votes: { select: { userId: true, voteType: true } },
                            _count: { select: { votes: true } },
                        },
                        orderBy: { createdAt: "asc" },
                    },
                    _count: { select: { votes: true } },
                },
                orderBy: { createdAt: "asc" },
            },
            _count: {
                select: { votes: true, comments: true },
            },
        },
    });
}

export async function createSocialPost(formData: FormData) {
    const user = await requireCurrentUser('You must be logged in to post.')

    const content = readFormValue(formData, 'content')
    const imageUrl = formData.get('imageUrl') as string | null;

    if (!content) return

    const post = await prisma.socialPost.create({
        data: {
            content,
            imageUrl: imageUrl || undefined,
            authorId: user.id,
        },
    })

    await Promise.all([
        notifyFollowersOfActivity({
            actorId: user.id,
            type: 'post-published',
            targetType: 'post',
            targetId: post.id,
            title: `${user.email?.split('@')[0] || 'Someone'} posted an update`,
            body: content.slice(0, 120),
        }),
        notifyMentionedUsers({
            actorId: user.id,
            content,
            type: 'mention',
            targetType: 'post',
            targetId: post.id,
            titleFactory: (handle) => `@${handle} was mentioned in a post`,
            bodyFactory: () => content.slice(0, 120),
        }),
    ])

    revalidatePath('/feed')
    return { success: true, redirect: '/feed' }
}

export async function updateSocialPost(
    formData: FormData,
    postId: string
) {
    const user = await requireCurrentUser('Log in to edit this post.')

    const content = readFormValue(formData, 'content')
    if (!content) return

    const imageUrl = formData.get('imageUrl') as string | null;

    const post = await prisma.socialPost.findUnique({
        where: { id: postId },
        select: { authorId: true, imageUrl: true },
    })

    if (!post) return
    if (!await isAuthorizedOrAdmin(post.authorId, user.id)) {
        throw new Error('Not authorized to edit this post.')
    }

    // Delete old image from Cloudinary if replaced
    if (post.imageUrl && imageUrl && post.imageUrl !== imageUrl) {
        await deleteFromCloudinary(post.imageUrl);
    }

    await prisma.socialPost.update({
        where: { id: postId },
        data: { content, imageUrl: imageUrl || undefined },
    })

    revalidatePath('/feed')
    revalidatePath(`/feed/${postId}`)
    redirect(`/feed/${postId}`)
}

export async function deleteSocialPost(postId: string) {
    const user = await requireCurrentUser('Log in to delete this post.')

    const post = await prisma.socialPost.findUnique({
        where: { id: postId },
        select: { authorId: true, imageUrl: true },
    })

    if (!post) return
    if (!await isAuthorizedOrAdmin(post.authorId, user.id)) {
        throw new Error('Not authorized to delete this post.')
    }

    // Reverse reputation from votes and comments before deletion
    const voteCounts = await countVotesForTarget(prisma.socialVote, 'socialPostId', postId);
    const commentCount = await countCommentsForTarget(prisma.socialComment, 'socialPostId', postId);
    await reverseReputationForContent(post.authorId, voteCounts, commentCount);

    // Delete associated image from Cloudinary
    if (post.imageUrl) {
        await deleteFromCloudinary(post.imageUrl);
    }

    await prisma.socialPost.delete({ where: { id: postId } })

    revalidatePath('/feed')
    revalidatePath(`/feed/${postId}`)
    redirect('/feed')
}
