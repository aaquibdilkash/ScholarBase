'use server'

import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { readFormValue, slugify } from '@/lib/form'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function createArticle(formData: FormData) {
    const user = await requireCurrentUser('Log in to publish an article.')

    const title = readFormValue(formData, 'title')
    const content = readFormValue(formData, 'content')
    const excerpt = readFormValue(formData, 'excerpt')
    const baseSlug = slugify(title) || 'article'
    let slug = baseSlug
    let suffix = 1

    while (await prisma.article.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${suffix}`
        suffix += 1
    }

    await prisma.article.create({
        data: {
            title,
            content,
            excerpt,
            slug,
            authorId: user.id,
        },
    })

    revalidatePath('/blog')
    redirect(`/blog/${slug}`)
}
