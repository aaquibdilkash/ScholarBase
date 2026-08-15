/**
 * Shared content-card types used across list card components.
 * These wrap the Prisma models with the author + votes + counts shape
 * that ListPageCardShell and VoteButton expect.
 *
 * The model fields are intentionally `Partial` because some callers (e.g.
 * profile sections) pass partial selects, while list pages pass full rows.
 */
import type {
    Article,
    JobVacancy,
    PhdAdmission,
    ResearchEvent,
    HelpPost,
    ResearchTool,
    ResearchGrant,
    Course,
    Journal,
    Result,
    Contribution,
    Publication,
    ResearchSurvey,
    SocialPost,
    Supervisor,
    Recommendation,
} from "@prisma/client";
import type { VoteType } from "./votes";

export interface VoteRecord {
    userId: string;
    voteType: VoteType;
}

/**
 * Author shape used by cards. Structural (not `extends User`) so that
 * action-returned objects containing extra/missing User fields still satisfy it.
 */
export interface AuthorWithFollowers {
    id: string;
    name: string | null;
    handle: string | null;
    avatarUrl: string | null;
    email?: string | null;
    bio?: string | null;
    createdAt?: Date;
    followers?: { followerId: string }[];
}

export interface ContentMeta {
    votes: VoteRecord[];
    _count: { votes: number; comments: number };
}

export type ArticleWithAuthor = Partial<Article> & {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    slug: string;
    author: AuthorWithFollowers;
    votes: VoteRecord[];
    _count: { votes: number; comments: number };
};

export type VacancyWithAuthor = Partial<JobVacancy> & {
    id: string;
    createdAt: Date;
    deadline: Date;
    title: string;
    institution: string;
    description: string;
    author: AuthorWithFollowers;
    votes: VoteRecord[];
    _count: { votes: number; comments: number };
};

export type AdmissionWithAuthor = Partial<PhdAdmission> & {
    id: string;
    createdAt: Date;
    deadline: Date;
    university: string;
    department: string;
    author: AuthorWithFollowers;
    votes: VoteRecord[];
    _count: { votes: number; comments: number };
};

export type EventWithAuthor = Partial<ResearchEvent> & {
    id: string;
    createdAt: Date;
    title: string;
    date: Date;
    location: string;
    author: AuthorWithFollowers;
    votes: VoteRecord[];
    _count: { votes: number; comments: number };
};

export type HelpPostWithAuthor = Partial<HelpPost> & {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    title: string;
    author: AuthorWithFollowers;
    votes: VoteRecord[];
    _count: { votes: number; comments: number };
};

export type ResearchToolWithAuthor = Partial<ResearchTool> & {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    name: string;
    description: string | null;
    author: AuthorWithFollowers;
    votes: VoteRecord[];
    _count: { votes: number; comments: number };
};

export type ResearchGrantWithAuthor = Partial<ResearchGrant> & {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    title: string;
    description: string;
    author: AuthorWithFollowers;
    votes: VoteRecord[];
    _count: { votes: number; comments: number };
};

export type CourseWithAuthor = Partial<Course> & {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    title: string;
    link: string;
    description: string;
    author: AuthorWithFollowers;
    votes: VoteRecord[];
    _count: { votes: number; comments: number };
};

export type JournalWithAuthor = Partial<Journal> & {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    author: AuthorWithFollowers;
    votes: VoteRecord[];
    _count: { votes: number; comments: number };
};

export type ResultWithAuthor = Partial<Result> & {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    title: string;
    type: string;
    description: string;
    author: AuthorWithFollowers;
    votes: VoteRecord[];
    _count: { votes: number; comments: number };
};

export type ContributionWithAuthor = Partial<Contribution> & {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    author: AuthorWithFollowers;
    votes: VoteRecord[];
    _count: { votes: number; comments: number };
};

export type PublicationWithAuthor = Partial<Publication> & {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    publicationType: string;
    author: AuthorWithFollowers;
    votes: VoteRecord[];
    _count: { votes: number; comments: number };
};

export type SurveyWithAuthor = Partial<ResearchSurvey> & {
    id: string;
    title: string;
    description: string | null;
    privacy: string;
    status: string;
    shareData: boolean;
    authorId: string;
    createdAt: Date;
    updatedAt: Date;
    author: AuthorWithFollowers;
    votes: VoteRecord[];
    _count: { votes: number; comments: number; responses: number };
};

export type SocialPostWithAuthor = Partial<SocialPost> & {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    author: AuthorWithFollowers;
    votes: VoteRecord[];
    _count: { votes: number; comments: number };
};

export type SupervisorWithAuthor = Partial<Supervisor> & {
    id: string;
    createdAt: Date;
    author: AuthorWithFollowers;
    recommendations: Recommendation[];
    votes: VoteRecord[];
    _count: { votes: number; comments: number };
};

export type RecommendationWithAuthor = Partial<Recommendation> & {
    id: string;
    createdAt: Date;
    updatedAt?: Date;
    rating: number;
    feedback: string;
    turnaroundTimeDays: number;
    responsivenessScore: number;
    guidanceScore: number;
    supervisorId: string;
    supervisor?: { id: string; name: string | null };
    author: AuthorWithFollowers;
    votes: VoteRecord[];
    _count: { votes: number; comments: number };
};
