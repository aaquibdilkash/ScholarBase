import { User as SupabaseUser } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import prisma from '@/lib/db'

import { createClient } from '@/utils/supabase/server'

export async function getCurrentUser(): Promise<SupabaseUser | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    return user
}

export async function requireCurrentUser(message = 'Please log in to continue.'): Promise<SupabaseUser> {
    const user = await getCurrentUser()

    if (!user) {
        redirect(`/login?message=${encodeURIComponent(message)}`)
    }

    return user
}

export async function isUserAdmin(userId: string): Promise<boolean> {
    const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { isAdmin: true },
    })
    return dbUser?.isAdmin ?? false
}

/**
 * Checks if a user is authorized to modify a resource.
 * Returns true if the user is the owner OR an admin.
 */
export async function isAuthorizedOrAdmin(resourceAuthorId: string, userId: string): Promise<boolean> {
    if (resourceAuthorId === userId) return true
    return isUserAdmin(userId)
}
