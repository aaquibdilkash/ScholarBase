'use server'

import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'

export async function getHelpPosts() {
    return prisma.helpPost.findMany({
        orderBy: {
            createdAt: 'desc',
        },
        include: {
            author: true,
            likes: true,
            comments: true,
        },
    })
}

export async function getHelpPost(id: string, userId: string) {
    if (!id || typeof id !== 'string') {
        throw new Error(`Invalid ID passed to getHelpPost: ${id}`);
    }

    return prisma.helpPost.findUnique({
        where: { id },
        include: {
            author: true,
            likes: { where: { userId } },
            _count: {
                select: { likes: true, comments: true },
            },
            comments: {
                where: { parentId: null },
                include: {
                    author: true,
                    likes: { where: { userId } },
                    _count: { select: { likes: true } },
                    replies: {
                        include: {
                            author: true,
                            likes: { where: { userId } },
                            _count: { select: { likes: true } },
                        },
                        orderBy: { createdAt: "asc" },
                    },
                },
                orderBy: {
                    createdAt: 'desc'
                }
            }
        },
    })
}

export async function createHelpPost(formData: FormData) {
    const user = await requireCurrentUser()
    const title = formData.get('title') as string
    const subject = formData.get('subject') as string
    const category = formData.get('category') as string
    const message = formData.get('message') as string

    if (!title || !subject || !category || !message) {
        throw new Error('Please fill in all fields.')
    }

    await prisma.helpPost.create({
        data: {
            title,
            subject,
            category,
            message,
            authorId: user.id,
        },
    })

    redirect('/help')
}

export async function updateHelpPost(formData: FormData, helpPostId: string) {
    const user = await requireCurrentUser()

    const title = formData.get('title') as string
    const subject = formData.get('subject') as string
    const category = formData.get('category') as string
    const message = formData.get('message') as string

    if (!title || !subject || !category || !message) {
        throw new Error('Please fill in all fields.')
    }

    const post = await prisma.helpPost.findUnique({
        where: { id: helpPostId },
        select: { authorId: true },
    })

    if (!post) return
    if (post.authorId !== user.id) {
        throw new Error('Not authorized to edit this help post.')
    }

    await prisma.helpPost.update({
        where: { id: helpPostId },
        data: { title, subject, category, message },
    })

    redirect(`/help/${helpPostId}`)
}

export async function deleteHelpPost(helpPostId: string) {
    const user = await requireCurrentUser('Log in to delete this help post.')

    const post = await prisma.helpPost.findUnique({
        where: { id: helpPostId },
        select: { authorId: true },
    })

    if (!post) return
    if (post.authorId !== user.id) {
        throw new Error('Not authorized to delete this help post.')
    }

    await prisma.helpPost.delete({ where: { id: helpPostId } })

    redirect('/help')
}

