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

export async function getProfileSections(profileId: string, currentUserId?: string, take: number = 1) {
    const userWithProfileData = await prisma.user.findUnique({
        where: { id: profileId },
        select: {
            id: true,
            _count: {
                select: {
                    articles: true,
                    socialPosts: true,
                    vacancies: true,
                    admissions: true,
                    events: true,
                    helpPosts: true,
                    journals: true,
                    researchTools: true,
                    recommendations: true,
                    supervisors: true,
                    results: true,
                    contributionPosts: true,
                    publications: true,
                    surveys: true,
                }
            },
            articles: {
                take,
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
                take,
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
                take,
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
                take,
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
                take,
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
                take,
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
                take,
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
                take,
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
                take,
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
                take,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    name: true,
                    university: true,
                    department: true,
                    about: true,
                    createdAt: true,
                    authorId: true,
                    recommendations: true,
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
                take,
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
                take,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    title: true,
                    message: true,
                    amount: true,
                    upiId: true,
                    status: true,
                    rejectionReason: true,
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
                take,
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
            surveys: {
                take,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    title: true,
                    description: true,
                    privacy: true,
                    shareData: true,
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
                    _count: { select: { votes: true, comments: true, responses: true } }
                }
            },
        }
    })

    if (!userWithProfileData) return null

    return userWithProfileData;
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
} as const;

export async function getProfileSection(
    profileId: string,
    section: keyof typeof ProfileSectionMap,
    currentUserId?: string,
    skip: number = 0,
    take: number = 5
) {
    const model = ProfileSectionMap[section];
    if (!model) {
        throw new Error(`Invalid section: ${section}`);
    }

    const commonSelect = {
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
    };

    let select: any;

    switch (model) {
        case 'article':
            select = {
                id: true,
                slug: true,
                title: true,
                excerpt: true,
                content: true,
                published: true,
                authorId: true,
                createdAt: true,
                updatedAt: true,
                ...commonSelect
            };
            break;
        case 'socialPost':
            select = {
                id: true,
                content: true,
                imageUrl: true,
                authorId: true,
                createdAt: true,
                updatedAt: true,
                ...commonSelect
            };
            break;
        case 'jobVacancy':
            select = {
                id: true,
                title: true,
                institution: true,
                deadline: true,
                description: true,
                notificationLink: true,
                applyLink: true,
                createdAt: true,
                authorId: true,
                ...commonSelect
            };
            break;
        case 'phdAdmission':
            select = {
                id: true,
                university: true,
                department: true,
                deadline: true,
                description: true,
                notificationLink: true,
                applyLink: true,
                createdAt: true,
                authorId: true,
                ...commonSelect
            };
            break;
        case 'researchEvent':
            select = {
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
                ...commonSelect
            };
            break;
        case 'helpPost':
            select = {
                id: true,
                title: true,
                subject: true,
                category: true,
                message: true,
                createdAt: true,
                updatedAt: true,
                authorId: true,
                ...commonSelect
            };
            break;
        case 'journal':
            select = {
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
                ...commonSelect
            };
            break;
        case 'researchTool':
            select = {
                id: true,
                name: true,
                description: true,
                website: true,
                use: true,
                authorId: true,
                createdAt: true,
                updatedAt: true,
                ...commonSelect
            };
            break;
        case 'recommendation':
            select = {
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
                ...commonSelect
            };
            break;
        case 'supervisor':
            select = {
                id: true,
                name: true,
                university: true,
                department: true,
                about: true,
                createdAt: true,
                authorId: true,
                recommendations: true,
                ...commonSelect
            };
            break;
        case 'result':
            select = {
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
                ...commonSelect
            };
            break;
        case 'contribution':
            select = {
                id: true,
                title: true,
                message: true,
                amount: true,
                upiId: true,
                status: true,
                rejectionReason: true,
                authorId: true,
                createdAt: true,
                updatedAt: true,
                ...commonSelect
            };
            break;
        case 'publication':
            select = {
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
                ...commonSelect
            };
            break;
        case 'researchSurvey':
            select = {
                id: true,
                title: true,
                description: true,
                privacy: true,
                shareData: true,
                status: true,
                authorId: true,
                createdAt: true,
                updatedAt: true,
                ...commonSelect,
                _count: { select: { votes: true, comments: true, responses: true } }
            };
            break;
        default:
            throw new Error(`Invalid section: ${section}`);
    }

    // @ts-ignore
    const items = await prisma[model].findMany({
        where: { authorId: profileId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select,
    });

    return items;
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

    revalidatePath(`/scholars/${updatedUser.id}`)

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