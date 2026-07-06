'use server'

import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { readFormValue } from '@/lib/form'
import { revalidatePath } from 'next/cache'

export async function createSocialPost(formData: FormData) {
    const user = await requireCurrentUser('You must be logged in to post.')

    const content = readFormValue(formData, 'content')

    if (!content) return

    await prisma.socialPost.create({
        data: {
            content,
            authorId: user.id,
        },
    })

    revalidatePath('/feed')
}
