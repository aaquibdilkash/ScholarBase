'use server'

import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { readFormValue, readOptionalFormValue } from '@/lib/form'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createJournal(formData: FormData) {
    const user = await requireCurrentUser('Please log in to submit details.')

    const title = readFormValue(formData, 'title')
    const issn = readOptionalFormValue(formData, 'issn')
    const impactFactor = readOptionalFormValue(formData, 'impactFactor')
    const scopus = readOptionalFormValue(formData, 'scopus')
    const abdcCategory = readOptionalFormValue(formData, 'abdcCategory')
    const publisher = readOptionalFormValue(formData, 'publisher')
    const website = readOptionalFormValue(formData, 'website')
    const about = readOptionalFormValue(formData, 'about')

    await prisma.journal.create({
        data: {
            title,
            issn,
            impactFactor: impactFactor ? parseFloat(impactFactor) : null,
            scopus,
            abdcCategory,
            publisher,
            website,
            about,
            authorId: user.id
        },
    })

    revalidatePath('/journals')
    redirect('/journals')
}

export async function getJournals(userId?: string) {
    return prisma.journal.findMany({
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
            likes: userId ? { where: { userId } } : false,
        },
    });
}

export async function getJournalById(journalId: string, userId?: string) {
    return prisma.journal.findUniqueOrThrow({
        where: {
            id: journalId,
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
            likes: userId ? { where: { userId } } : false,


            _count: {
                select: {
                    likes: true,
                    comments: true,
                },
            },
        },
    });
}
