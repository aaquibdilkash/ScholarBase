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

export type AdminContentItem = {
  id: string;
  title?: string | null;
  name?: string | null;
  email?: string | null;
  content?: string | null;
  detailHref?: string;
  isFrozen?: boolean;
  status?: string;
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
    orderBy: { createdAt: 'desc' }
  }) => Promise<ContentItem[]>
}

export interface ContentMap {
  [key: string]: {
    model: ContentModel
    detailHref: (item: ContentItem) => string
  }
}
