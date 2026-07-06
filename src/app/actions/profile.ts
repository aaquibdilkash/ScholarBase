'use server'

import prisma from '@/lib/db'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateProfile(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        throw new Error('You must be logged in to update your profile.')
    }

    const name = formData.get('name') as string
    const handleInput = formData.get('handle') as string
    const bio = formData.get('bio') as string
    const avatarUrl = formData.get('avatarUrl') as string

    // Clean the handle (remove spaces, make lowercase, remove @ if they typed it)
    const cleanHandle = handleInput ? handleInput.replace(/^@/, '').toLowerCase().trim() : null

    // Check if someone else already took this handle
    if (cleanHandle) {
        const existingUser = await prisma.user.findUnique({
            where: { handle: cleanHandle }
        })

        if (existingUser && existingUser.id !== user.id) {
            return { error: 'This handle is already taken. Please choose another.' }
        }
    }

    // Update the user in Prisma
    await prisma.user.update({
        where: { id: user.id },
        data: {
            name,
            handle: cleanHandle,
            bio,
            avatarUrl
        }
    })

    // Clear the cache for the profile page so updates show instantly
    revalidatePath(`/scholar/${user.id}`)

    return { success: true, userId: user.id }
}