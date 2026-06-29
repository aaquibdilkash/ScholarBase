'use server'

import { createClient } from '@/utils/supabase/server'
import prisma from '@/lib/db'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function createArticle(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error("Not logged in")

    const title = formData.get('title') as string
    const content = formData.get('content') as string
    const excerpt = formData.get('excerpt') as string

    // Create a simple slug from the title
    const slug = title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '')

    await prisma.article.create({
        data: {
            title,
            content,
            excerpt,
            slug,
            authorId: user.id
        }
    })

    revalidatePath('/blog')
    redirect(`/blog/${slug}`)
}