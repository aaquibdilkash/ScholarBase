import type { User as SupabaseUser } from '@supabase/supabase-js'

import prisma from '@/lib/db'

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

    return prisma.user.create({
        data: {
            id: user.id,
            email: user.email,
            name: user.user_metadata.full_name || user.email.split('@')[0] || null,
            avatarUrl: user.user_metadata.avatar_url || null,
        },
    })
}
