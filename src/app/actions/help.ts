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
