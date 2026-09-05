import { User as SupabaseUser } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import prisma from '@/lib/db'

import { createClient } from '@/utils/supabase/server'

export const getCurrentUser = cache(async (): Promise<SupabaseUser | null> => {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    return user
})

export async function requireCurrentUser(message = 'Please log in to continue.'): Promise<SupabaseUser> {
    void message
    const user = await getCurrentUser()

    if (!user) {
        redirect('/login')
    }

    return user
}

/**
 * Same as requireCurrentUser, but additionally rejects accounts that have
 * been frozen by moderation (`user.isFrozen === true`). Use this in all
 * mutation entry points (creating posts, comments, surveys, tools, reports,
 * appeals, ...) so frozen users cannot create new content anywhere.
 */
export async function requireActiveUser(message = 'Please log in to continue.'): Promise<SupabaseUser> {
    const user = await requireCurrentUser(message)

    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { isFrozen: true },
    })

    if (dbUser?.isFrozen) {
        throw new Error(
            'ACCOUNT_FROZEN: Your account is restricted from posting or commenting.',
        )
    }

    return user
}

/**
 * Human-readable reason returned to clients when a frozen account attempts a
 * restricted action. Kept as a single source of truth so the message shown in
 * the UI toast always matches what the server rejects.
 */
export const FROZEN_ACTION_MESSAGE =
    'Your account is frozen. You are restricted from posting or commenting.'

export type ActiveUserResult =
    | { frozen: false; user: SupabaseUser }
    | { frozen: true; message: string }

/**
 * Graceful variant of `requireActiveUser` for the most interactive mutation
 * entry points (e.g. creating posts / comments). Instead of throwing a hard
 * error when the account is frozen — which today surfaces as a React "Server
 * Components render error" crash toast or a generic fallback — it returns a
 * standardized `{ frozen: true, message }` payload the caller forwards to the
 * client as a plain `{ success: false, message }` result.
 *
 * Any other authorization failure (logged out) still redirects as usual via
 * `requireCurrentUser`.
 */
export async function getActiveUser(
    message = 'Please log in to continue.',
): Promise<ActiveUserResult> {
    const user = await requireCurrentUser(message)

    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { isFrozen: true },
    })

    if (dbUser?.isFrozen) {
        return { frozen: true, message: FROZEN_ACTION_MESSAGE }
    }

    return { frozen: false, user }
}

export const isUserAdmin = cache(async (userId: string): Promise<boolean> => {
    const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { isAdmin: true },
    })
    return dbUser?.isAdmin ?? false
})

/**
 * Checks if a user is authorized to modify a resource.
 * Returns true if the user is the owner OR an admin.
 */
export async function isAuthorizedOrAdmin(resourceAuthorId: string, userId: string): Promise<boolean> {
    if (resourceAuthorId === userId) return true
    return isUserAdmin(userId)
}

export async function requireAdmin(message = 'Please log in to continue.'): Promise<SupabaseUser> {
    const user = await requireCurrentUser(message)
    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { isAdmin: true },
    })
    if (!dbUser?.isAdmin) {
        throw new Error('Not authorized. Admin access required.')
    }
    return user
}

