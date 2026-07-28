'use server'

import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { normalizeHandle, readOptionalFormValue } from '@/lib/form'
import { revalidatePath } from 'next/cache'
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
            reputation: true,
            _count: {
                select: {
                    followers: true,
                    following: true,
                },
            },
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
        articles: [],
        socialPosts: [],
        vacancies: [],
        admissions: [],
        events: [],
        helpPosts: [],
        journals: [],
        researchTools: [],
        recommendations: [],
        supervisors: [],
        results: [],
        contributions: [],
        publications: [],
        isFollowing: !!followers?.length,
        isOwnProfile: currentUserId === profileId,
    }
}

export type ProfileSections = Awaited<ReturnType<typeof getProfileSections>>;

export async function getProfileSections(profileId: string, currentUserId?: string) {
    const userWithProfileData = await prisma.user.findUnique({
        where: { id: profileId },
        select: {
            id: true,
            articles: {
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    slug: true,
                    title: true,
                    excerpt: true,
                    content: true,
                    published: true,
                    authorId: true,
                    createdAt: true,
                    updatedAt: true,
                    author: {
                        select: {
                            id: true,
                            name: true,
                            handle: true,
                            avatarUrl: true,
                            createdAt: true,
                            email: true,
                            bio: true,
                            followers: currentUserId ? { where: { followerId: currentUserId } } : false
                        }
                    },
                    votes: currentUserId ? { select: { userId: true, voteType: true } } : { take: 0, select: { userId: true, voteType: true } },
                    _count: { select: { votes: true, comments: true } }
                },
            },
            socialPosts: {
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    content: true,
                    imageUrl: true,
                    authorId: true,
                    createdAt: true,
                    updatedAt: true,
                    author: {
                        select: {
                            id: true,
                            name: true,
                            handle: true,
                            avatarUrl: true,
                            createdAt: true,
                            email: true,
                            bio: true,
                            followers: currentUserId ? { where: { followerId: currentUserId } } : false
                        }
                    },
                    votes: currentUserId ? { select: { userId: true, voteType: true } } : { take: 0, select: { userId: true, voteType: true } },
                    _count: { select: { votes: true, comments: true } }
                },
            },
            vacancies: {
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    title: true,
                    institution: true,
                    deadline: true,
                    description: true,
                    notificationLink: true,
                    applyLink: true,
                    createdAt: true,
                    authorId: true,
                    author: {
                        select: {
                            id: true,
                            name: true,
                            handle: true,
                            avatarUrl: true,
                            createdAt: true,
                            email: true,
                            bio: true,
                            followers: currentUserId ? { where: { followerId: currentUserId } } : false
                        }
                    },
                    votes: currentUserId ? { select: { userId: true, voteType: true } } : { take: 0, select: { userId: true, voteType: true } },
                    _count: { select: { votes: true, comments: true } }
                },
            },
            admissions: {
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    university: true,
                    department: true,
                    deadline: true,
                    description: true,
                    notificationLink: true,
                    applyLink: true,
                    createdAt: true,
                    authorId: true,
                    author: {
                        select: {
                            id: true,
                            name: true,
                            handle: true,
                            avatarUrl: true,
                            createdAt: true,
                            email: true,
                            bio: true,
                            followers: currentUserId ? { where: { followerId: currentUserId } } : false
                        }
                    },
                    votes: currentUserId ? { select: { userId: true, voteType: true } } : { take: 0, select: { userId: true, voteType: true } },
                    _count: { select: { votes: true, comments: true } }
                },
            },
            events: {
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    title: true,
                    location: true,
                    date: true,
                    description: true,
                    deadline: true,
                    notificationLink: true,
                    applyLink: true,
                    createdAt: true,
                    authorId: true,
                    author: {
                        select: {
                            id: true,
                            name: true,
                            handle: true,
                            avatarUrl: true,
                            createdAt: true,
                            email: true,
                            bio: true,
                            followers: currentUserId ? { where: { followerId: currentUserId } } : false
                        }
                    },
                    votes: currentUserId ? { select: { userId: true, voteType: true } } : { take: 0, select: { userId: true, voteType: true } },
                    _count: { select: { votes: true, comments: true } }
                },
            },
            helpPosts: {
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    title: true,
                    subject: true,
                    category: true,
                    message: true,
                    createdAt: true,
                    updatedAt: true,
                    authorId: true,
                    author: {
                        select: {
                            id: true,
                            name: true,
                            handle: true,
                            avatarUrl: true,
                            createdAt: true,
                            email: true,
                            bio: true,
                            followers: currentUserId ? { where: { followerId: currentUserId } } : false
                        }
                    },
                    votes: currentUserId ? { select: { userId: true, voteType: true } } : { take: 0, select: { userId: true, voteType: true } },
                    _count: { select: { votes: true, comments: true } }
                }
            },
            journals: {
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    title: true,
                    about: true,
                    issn: true,
                    impactFactor: true,
                    scopus: true,
                    abdcCategory: true,
                    publisher: true,
                    website: true,
                    authorId: true,
                    createdAt: true,
                    updatedAt: true,
                    author: {
                        select: {
                            id: true,
                            name: true,
                            handle: true,
                            avatarUrl: true,
                            createdAt: true,
                            email: true,
                            bio: true,
                            followers: currentUserId ? { where: { followerId: currentUserId } } : false
                        }
                    },
                    votes: currentUserId ? { select: { userId: true, voteType: true } } : { take: 0, select: { userId: true, voteType: true } },
                    _count: { select: { votes: true, comments: true } }
                }
            },
            researchTools: {
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    website: true,
                    use: true,
                    authorId: true,
                    createdAt: true,
                    updatedAt: true,
                    author: {
                        select: {
                            id: true,
                            name: true,
                            handle: true,
                            avatarUrl: true,
                            createdAt: true,
                            email: true,
                            bio: true,
                            followers: currentUserId ? { where: { followerId: currentUserId } } : false
                        }
                    },
                    votes: currentUserId ? { select: { userId: true, voteType: true } } : { take: 0, select: { userId: true, voteType: true } },
                    _count: { select: { votes: true, comments: true } }
                }
            },
            recommendations: {
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    rating: true,
                    turnaroundTimeDays: true,
                    responsivenessScore: true,
                    guidanceScore: true,
                    feedback: true,
                    supervisorId: true,
                    authorId: true,
                    createdAt: true,
                    supervisor: { select: { id: true, name: true } },
                    author: {
                        select: {
                            id: true,
                            name: true,
                            handle: true,
                            avatarUrl: true,
                            createdAt: true,
                            email: true,
                            bio: true,
                            followers: currentUserId ? { where: { followerId: currentUserId } } : false
                        }
                    },
                    votes: currentUserId ? { select: { userId: true, voteType: true } } : { take: 0, select: { userId: true, voteType: true } },
                    _count: { select: { votes: true, comments: true } }
                }
            },
            supervisors: {
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    name: true,
                    university: true,
                    department: true,
                    about: true,
                    createdAt: true,
                    authorId: true,
                    author: {
                        select: {
                            id: true,
                            name: true,
                            handle: true,
                            avatarUrl: true,
                            createdAt: true,
                            email: true,
                            bio: true,
                            followers: currentUserId ? { where: { followerId: currentUserId } } : false
                        }
                    },
                    votes: currentUserId ? { select: { userId: true, voteType: true } } : { take: 0, select: { userId: true, voteType: true } },
                    _count: { select: { votes: true, comments: true } }
                }
            },
            results: {
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    title: true,
                    description: true,
                    type: true,
                    category: true,
                    conductingBody: true,
                    session: true,
                    notificationLink: true,
                    resultLink: true,
                    authorId: true,
                    createdAt: true,
                    updatedAt: true,
                    author: {
                        select: {
                            id: true,
                            name: true,
                            handle: true,
                            avatarUrl: true,
                            createdAt: true,
                            email: true,
                            bio: true,
                            followers: currentUserId ? { where: { followerId: currentUserId } } : false
                        }
                    },
                    votes: currentUserId ? { select: { userId: true, voteType: true } } : { take: 0, select: { userId: true, voteType: true } },
                    _count: { select: { votes: true, comments: true } }
                }
            },
            contributionPosts: {
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    title: true,
                    message: true,
                    amount: true,
                    upiId: true,
                    status: true,
                    authorId: true,
                    createdAt: true,
                    updatedAt: true,
                    author: {
                        select: {
                            id: true,
                            name: true,
                            handle: true,
                            avatarUrl: true,
                            createdAt: true,
                            email: true,
                            bio: true,
                            followers: currentUserId ? { where: { followerId: currentUserId } } : false
                        }
                    },
                    votes: currentUserId ? { select: { userId: true, voteType: true } } : { take: 0, select: { userId: true, voteType: true } },
                    _count: { select: { votes: true, comments: true } }
                }
            },
            publications: {
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    title: true,
                    authors: true,
                    publicationType: true,
                    journalOrConference: true,
                    publisher: true,
                    year: true,
                    volume: true,
                    issue: true,
                    pages: true,
                    doi: true,
                    isbn: true,
                    url: true,
                    keywords: true,
                    domain: true,
                    abstract: true,
                    isUserAuthor: true,
                    authorId: true,
                    createdAt: true,
                    updatedAt: true,
                    author: {
                        select: {
                            id: true,
                            name: true,
                            handle: true,
                            avatarUrl: true,
                            createdAt: true,
                            email: true,
                            bio: true,
                            followers: currentUserId ? { where: { followerId: currentUserId } } : false
                        }
                    },
                    votes: currentUserId ? { select: { userId: true, voteType: true } } : { take: 0, select: { userId: true, voteType: true } },
                    _count: { select: { votes: true, comments: true } }
                }
            },
        }
    })

    if (!userWithProfileData) return null

    return userWithProfileData;
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

    const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
            handle: newHandle ? normalizeHandle(newHandle) : user.handle,
            name: newName || user.name,
            bio: newBio,
            avatarUrl: newAvatarUrl ?? user.avatarUrl,
        }
    })

    revalidatePath(`/scholar/${updatedUser.id}`)

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