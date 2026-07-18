'use server'

import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { normalizeHandle, readOptionalFormValue } from '@/lib/form'
import { revalidatePath } from 'next/cache'

export async function getProfile(profileId: string, currentUserId?: string) {
    return prisma.user.findUnique({
        where: { id: profileId },
        select: {
            id: true,
            name: true,
            handle: true,
            avatarUrl: true,
            bio: true,
            followers: currentUserId ? { where: { followerId: currentUserId }, select: { followerId: true } } : { take: 0, select: { followerId: true } },
            articles: {
                select: {
                    id: true,
                    slug: true,
                    title: true,
                    excerpt: true,
                },
            },
            socialPosts: {
                select: {
                    id: true,
                    content: true,
                },
            },
            vacancies: {
                select: {
                    id: true,
                    title: true,
                    institution: true,
                },
            },
            admissions: {
                select: {
                    id: true,
                    university: true,
                    department: true,
                },
            },
            events: {
                select: {
                    id: true,
                    title: true,
                    location: true,
                    date: true,
                },
            },
            _count: {
                select: {
                    followers: true,
                },
            },
        },
    });
}

export async function updateProfile(formData: FormData) {
    const user = await requireCurrentUser('Log in to update your profile.')

    const name = readOptionalFormValue(formData, 'name')
    const handleInput = readOptionalFormValue(formData, 'handle')
    const bio = readOptionalFormValue(formData, 'bio')
    const avatarUrl = readOptionalFormValue(formData, 'avatarUrl')
    const cleanHandle = normalizeHandle(handleInput)

    if (cleanHandle) {
        const existingUser = await prisma.user.findUnique({
            where: { handle: cleanHandle },
        })

        if (existingUser && existingUser.id !== user.id) {
            return { error: 'This handle is already taken. Please choose another.' }
        }
    }

    await prisma.user.update({
        where: { id: user.id },
        data: {
            name,
            handle: cleanHandle,
            bio,
            avatarUrl
        },
    })

    revalidatePath(`/scholar/${user.id}`)

    return { success: true, userId: user.id }
}