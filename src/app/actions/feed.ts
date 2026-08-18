'use server'

import prisma from '@/lib/db'
import { requireCurrentUser, isAuthorizedOrAdmin } from '@/lib/auth'
import { readFormValue } from '@/lib/form'

import { notifyFollowersOfActivity, notifyMentionedUsers } from '@/lib/notifications'
import { deleteFromCloudinary } from '@/app/actions/cloudinary'
import { countVotesForTarget, reverseReputationForContent, reverseContentCommentVoteReputation } from '@/app/actions/interactions'

const socialPostInclude = {
    author: {
        select: {
            id: true,
            name: true,
            handle: true,
            avatarUrl: true,
        },
    },
    votes: {
        select: { id: true, createdAt: true, userId: true, voteType: true, socialPostId: true },
    },
    _count: {
        select: { comments: true, votes: true },
    },
};

export async function getFeed(userId?: string, tab?: string, q?: string, limit = 20, cursor?: string) {
    const isFollowingTab = tab === "following";
    const hasQuery = Boolean(q && q.trim().length > 0);
    let followingIds: string[] = [];

    if (isFollowingTab && userId) {
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
            ...socialPostInclude,
            author: {
                ...socialPostInclude.author,
                select: {
                    ...socialPostInclude.author.select,
                    followers: userId ? { where: { followerId: userId }, select: { followerId: true } } : false,
                }
            }
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
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
                    followers: userId ? { where: { followerId: userId }, select: { followerId: true } } : false,
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
                            handle: true,
                            avatarUrl: true,
                        },
                    },
                    votes: { select: { userId: true, voteType: true } },
                    mentions: true,
                    replies: {
                        select: {
                            id: true,
                            content: true,
                            createdAt: true,
                            updatedAt: true,
                            parentId: true,
                            author: {
                                select: { id: true, name: true, handle: true, avatarUrl: true },
                            },
                            votes: { select: { userId: true, voteType: true } },
                            mentions: true,
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

    if (!content) {
        throw new Error('Content cannot be empty.')
    }

    const post = await prisma.socialPost.create({
        data: {
            content,
            imageUrl: imageUrl || undefined,
            authorId: user.id,
        },
        include: socialPostInclude,
    })

    await Promise.all([
        notifyFollowersOfActivity({
            actorId: user.id,
            type: 'post-published',
            targetType: 'post',
            targetId: post.id,
            title: `${user.user_metadata?.name || user.email?.split('@')[0] || 'Someone'} posted an update`,
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

    return { success: true, data: post }
}

export async function updateSocialPost(
    formData: FormData,
    postId: string
) {
    const user = await requireCurrentUser('Log in to edit this post.')

    const content = readFormValue(formData, 'content')
    if (!content) return { success: false, message: 'Content cannot be empty.' }

    const imageUrl = formData.get('imageUrl') as string | null;

    const post = await prisma.socialPost.findUnique({
        where: { id: postId },
        select: { authorId: true, imageUrl: true },
    })

    if (!post) return { success: false, message: 'Post not found.' }
    if (!await isAuthorizedOrAdmin(post.authorId, user.id)) {
        throw new Error('Not authorized to edit this post.')
    }

    // Persist the edit first so the DB is the source of truth. Then delete the
    // old image from Cloudinary only after the update has succeeded — so if the
    // user changes their mind before saving, the original image is preserved,
    // and if the update fails, the old image is never deleted.
    const oldImage = post.imageUrl;
    const newImage = imageUrl || null;

    const updatedPost = await prisma.socialPost.update({
        where: { id: postId },
        data: { content, imageUrl: newImage || undefined },
        include: {
            ...socialPostInclude,
            author: {
                ...socialPostInclude.author,
                select: {
                    ...socialPostInclude.author.select,
                    followers: { where: { followerId: user.id }, select: { followerId: true } },
                },
            },
        },
    })

    if (oldImage && oldImage !== newImage) {
        await deleteFromCloudinary(oldImage);
    }

    // Client cache updated via React Query - no revalidatePath needed
    return { success: true, data: updatedPost }
}


export async function getPostEditData(id: string) {
    const user = await requireCurrentUser('Log in to edit this post.');

    const post = await prisma.socialPost.findUnique({
        where: { id },
        select: {
            content: true,
            imageUrl: true,
            authorId: true,
        },
    });

    if (!post) {
        throw new Error('Post not found');
    }

    if (post.authorId !== user.id) {
        throw new Error('You are not authorized to edit this post.');
    }

    return {
        content: post.content,
        imageUrl: post.imageUrl,
    };
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
    await reverseReputationForContent(post.authorId, voteCounts);
    await reverseContentCommentVoteReputation('post', postId);

    // Delete associated image from Cloudinary
    if (post.imageUrl) {
        await deleteFromCloudinary(post.imageUrl);
    }

    await prisma.socialPost.delete({ where: { id: postId } })

    // Client cache updated via React Query - no revalidatePath/redirect needed
    return { success: true, data: { id: postId } }
}
