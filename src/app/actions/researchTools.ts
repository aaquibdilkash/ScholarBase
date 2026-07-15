'use server'

import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { readFormValue, readOptionalFormValue } from '@/lib/form'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createResearchTool(formData: FormData) {
    const user = await requireCurrentUser('Please log in to submit details.')

    const name = readFormValue(formData, 'name')
    const website = readFormValue(formData, 'website')
    const use = readFormValue(formData, 'use')
    const description = readFormValue(formData, 'description')

    await prisma.researchTool.create({
        data: {
            name,
            website,
            use,
            description,
            authorId: user.id
        },
    })

    revalidatePath('/research-tools')
    redirect('/research-tools')
}

export async function getResearchTools(userId?: string) {
    return prisma.researchTool.findMany({
        orderBy: {
            createdAt: 'desc',
        },
        include: {
            author: true,
            _count: {
                select: {
                    likes: true,
                    comments: true,
                },
            },
            likes: {
                where: {
                    userId: userId,
                },
            },
        },
    });
}

export async function getResearchToolById(toolId: string, userId?: string) {
    return prisma.researchTool.findUniqueOrThrow({
        where: {
            id: toolId,
        },
        include: {
            author: true,
            comments: {
                where: { parentId: null },
                include: {
                    author: true,
                    likes: userId ? { where: { userId: userId } } : false,
                    _count: { select: { likes: true } },
                    replies: {
                        include: {
                            author: true,
                            likes: userId ? { where: { userId: userId } } : false,
                            _count: { select: { likes: true } },
                        },
                        orderBy: { createdAt: "asc" },
                    },
                },
                orderBy: { createdAt: "desc" },
            },
            likes: {
                where: {
                    userId: userId,
                },
            },
            _count: {
                select: {
                    likes: true,
                    comments: true,
                },
            },
        },
    });
}
