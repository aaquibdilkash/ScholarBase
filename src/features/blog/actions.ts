'use server'

import prisma from '@/lib/db'

// Fetch all published posts
export async function getPublishedPosts() {
    try {
        return await prisma.post.findMany({
            where: { published: true },
            orderBy: { createdAt: 'desc' },
            select: { id: true, title: true, slug: true, excerpt: true, createdAt: true }
        })
    } catch (error) {
        console.error("Error fetching posts:", error)
        return []
    }
}

// Fetch a single post by its URL slug
export async function getPostBySlug(slug: string) {
    try {
        return await prisma.post.findUnique({
            where: { slug }
        })
    } catch (error) {
        console.error("Error fetching post:", error)
        return null
    }
}