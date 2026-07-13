
import { Article, JobVacancy, PhdAdmission, ResearchEvent, User, Supervisor, Recommendation, SocialPost, SocialLike, ArticleLike, JobVacancyLike, PhdAdmissionLike, ResearchEventLike, SupervisorLike } from "@prisma/client";

type TrendingItemBase = {
    score: number;
    _count: {
        likes: number;
        comments: number;
    };
    author: User;
    isLiked: boolean;
};

export type TrendingSupervisor = Supervisor & {
    recommendations: Recommendation[];
    score: number;
    type: 'supervisor';
    likes: SupervisorLike[];
    _count: {
        comments: number;
        likes: number;
    };
};

export type TrendingItem =
    | (JobVacancy & TrendingItemBase & { type: 'vacancy', likes: JobVacancyLike[] })
    | (PhdAdmission & TrendingItemBase & { type: 'admission', likes: PhdAdmissionLike[] })
    | (ResearchEvent & TrendingItemBase & { type: 'event', likes: ResearchEventLike[] })
    | (Article & TrendingItemBase & { type: 'article', likes: ArticleLike[] })
    | (SocialPost & TrendingItemBase & { type: 'social-post', likes: SocialLike[] })
    | TrendingSupervisor;
