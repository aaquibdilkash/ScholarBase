import { Article, JobVacancy, PhdAdmission, ResearchEvent, User, Supervisor, Recommendation, SocialPost, HelpPost, Result } from "@prisma/client";

type TrendingItemBase = {
    score: number;
    _count: {
        votes: number;
        comments: number;
    };
    author: User;
    votes: any[];
};

export type TrendingSupervisor = Supervisor & {
    author: User;
    recommendations: Recommendation[];
    score: number;
    type: 'supervisor';
    votes: any[];
    _count: {
        comments: number;
        votes: number;
    };
};

export type TrendingItem =
    | (JobVacancy & TrendingItemBase & { type: 'vacancy' })
    | (PhdAdmission & TrendingItemBase & { type: 'admission' })
    | (ResearchEvent & TrendingItemBase & { type: 'event' })
    | (Article & TrendingItemBase & { type: 'article' })
    | (SocialPost & TrendingItemBase & { type: 'social-post' })
    | (import("@prisma/client").Journal & TrendingItemBase & { type: 'journal' })
    | (import("@prisma/client").ResearchTool & TrendingItemBase & { type: 'researchTool' })
    | (HelpPost & TrendingItemBase & { type: 'help-post' })
    | (Result & TrendingItemBase & { type: 'result' })
    | TrendingSupervisor;
