'use server'

import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { normalizeHandle, readOptionalFormValue } from '@/lib/form'
import { revalidatePath } from 'next/cache'
import { deleteFromCloudinary } from '@/app/actions/cloudinary'
import type { ActivityItem, ActivityConfig } from '@/types/activity'

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

    let select: Record<string, unknown>;

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

    // @ts-expect-error dynamic Prisma model access by name
    const items = await prisma[model].findMany({
        where: { authorId: profileId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select,
    });

    return items;
}


// ─────────────────────────────────────────────────────────────
// Activity tab: content the scholar commented on, replied to,
// and voted on. Returns a flat, unified list for rendering.
// ─────────────────────────────────────────────────────────────

type PrismaActivityRow = {
    id: string;
    parentId?: string | null;
    createdAt: Date;
    [key: string]: PrismaActivityContent | unknown;
};

// The nested content shape selected by the dynamic activity queries.
type PrismaActivityContent = {
    id: string;
    [key: string]: unknown;
};

// Minimal structural type for the dynamic Prisma delegates used below.
type ActivityDelegate = {
    findMany: (args: Record<string, unknown>) => Promise<PrismaActivityRow[]>;
};

const prismaDelegates = prisma as unknown as Record<string, ActivityDelegate>;

const ACTIVITY_CONFIG: ActivityConfig[] = [
    {
        type: "article",
        typeLabel: "Research Article",
        commentModel: "articleComment",
        voteModel: "articleVote",
        contentField: "article",
        contentModel: "article",
        titleField: "title",
        excerptField: "excerpt",
        detailHref: (id) => `/blog/${id}`,
    },
    {
        type: "post",
        typeLabel: "Feed Post",
        commentModel: "socialComment",
        voteModel: "socialVote",
        contentField: "socialPost",
        contentModel: "socialPost",
        titleField: "content",
        excerptField: "content",
        detailHref: (id) => `/feed/${id}`,
    },
    {
        type: "vacancy",
        typeLabel: "Job Vacancy",
        commentModel: "jobVacancyComment",
        voteModel: "jobVacancyVote",
        contentField: "jobVacancy",
        contentModel: "jobVacancy",
        titleField: "title",
        excerptField: "description",
        detailHref: (id) => `/vacancies/${id}`,
    },
    {
        type: "admission",
        typeLabel: "PhD Admission",
        commentModel: "phdAdmissionComment",
        voteModel: "phdAdmissionVote",
        contentField: "phdAdmission",
        contentModel: "phdAdmission",
        titleField: "university",
        excerptField: "description",
        detailHref: (id) => `/admissions/${id}`,
    },
    {
        type: "event",
        typeLabel: "Research Event",
        commentModel: "researchEventComment",
        voteModel: "researchEventVote",
        contentField: "researchEvent",
        contentModel: "researchEvent",
        titleField: "title",
        excerptField: "description",
        detailHref: (id) => `/events/${id}`,
    },
    {
        type: "help",
        typeLabel: "Help Post",
        commentModel: "helpPostComment",
        voteModel: "helpPostVote",
        contentField: "helpPost",
        contentModel: "helpPost",
        titleField: "title",
        excerptField: "message",
        detailHref: (id) => `/help/${id}`,
    },
    {
        type: "journal",
        typeLabel: "Journal",
        commentModel: "journalComment",
        voteModel: "journalVote",
        contentField: "journal",
        contentModel: "journal",
        titleField: "title",
        excerptField: "about",
        detailHref: (id) => `/journals/${id}`,
    },
    {
        type: "researchTool",
        typeLabel: "Research Tool",
        commentModel: "researchToolComment",
        voteModel: "researchToolVote",
        contentField: "researchTool",
        contentModel: "researchTool",
        titleField: "name",
        excerptField: "description",
        detailHref: (id) => `/research-tools/${id}`,
    },
    {
        type: "result",
        typeLabel: "Result",
        commentModel: "resultComment",
        voteModel: "resultVote",
        contentField: "result",
        contentModel: "result",
        titleField: "title",
        excerptField: "description",
        detailHref: (id) => `/results/${id}`,
    },
    {
        type: "contribution",
        typeLabel: "Contribution",
        commentModel: "contributionComment",
        voteModel: "contributionVote",
        contentField: "contribution",
        contentModel: "contribution",
        titleField: "title",
        excerptField: "message",
        detailHref: (id) => `/contributions/${id}`,
    },
    {
        type: "publication",
        typeLabel: "Publication",
        commentModel: "publicationComment",
        voteModel: "publicationVote",
        contentField: "publication",
        contentModel: "publication",
        titleField: "title",
        excerptField: "abstract",
        detailHref: (id) => `/publications/${id}`,
    },
    {
        type: "survey",
        typeLabel: "Research Survey",
        commentModel: "surveyComment",
        voteModel: "surveyVote",
        contentField: "survey",
        contentModel: "researchSurvey",
        titleField: "title",
        excerptField: "description",
        detailHref: (id) => `/surveys/${id}`,
    },
];

export async function getProfileActivity(profileId: string, take = 20) {
    const user = await prisma.user.findUnique({
        where: { id: profileId },
        select: {
            id: true,
            name: true,
            handle: true,
            avatarUrl: true,
        },
    });

    if (!user) {
        return [];
    }

    const items: ActivityItem[] = [];

    for (const cfg of ACTIVITY_CONFIG) {
        // Comments + replies authored by this scholar
        const commentRows = await prismaDelegates[cfg.commentModel].findMany({
            where: { authorId: profileId },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
                id: true,
                parentId: true,
                createdAt: true,
                [cfg.contentField]: {
                    select: {
                        id: true,
                        [cfg.titleField]: true,
                        ...(cfg.excerptField ? { [cfg.excerptField]: true } : {}),
                        author: {
                            select: {
                                id: true,
                                name: true,
                                handle: true,
                                avatarUrl: true,
                            },
                        },
                    },
                },
            },
        });

        for (const row of commentRows) {
            const content = row[cfg.contentField] as PrismaActivityContent | undefined;
            if (!content) continue;
            const title = content[cfg.titleField] as string | undefined;
            const excerpt = cfg.excerptField
                ? (content[cfg.excerptField] as string | undefined)
                : undefined;
            items.push({
                contentId: content.id,
                type: cfg.type,
                typeLabel: cfg.typeLabel,
                action: row.parentId ? "replied" : "commented",
                title: title ?? "Untitled",
                excerpt,
                href: cfg.detailHref(content.id),
                author: user,
                authorId: user.id,
                createdAt: row.createdAt,
            });
        }

        // Votes by this scholar
        const voteRows = await prismaDelegates[cfg.voteModel].findMany({
            where: { userId: profileId },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
                createdAt: true,
                [cfg.contentField]: {
                    select: {
                        id: true,
                        [cfg.titleField]: true,
                        ...(cfg.excerptField ? { [cfg.excerptField]: true } : {}),
                        author: {
                            select: {
                                id: true,
                                name: true,
                                handle: true,
                                avatarUrl: true,
                            },
                        },
                    },
                },
            },
        });

        for (const row of voteRows) {
            const content = row[cfg.contentField] as PrismaActivityContent | undefined;
            if (!content) continue;
            const title = content[cfg.titleField] as string | undefined;
            const excerpt = cfg.excerptField
                ? (content[cfg.excerptField] as string | undefined)
                : undefined;
            items.push({
                contentId: content.id,
                type: cfg.type,
                typeLabel: cfg.typeLabel,
                action: "voted",
                title: title ?? "Untitled",
                excerpt,
                href: cfg.detailHref(content.id),
                author: user,
                authorId: user.id,
                createdAt: row.createdAt,
            });
        }
    }

    // Sort newest first, dedupe by contentId + action
    const seen = new Set<string>();
    const unique: ActivityItem[] = [];
    const sorted = [...items].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    for (const item of sorted) {
        const key = `${item.contentId}:${item.action}`;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(item);
        if (unique.length >= take) break;
    }

    return unique;
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

    const updatedUser = await prisma.user.update({
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
