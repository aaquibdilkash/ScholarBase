import type { User as SupabaseUser } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

import prisma from '@/lib/db'
import { normalizeEmail, validateEmailFormat } from '@/lib/email-normalizer'
import {
    getEmailDomain,
    isInstitutionalEmailDomain,
} from '@/lib/email-domain-allowlist'

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
        const supabaseEmail = user.email ? normalizeEmail(user.email) : ''
        const hasChangedPrimaryEmail =
            validateEmailFormat(supabaseEmail) &&
            supabaseEmail !== existingUser.email
        const confirmed = Boolean(user.email_confirmed_at)

        // Supabase exposes the new primary email only after the email-change
        // confirmations complete. Sync it here without touching a separately
        // verified institutional address.
        if (hasChangedPrimaryEmail) {
            const newPrimaryIsInstitutional =
                !existingUser.institutionVerifiedAt &&
                confirmed &&
                isInstitutionalEmailDomain(supabaseEmail)

            return prisma.user.update({
                where: { id: user.id },
                data: {
                    email: supabaseEmail,
                    ...(newPrimaryIsInstitutional
                        ? {
                            institutionEmail: supabaseEmail,
                            institutionDomain: getEmailDomain(supabaseEmail),
                            institutionVerifiedAt: new Date(),
                        }
                        : {}),
                },
            })
        }

        // Supabase has already confirmed this account's primary email when
        // email_confirmed_at is populated. An institutional primary email
        // therefore earns the same badge as a secondary email verified from
        // Edit Profile, without sending a duplicate verification message.
        if (
            !existingUser.institutionVerifiedAt &&
            user.email_confirmed_at &&
            isInstitutionalEmailDomain(existingUser.email)
        ) {
            return prisma.user.update({
                where: { id: user.id },
                data: {
                    institutionEmail: existingUser.email,
                    institutionDomain: getEmailDomain(existingUser.email),
                    institutionVerifiedAt: new Date(),
                },
            })
        }

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
    const isConfirmedInstitutionalEmail =
        Boolean(user.email_confirmed_at) && isInstitutionalEmailDomain(email)

    return prisma.user.create({
        data: {
            id: user.id,
            email,
            institutionEmail: isConfirmedInstitutionalEmail ? email : null,
            institutionDomain: isConfirmedInstitutionalEmail
                ? getEmailDomain(email)
                : null,
            institutionVerifiedAt: isConfirmedInstitutionalEmail
                ? new Date()
                : null,
            name,
            handle,
            avatarUrl: user.user_metadata.avatar_url || null,
        },
    })
}
