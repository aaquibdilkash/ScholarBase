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
    data: { isDeleted?: boolean; isFrozen?: boolean }
  }) => Promise<unknown>
}

/**
 * Union of all comment models. Comments are soft-deleted (isDeleted toggle,
 * RULE 4) with a REQUIRED authorId — the author relation is always intact.
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
  | (CommentItem & { author: User })

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
  /** Pending appeal reason from the owner — null when no active appeal. */
  appealReason?: string | null;
  author?: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  /** Appeals-specific: the underlying content entity ID (not the appeal row ID). */
  entityId?: string;
  /** Appeals-specific: POST or COMMENT. */
  entityType?: string;
  /** Appeals-specific: ReportModule value stored on the appeal row. */
  module?: string;
  /** Appeals-specific: resolved contentType key for moderateContent. */
  contentType?: string;
  /** Appeals-specific: the owner who submitted the appeal. */
  owner?: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  [key: string]: unknown;
}

/** Appeal row shown in the admin Appeals section. */
export type AdminAppealItem = {
  id: string;
  entityId: string;
  entityType: string;
  module: string;
  /** Resolved contentType key for moderateContent (e.g. feed, socialComment). */
  contentType?: string;
  /** Link to the appealed entity's detail page (empty for comments). */
  detailHref?: string;
  status: "PENDING" | "ACTIONED" | "DISMISSED";
  /** Structured appeal category (AppealReason enum). */
  category?: string;
  /** Free-text details (backfilled from the legacy `reason` column). */
  details: string | null;
  ownerId: string;
  owner: { id: string; name: string | null; email: string | null } | null;
  reviewedBy: { id: string; name: string | null } | null;
  reviewedById: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  hasActiveAppeal: boolean;
  /** Pending appeal reason (mirrors content rows) — null when reviewed. */
  appealReason?: string | null;
  /** Live moderation state of the appealed entity. */
  entityStatus?: "ACTIVE" | "FROZEN" | "DELETED";
};

/** A single Report row joined with the reporter's profile, surfaced in the
 *  admin inspection drawer so moderators see WHO reported what and WHY. */
export type ReportWithReporter = {
  id: string;
  entityId: string;
  entityType: string;
  module: string;
  category: string;
  details: string | null;
  status: "PENDING" | "DISMISSED" | "RESOLVED";
  createdAt: Date;
  reporter: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
};

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
