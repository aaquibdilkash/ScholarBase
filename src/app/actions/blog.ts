'use server'

import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { readFormValue, slugify } from '@/lib/form'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { notifyFollowersOfActivity, notifyMentionedUsers } from '@/lib/notifications'

export async function getArticles(q?: string, userId?: string) {
    return prisma.article.findMany({
        where: q
          ? {
              OR: [
                {
                  title: {
                    contains: q,
                    mode: "insensitive",
                  },
                },
                {
                  author: {
                    name: {
                      contains: q,
                      mode: "insensitive",
                    },
                  },
                },
              ],
            }
          : {},
        orderBy: { createdAt: "desc" },
        include: {
          author: true,
          likes: userId ? { where: { userId: userId } } : false,
          _count: {
            select: {
              likes: true,
              comments: true,
            },
          },
        },
      });
}

export async function getArticle(slug: string, userId?: string) {
    return prisma.article.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      content: true,
      createdAt: true,
      authorId: true,
      author: {
        select: {
          id: true,
          name: true,
          handle: true,
          avatarUrl: true,
        },
      },
      likes: userId ? { where: { userId }, select: { userId: true } } : { take: 0, select: { userId: true } },
      comments: {
        where: { parentId: null },
        select: {
          id: true,
          content: true,
          createdAt: true,
          parentId: true,
          author: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          likes: userId ? { where: { userId }, select: { userId: true } } : { take: 0, select: { userId: true } },
          replies: {
            select: {
              id: true,
              content: true,
              createdAt: true,
              parentId: true,
              author: {
                select: { id: true, name: true, avatarUrl: true },
              },
              likes: userId ? { where: { userId }, select: { userId: true } } : { take: 0, select: { userId: true } },
              _count: { select: { likes: true } },
            },
            orderBy: { createdAt: "asc" },
          },
          _count: { select: { likes: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: {
        select: { likes: true, comments: true },
      },
    },
  });
}

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
            published: true,
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
            content: `${title}
${content}`,
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

export async function updateArticle(
    formData: FormData,
    articleId: string,
    slug: string
) {
    const user = await requireCurrentUser('Log in to edit this article.')

    const title = readFormValue(formData, 'title')
    const content = readFormValue(formData, 'content')
    const excerpt = readFormValue(formData, 'excerpt')

    const article = await prisma.article.findUnique({
        where: { id: articleId },
        select: { authorId: true, slug: true },
    })

    if (!article) return
    if (article.authorId !== user.id) {
        throw new Error('Not authorized to edit this article.')
    }

    const baseSlug = slugify(title) || 'article'
    let nextSlug = baseSlug
    let suffix = 1

    // Keep the current slug if it matches; otherwise avoid collisions.
    const currentSlug = article.slug
    while (
        nextSlug !== currentSlug &&
        (await prisma.article.findUnique({ where: { slug: nextSlug } }))
    ) {
        nextSlug = `${baseSlug}-${suffix}`
        suffix += 1
    }

    await prisma.article.update({
        where: { id: articleId },
        data: {
            title,
            content,
            excerpt,
            slug: nextSlug,
        },
    })

    revalidatePath('/blog')
    revalidatePath(`/blog/${slug}`)
    if (nextSlug !== slug) revalidatePath(`/blog/${nextSlug}`)

    redirect(`/blog/${nextSlug}`)
}

export async function deleteArticle(articleId: string, slug: string) {
    const user = await requireCurrentUser('Log in to delete this article.')

    const article = await prisma.article.findUnique({
        where: { id: articleId },
        select: { authorId: true },
    })

    if (!article) return
    if (article.authorId !== user.id) {
        throw new Error('Not authorized to delete this article.')
    }

    await prisma.article.delete({ where: { id: articleId } })

    revalidatePath('/blog')
    revalidatePath(`/blog/${slug}`)
    redirect('/blog')
}
