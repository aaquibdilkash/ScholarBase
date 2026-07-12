
import { Article, JobVacancy, PhdAdmission, ResearchEvent, User, Supervisor, Recommendation, SocialPost } from "@prisma/client";

type TrendingItemBase = {
    score: number;
    _count: {
        likes: number;
        comments: number;
    };
    author: User;
    isLiked: boolean;
};

export type TrendingSupervisor = Omit<Supervisor, 'createdAt'> & {
    recommendations: Recommendation[];
    score: number;
    type: 'supervisor';
};

export type TrendingItem =
    | (Omit<JobVacancy, 'authorId'> & TrendingItemBase & { type: 'vacancy' })
    | (Omit<PhdAdmission, 'authorId'> & TrendingItemBase & { type: 'admission' })
    | (Omit<ResearchEvent, 'authorId'> & TrendingItemBase & { type: 'event' })
    | (Omit<Article, 'authorId'> & TrendingItemBase & { type: 'article' })
    | (Omit<SocialPost, 'authorId'> & TrendingItemBase & { type: 'social-post' })
    | TrendingSupervisor;
