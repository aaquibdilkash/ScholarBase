import { Article, JobVacancy, PhdAdmission, ResearchEvent, User, Supervisor, Recommendation, SocialPost, HelpPost, Result, ResearchSurvey, User as Scholar } from "@prisma/client";
import type { VoteType } from "./votes";

export type TrendingItemType =
    | 'vacancy'
    | 'admission'
    | 'event'
    | 'article'
    | 'social-post'
    | 'journal'
    | 'researchTool'
    | 'help-post'
    | 'result'
    | 'contribution'
    | 'publication'
    | 'survey'
    | 'supervisor'
    | 'scholar';

type TrendingItemBase = {
    score: number;
    _count: {
        votes: number;
        comments: number;
    };
    author: User;
    votes: { userId: string; voteType: VoteType }[];
};

export type TrendingSupervisor = Supervisor & {
    author: User;
    recommendations: Recommendation[];
    score: number;
    type: 'supervisor';
    votes: { userId: string; voteType: VoteType }[];
    _count: {
        comments: number;
        votes: number;
    };
};

/** Raw supervisor row fetched in `getTrendingSupervisors` before scoring. */
export type SupervisorWithVotesAndRecommendations = Supervisor & {
    author: User;
    recommendations: Recommendation[];
    votes: { userId: string; voteType: VoteType }[];
    _count: {
        comments: number;
        votes: number;
    };
};

export type TrendingScholar = Scholar & {
    score: number;
    type: 'scholar';
    _count: {
        followers: number;
        following: number;
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
    | (import("@prisma/client").Contribution & TrendingItemBase & { type: 'contribution' })
    | (import("@prisma/client").Publication & TrendingItemBase & { type: 'publication' })
    | (ResearchSurvey & TrendingItemBase & { type: 'survey' })
    | TrendingSupervisor
    | TrendingScholar;
