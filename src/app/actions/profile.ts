'use server'

import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { normalizeHandle, readOptionalFormValue } from '@/lib/form'
import { deleteFromCloudinary } from '@/app/actions/cloudinary'

export async function getProfile(profileId: string, currentUserId?: string) {
    const userWithProfileData = await prisma.user.findUnique({
        where: { id: profileId },
        select: {
            id: true,
            name: true,
            handle: true,
            avatarUrl: true,
            bio: true,
            githubUrl: true,
            orcidUrl: true,
            linkedinUrl: true,
            googleScholarUrl: true,
            createdAt: true,
            reputation: true,
            followersCount: true, // Use materialized counter
            followingCount: true, // Use materialized counter
            followers: currentUserId
                ? {
                    where: { followerId: currentUserId },
                    select: { followerId: true },
                }
                : false,
        }
    })

    if (!userWithProfileData) return null

    const { followers, ...rest } = userWithProfileData

    return {
        ...rest,
        isFollowing: !!followers?.length,
        isOwnProfile: currentUserId === profileId,
    }
}

// ─────────────────────────────────────────────────────────────
// Content sections (tabs) on the scholar profile.
// ZERO-COMPUTE: each section is loaded with `include`, returning the
// materialized `totalVotes` / `totalComments` / `totalResponses`
// scalars directly. No relational `_count` aggregations are run. The
// current user's vote & follow state is resolved with filtered selects
// (N+1 fix) instead of fetching the full relation arrays.
// ─────────────────────────────────────────────────────────────

export async function getProfileSections(
    profileId: string,
    currentUserId?: string,
    take: number = 1,
) {
    const authorSelect = {
        select: {
            id: true,
            name: true,
            handle: true,
            avatarUrl: true,
            createdAt: true,
            email: true,
            bio: true,
            followers: currentUserId
                ? {
                    where: { followerId: currentUserId },
                    select: { followerId: true },
                }
                : false,
        },
    }

    const votesSelect = currentUserId
        ? { where: { userId: currentUserId }, select: { userId: true, voteType: true } }
        : false

    return prisma.user.findUnique({
        where: { id: profileId },
        select: {
            id: true,
            articles: {
                take,
                orderBy: { createdAt: 'desc' },
                include: { author: authorSelect, votes: votesSelect },
            },
            socialPosts: {
                take,
                orderBy: { createdAt: 'desc' },
                include: { author: authorSelect, votes: votesSelect },
            },
            vacancies: {
                take,
                orderBy: { createdAt: 'desc' },
                include: { author: authorSelect, votes: votesSelect },
            },
            admissions: {
                take,
                orderBy: { createdAt: 'desc' },
                include: { author: authorSelect, votes: votesSelect },
            },
            events: {
                take,
                orderBy: { createdAt: 'desc' },
                include: { author: authorSelect, votes: votesSelect },
            },
            helpPosts: {
                take,
                orderBy: { createdAt: 'desc' },
                include: { author: authorSelect, votes: votesSelect },
            },
            journals: {
                take,
                orderBy: { createdAt: 'desc' },
                include: { author: authorSelect, votes: votesSelect },
            },
            researchTools: {
                take,
                orderBy: { createdAt: 'desc' },
                include: { author: authorSelect, votes: votesSelect },
            },
            recommendations: {
                take,
                orderBy: { createdAt: 'desc' },
                include: { author: authorSelect, votes: votesSelect, supervisor: { select: { id: true, name: true } } },
            },
            supervisors: {
                take,
                orderBy: { createdAt: 'desc' },
                include: { author: authorSelect, votes: votesSelect, recommendations: true },
            },
            results: {
                take,
                orderBy: { createdAt: 'desc' },
                include: { author: authorSelect, votes: votesSelect },
            },
            contributionPosts: {
                take,
                orderBy: { createdAt: 'desc' },
                include: { author: authorSelect, votes: votesSelect },
            },
            publications: {
                take,
                orderBy: { createdAt: 'desc' },
                include: { author: authorSelect, votes: votesSelect },
            },
            surveys: {
                take,
                orderBy: { createdAt: 'desc' },
                include: { author: authorSelect, votes: votesSelect },
            },
        },
    })
}

const ProfileSectionMap = {
    articles: 'article',
    socialPosts: 'socialPost',
    vacancies: 'jobVacancy',
    admissions: 'phdAdmission',
    events: 'researchEvent',
    helpPosts: 'helpPost',
    journals: 'journal',
    researchTools: 'researchTool',
    recommendations: 'recommendation',
    supervisors: 'supervisor',
    results: 'result',
    contributionPosts: 'contribution',
    publications: 'publication',
    surveys: 'researchSurvey',
} as const

export async function getProfileSection(
    profileId: string,
    section: keyof typeof ProfileSectionMap,
    currentUserId?: string,
    skip: number = 0,
    take: number = 5,
) {
    const model = ProfileSectionMap[section]
    if (!model) throw new Error(`Invalid section: ${section}`)

    const include = {
        author: {
            select: {
                id: true,
                name: true,
                handle: true,
                avatarUrl: true,
                createdAt: true,
                email: true,
                bio: true,
                followers: currentUserId
                    ? {
                        where: { followerId: currentUserId },
                        select: { followerId: true },
                    }
                    : false,
            },
        },
        votes: currentUserId
            ? { where: { userId: currentUserId }, select: { userId: true, voteType: true } }
            : false,
        ...(model === 'supervisor' ? { recommendations: true } : {}),
        ...(model === 'recommendation' ? { supervisor: { select: { id: true, name: true } } } : {}),
    }

    // `model` is a dynamic Prisma model key; a single intentional cast is used.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (prisma as any)[model].findMany({
        where: { authorId: profileId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include,
    })
}
// ─────────────────────────────────────────────────────────────
// Activity tab: content the scholar commented on, replied to,
// and voted on. Returns a flat, unified list for rendering.
// ─────────────────────────────────────────────────────────────

export async function getProfileActivity(profileId: string, take = 20) {
    if (!profileId) return [];

    return prisma.userActivity.findMany({
        where: { userId: profileId },
        take,
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            action: true,
            moduleType: true,
            entityId: true,
            entityTitle: true,
            createdAt: true,
        }
    });
}

export async function updateProfile(formData: FormData) {
    const supabaseUser = await requireCurrentUser('You must be logged in to update your profile.')

    const user = await prisma.user.findUnique({
        where: { id: supabaseUser.id },
    })


    if (!user) {
        throw new Error('User not found in database.')
    }

    const newHandle = readOptionalFormValue(formData, 'handle')
    const newName = readOptionalFormValue(formData, 'name')
    const newBio = readOptionalFormValue(formData, 'bio')
    const newAvatarUrl = readOptionalFormValue(formData, 'avatarUrl')
    const newGithubUrl = readOptionalFormValue(formData, 'githubUrl')
    const newOrcidUrl = readOptionalFormValue(formData, 'orcidUrl')
    const newLinkedinUrl = readOptionalFormValue(formData, 'linkedinUrl')
    const newGoogleScholarUrl = readOptionalFormValue(formData, 'googleScholarUrl')

    if (newHandle) {
        const handleAvailable = await isHandleAvailable(newHandle);
        if (!handleAvailable) {
            return {
                success: false,
                message: "Handle is already taken."
            }
        }
    }

    // Delete old avatar from Cloudinary if a new one is being set
    if (newAvatarUrl && newAvatarUrl !== user.avatarUrl && user.avatarUrl) {
        await deleteFromCloudinary(user.avatarUrl);
    }

        await prisma.user.update({
        where: { id: user.id },
        data: {
            handle: newHandle ? normalizeHandle(newHandle) : user.handle,
            name: newName || user.name,
            bio: newBio,
            avatarUrl: newAvatarUrl ?? user.avatarUrl,
            githubUrl: newGithubUrl ?? user.githubUrl,
            orcidUrl: newOrcidUrl ?? user.orcidUrl,
            linkedinUrl: newLinkedinUrl ?? user.linkedinUrl,
            googleScholarUrl: newGoogleScholarUrl ?? user.googleScholarUrl,
        }
    })

    return {
        success: true,
        message: 'Your profile has been updated successfully!',
    }
}

export async function isHandleAvailable(handle: string) {
    const supabaseUser = await requireCurrentUser('You must be logged in to check handle availability.')
    const normalizedHandle = normalizeHandle(handle);
    const user = await prisma.user.findFirst({
        where: {
            handle: normalizedHandle,
            id: {
                not: supabaseUser.id
            }
        }
    });

    return !user;
}
