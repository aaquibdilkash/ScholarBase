import type { User as SupabaseUser } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

import prisma from '@/lib/db'
import { normalizeEmail, validateEmailFormat } from '@/lib/email-normalizer'

function normalizeHandleSeed(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 24) || 'scholar'
}

async function createUniqueHandle(seed: string, userId: string) {
    const base = normalizeHandleSeed(seed)
    const candidates = [
        base,
        `${base}_${userId.slice(0, 6).toLowerCase()}`,
        `scholar_${userId.slice(0, 8).toLowerCase()}`,
    ]

    for (const handle of candidates) {
        const existing = await prisma.user.findUnique({
            where: { handle },
            select: { id: true },
        })
        if (!existing) return handle
    }

    return `scholar_${randomUUID().slice(0, 4).toLowerCase()}`
}

export async function ensureUserProfile(user: SupabaseUser) {
    const existingUser = await prisma.user.findUnique({
        where: { id: user.id },
    })

    if (existingUser) {
        return existingUser
    }

    if (!user.email) {
        throw new Error('Authenticated users must have an email address.')
    }

    const email = normalizeEmail(user.email)
    if (!validateEmailFormat(email)) {
        throw new Error('Authenticated users must have a valid email address.')
    }

    const name = user.user_metadata.full_name || email.split('@')[0] || null
    const handle = await createUniqueHandle(name || email.split('@')[0], user.id)

    return prisma.user.create({
        data: {
            id: user.id,
            email,
            name,
            handle,
            avatarUrl: user.user_metadata.avatar_url || null,
        },
    })
}
