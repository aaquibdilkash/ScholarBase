'use server'

import { Prisma } from '@prisma/client'
import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { readFormValue } from '@/lib/form'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function getAdmissions(q?: string, userId?: string) {
    const where = q
        ? {
            OR: [
                { university: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { department: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { description: { contains: q, mode: Prisma.QueryMode.insensitive } },
            ],
        }
        : {};

    return prisma.phdAdmission.findMany({
        where,
        orderBy: { createdAt: "desc" },
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
                select: { userId: true, voteType: true },
            },
            _count: {
                select: { votes: true, comments: true },
            },
        },
    });
}

export async function getAdmission(id: string, userId?: string) {
    return prisma.phdAdmission.findUnique({
        where: { id },
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
            comments: {
                where: { parentId: null },
                include: {
                    author: true,
                    votes: userId ? { where: { userId: userId } } : false,
                    _count: { select: { votes: true } },
                    replies: {
                        include: {
                            author: true,
                            votes: userId ? { where: { userId: userId } } : false,
                            _count: { select: { votes: true } },
                        },
                        orderBy: { createdAt: "asc" },
                    },
                },
                orderBy: { createdAt: "desc" },
            },
            votes: {
                select: { userId: true, voteType: true },
            },
            _count: {
                select: { votes: true, comments: true },
            },
        },
    });
}

export async function createPhdAdmission(formData: FormData) {
    const user = await requireCurrentUser('Please log in to submit details.')

    const university = readFormValue(formData, 'university')
    const department = readFormValue(formData, 'department')
    const deadline = new Date(readFormValue(formData, 'deadline'))
    const description = readFormValue(formData, 'description')
    const notificationLink = readFormValue(formData, 'notificationLink')
    const applyLink = readFormValue(formData, 'applyLink')

    if (!notificationLink || !applyLink) {
        throw new Error('Notification and Apply links are required.')
    }

    await prisma.phdAdmission.create({
        data: { university, department, deadline, description, notificationLink, applyLink, authorId: user.id },
    })

    revalidatePath('/admissions')
    redirect('/admissions')
}

export async function updatePhdAdmission(formData: FormData, admissionId: string) {
    const user = await requireCurrentUser('Log in to edit this admission.')

    const university = readFormValue(formData, 'university')
    const department = readFormValue(formData, 'department')
    const deadline = new Date(readFormValue(formData, 'deadline'))
    const description = readFormValue(formData, 'description')
    const notificationLink = readFormValue(formData, 'notificationLink')
    const applyLink = readFormValue(formData, 'applyLink')

    if (!notificationLink || !applyLink) {
        throw new Error('Notification and Apply links are required.')
    }

    const admission = await prisma.phdAdmission.findUnique({
        where: { id: admissionId },
        select: { authorId: true },
    })

    if (!admission) return
    if (admission.authorId !== user.id) {
        throw new Error('Not authorized to edit this admission.')
    }

    await prisma.phdAdmission.update({
        where: { id: admissionId },
        data: { university, department, deadline, description, notificationLink, applyLink },
    })

    revalidatePath('/admissions')
    revalidatePath(`/admissions/${admissionId}`)
    redirect(`/admissions/${admissionId}`);
}

export async function deletePhdAdmission(admissionId: string) {
    const user = await requireCurrentUser('Log in to delete this admission.')

    const admission = await prisma.phdAdmission.findUnique({
        where: { id: admissionId },
        select: { authorId: true },
    })

    if (!admission) return
    if (admission.authorId !== user.id) {
        throw new Error('Not authorized to delete this admission.')
    }

    await prisma.phdAdmission.delete({ where: { id: admissionId } })

    revalidatePath('/admissions')
    revalidatePath(`/admissions/${admissionId}`)
    redirect('/admissions')
}
