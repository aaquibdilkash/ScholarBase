'use server'

import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { readFormValue, slugify } from '@/lib/form'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { notifyFollowersOfActivity, notifyMentionedUsers } from '@/lib/notifications'

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

    await Promise.all([
        notifyFollowersOfActivity({
            actorId: user.id,
            type: 'article-published',
            targetType: 'article',
            targetId: slug,
            title: `${user.email?.split('@')[0] || 'Someone'} published a new article`,
            body: title,
        }),
        notifyMentionedUsers({
            actorId: user.id,
            content: `${title}\n${content}`,
            type: 'mention',
            targetType: 'article',
            targetId: slug,
            titleFactory: (handle) => `@${handle} was mentioned in an article`,
            bodyFactory: () => title,
        }),
    ])

    revalidatePath('/blog')
    redirect(`/blog/${slug}`)
}
