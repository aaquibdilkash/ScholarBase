'use server'

import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { normalizeHandle, readOptionalFormValue } from '@/lib/form'
import { revalidatePath } from 'next/cache'

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