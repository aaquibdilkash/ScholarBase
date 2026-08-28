import {
  Article,
  Contribution,
  HelpPost,
  JobVacancy,
  Journal,
  PhdAdmission,
  Publication,
  Recommendation,
  ResearchEvent,
  ResearchSurvey,
  ResearchTool,
  Result,
  SocialPost,
  Supervisor,
  User,
  ArticleComment,
  SocialComment,
  HelpPostComment,
  ContributionComment,
  PublicationComment,
  ResearchToolComment,
  ResearchGrantComment,
  CourseComment,
  JournalComment,
  ResultComment,
  SurveyComment,
  ResearchEventComment,
  PhdAdmissionComment,
  JobVacancyComment,
  SupervisorComment,
  RecommendationComment,
} from '@prisma/client'

export interface FreezableContentModel {
  findUnique: (args: {
    where: { id: string }
    select: { isFrozen: boolean }
  }) => Promise<{ isFrozen: boolean } | null>
  update: (args: {
    where: { id: string }
    data: { isFrozen: boolean }
  }) => Promise<unknown>
}

export interface DeleteableContentModel {
  update: (args: {
    where: { id: string }
    data: { isDeleted: boolean }
  }) => Promise<unknown>
}

export interface DeleteMapValue {
  model: DeleteableContentModel
  path: string
}

export interface CommentModel {
  update: (args: {
    where: { id: string }
    data: { content: string; authorId: null }
  }) => Promise<unknown>
}

/**
 * Union of all comment models. Comments are authored-optional (tombstoning
 * sets authorId to null), so the included author is `User | null`.
 */
export type CommentItem =
  | SocialComment
  | ArticleComment
  | HelpPostComment
  | ContributionComment
  | PublicationComment
  | ResearchToolComment
  | ResearchGrantComment
  | CourseComment
  | JournalComment
  | ResultComment
  | SurveyComment
  | ResearchEventComment
  | PhdAdmissionComment
  | JobVacancyComment
  | SupervisorComment
  | RecommendationComment

export type ContentItem =
  | (Article & { author: User })
  | (Recommendation & { author: User })
  | (SocialPost & { author: User })
  | (Publication & { author: User })
  | (Journal & { author: User })
  | (ResearchTool & { author: User })
  | (PhdAdmission & { author: User })
  | (ResearchEvent & { author: User })
  | (JobVacancy & { author: User })
  | (HelpPost & { author: User })
  | (Result & { author: User })
  | (Contribution & { author: User })
  | (Supervisor & { author: User })
  | (ResearchSurvey & { author: User })
  | (CommentItem & { author: User | null })

/**
 * Loosely-typed delegate for the comment tables used by the admin
 * "Comments" view. Each comment model is a separate Prisma table, so the
 * delegates are cast to this common shape.
 */
export interface AdminCommentModel {
  findMany: (args: {
    include: { author: true }
    orderBy: { createdAt: 'desc' | 'asc' } | { reportCount: 'desc' | 'asc' }
    take?: number
    skip?: number
    where?: Record<string, unknown>
  }) => Promise<ContentItem[]>
}

/** Paginated envelope returned by admin list actions (10 rows per page). */
export interface AdminPage<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type AdminContentItem = {
  id: string;
  title?: string | null;
  name?: string | null;
  email?: string | null;
  content?: string | null;
  detailHref?: string;
  isFrozen?: boolean;
  /** Soft-delete flag (RULE 4) — true means the content is tombstoned. */
  isDeleted?: boolean;
  status?: string;
  /** Materialized report counter (RULE 2) used to surface highly reported items. */
  reportCount?: number;
  /** For comment rows: the Prisma model key used to route moderation actions. */
  modelKey?: string;
  author?: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  [key: string]: unknown;
}

export interface ContentModel {
  findMany: (args: {
    include: { author: true }
    orderBy: { createdAt: "desc" | "asc" } | { reportCount: "desc" | "asc" }
    take?: number
    skip?: number
    where?: Record<string, unknown>
  }) => Promise<ContentItem[]>
}

export interface ContentMap {
  [key: string]: {
    model: ContentModel
    detailHref: (item: ContentItem) => string
  }
}
