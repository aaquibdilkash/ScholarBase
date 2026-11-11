/**
 * Text projections for the semantic embedding worker.
 *
 * Every entity type maps to the content columns that feed its vector. The same
 * field lists are the trigger column lists in
 * `prisma/migrations/20261101000000_semantic_embeddings/migration.sql`;
 * `test/semantic/embedding-migration.test.ts` compares the two so adding a
 * field to a builder without wiring the trigger fails the suite.
 *
 * Recommendation and JournalReview are the exception: their own trigger only
 * watches `feedback`, while the builder also reads parent context (supervisor
 * or journal) at embed time. A parent rename does not re-enqueue the child
 * until the feedback is edited; see docs/semantic-embeddings.md.
 *
 * These vectors are recommendation inputs only. Search never uses them; the
 * list search bars stay on trigram + tsvector indexes.
 */
import { stripHtmlTags } from "@/lib/html";

export type EmbeddingEntityType =
  | "SCHOLAR"
  | "SOCIAL_POST"
  | "PUBLICATION"
  | "ARTICLE"
  | "HELP_POST"
  | "CONTRIBUTION"
  | "RESEARCH_TOOL"
  | "RESEARCH_GRANT"
  | "COURSE"
  | "JOURNAL"
  | "RESULT"
  | "RESEARCH_SURVEY"
  | "CALL_FOR_PAPER"
  | "ADMISSION"
  | "ACADEMIC_POSITION"
  | "SUPERVISOR"
  | "RECOMMENDATION"
  | "JOURNAL_REVIEW";

/**
 * Entity type -> physical table. Whitelisted table names only; the worker and
 * the related-content query interpolate this map through `Prisma.raw`, never
 * user input.
 */
export const EMBEDDING_TABLES = {
  SCHOLAR: "User",
  SOCIAL_POST: "SocialPost",
  PUBLICATION: "Publication",
  ARTICLE: "Article",
  HELP_POST: "HelpPost",
  CONTRIBUTION: "Contribution",
  RESEARCH_TOOL: "ResearchTool",
  RESEARCH_GRANT: "ResearchGrant",
  COURSE: "Course",
  JOURNAL: "Journal",
  RESULT: "Result",
  RESEARCH_SURVEY: "ResearchSurvey",
  CALL_FOR_PAPER: "CallForPaper",
  ADMISSION: "Admission",
  ACADEMIC_POSITION: "AcademicPosition",
  SUPERVISOR: "Supervisor",
  RECOMMENDATION: "Recommendation",
  JOURNAL_REVIEW: "JournalReview",
} as const satisfies Record<EmbeddingEntityType, string>;

/**
 * Columns watched by each table's enqueue trigger. These are exactly the
 * columns each builder reads from the row itself; relation context is not
 * trigger-watched.
 */
export const EMBEDDING_TRIGGER_FIELDS = {
  SCHOLAR: ["name", "handle", "bio", "interests"],
  SOCIAL_POST: ["content"],
  PUBLICATION: [
    "title",
    "authors",
    "keywords",
    "domain",
    "journalOrConference",
    "abstract",
  ],
  ARTICLE: ["title", "excerpt", "content"],
  HELP_POST: ["title", "subject", "category", "message"],
  CONTRIBUTION: ["title", "message"],
  RESEARCH_TOOL: ["name", "use", "description"],
  RESEARCH_GRANT: ["title", "description"],
  COURSE: ["title", "provider", "instructor", "format", "level", "description"],
  JOURNAL: ["title", "publisher", "about", "subjectArea"],
  RESULT: ["title", "description", "category", "conductingBody", "session"],
  RESEARCH_SURVEY: ["title", "description"],
  CALL_FOR_PAPER: ["title", "category", "eventDate", "location", "description"],
  ADMISSION: ["university", "department", "level", "description"],
  ACADEMIC_POSITION: [
    "title",
    "institution",
    "department",
    "subject",
    "positionType",
    "employmentType",
    "salaryOrStipend",
    "contractDuration",
    "location",
    "description",
  ],
  SUPERVISOR: ["name", "university", "department", "about"],
  RECOMMENDATION: ["feedback"],
  JOURNAL_REVIEW: ["feedback"],
} as const satisfies Record<EmbeddingEntityType, readonly string[]>;

export type ScholarTextSource = {
  name: string | null;
  handle: string | null;
  bio: string | null;
  interests: string | null;
};

export type SocialPostTextSource = {
  content: string;
};

export type PublicationTextSource = {
  title: string;
  authors: string;
  keywords: string | null;
  domain: string | null;
  journalOrConference: string | null;
  abstract: string | null;
};

export type ArticleTextSource = {
  title: string;
  excerpt: string | null;
  content: string;
};

export type HelpPostTextSource = {
  title: string;
  subject: string;
  category: string;
  message: string;
};

export type ContributionTextSource = {
  title: string;
  message: string;
};

export type ResearchToolTextSource = {
  name: string;
  use: string;
  description: string;
};

export type ResearchGrantTextSource = {
  title: string;
  description: string;
};

export type CourseTextSource = {
  title: string;
  provider: string | null;
  instructor: string | null;
  format: string | null;
  level: string | null;
  description: string;
};

export type JournalTextSource = {
  title: string;
  publisher: string | null;
  about: string | null;
  subjectArea: string | null;
};

export type ResultTextSource = {
  title: string;
  description: string;
  category: string | null;
  conductingBody: string | null;
  session: string | null;
};

export type ResearchSurveyTextSource = {
  title: string;
  description: string | null;
};

export type CallForPaperTextSource = {
  title: string;
  category?: string;
  eventDate?: Date | null;
  location: string | null;
  description: string;
};

export type AdmissionTextSource = {
  university: string;
  department: string;
  level?: string | null;
  description: string;
};

export type AcademicPositionTextSource = {
  title: string;
  institution: string;
  department: string | null;
  subject: string | null;
  positionType?: string | null;
  employmentType?: string | null;
  salaryOrStipend?: string | null;
  contractDuration?: string | null;
  location?: string | null;
  description: string;
};

export type SupervisorTextSource = {
  name: string;
  university: string;
  department: string;
  about: string | null;
};

export type RecommendationTextSource = {
  feedback: string;
  supervisor: {
    name: string | null;
    university: string | null;
    department: string | null;
    about: string | null;
  } | null;
};

export type JournalReviewTextSource = {
  feedback: string;
  journal: {
    title: string | null;
    publisher: string | null;
    subjectArea: string | null;
    about: string | null;
  } | null;
};

function clean(value: unknown): string {
  return typeof value === "string" ? stripHtmlTags(value) : "";
}

function joinValues(values: readonly unknown[]): string {
  return values.map(clean).filter(Boolean).join("\n");
}

function joinFields<T extends Record<string, unknown>>(
  source: T,
  fields: readonly (keyof T & string)[],
): string {
  return joinValues(fields.map((field) => source[field]));
}

export function buildScholarText(source: ScholarTextSource): string {
  return joinFields(source, EMBEDDING_TRIGGER_FIELDS.SCHOLAR);
}

export function buildSocialPostText(source: SocialPostTextSource): string {
  return joinFields(source, EMBEDDING_TRIGGER_FIELDS.SOCIAL_POST);
}

export function buildPublicationText(source: PublicationTextSource): string {
  return joinFields(source, EMBEDDING_TRIGGER_FIELDS.PUBLICATION);
}

export function buildArticleText(source: ArticleTextSource): string {
  return joinFields(source, EMBEDDING_TRIGGER_FIELDS.ARTICLE);
}

export function buildHelpPostText(source: HelpPostTextSource): string {
  return joinFields(source, EMBEDDING_TRIGGER_FIELDS.HELP_POST);
}

export function buildContributionText(source: ContributionTextSource): string {
  return joinFields(source, EMBEDDING_TRIGGER_FIELDS.CONTRIBUTION);
}

export function buildResearchToolText(source: ResearchToolTextSource): string {
  return joinFields(source, EMBEDDING_TRIGGER_FIELDS.RESEARCH_TOOL);
}

export function buildResearchGrantText(source: ResearchGrantTextSource): string {
  return joinFields(source, EMBEDDING_TRIGGER_FIELDS.RESEARCH_GRANT);
}

export function buildCourseText(source: CourseTextSource): string {
  return joinFields(source, EMBEDDING_TRIGGER_FIELDS.COURSE);
}

export function buildJournalText(source: JournalTextSource): string {
  return joinFields(source, EMBEDDING_TRIGGER_FIELDS.JOURNAL);
}

export function buildResultText(source: ResultTextSource): string {
  return joinFields(source, EMBEDDING_TRIGGER_FIELDS.RESULT);
}

export function buildResearchSurveyText(
  source: ResearchSurveyTextSource,
): string {
  return joinFields(source, EMBEDDING_TRIGGER_FIELDS.RESEARCH_SURVEY);
}

export function buildCallForPaperText(
  source: CallForPaperTextSource,
): string {
  return joinFields(source, EMBEDDING_TRIGGER_FIELDS.CALL_FOR_PAPER);
}

export function buildAdmissionText(
  source: AdmissionTextSource,
): string {
  return joinFields(source, EMBEDDING_TRIGGER_FIELDS.ADMISSION);
}

export function buildAcademicPositionText(source: AcademicPositionTextSource): string {
  return joinFields(source, EMBEDDING_TRIGGER_FIELDS.ACADEMIC_POSITION);
}

export function buildSupervisorText(source: SupervisorTextSource): string {
  return joinFields(source, EMBEDDING_TRIGGER_FIELDS.SUPERVISOR);
}

export function buildRecommendationText(
  source: RecommendationTextSource,
): string {
  return joinValues([
    source.feedback,
    source.supervisor?.name,
    source.supervisor?.university,
    source.supervisor?.department,
    source.supervisor?.about,
  ]);
}

export function buildJournalReviewText(source: JournalReviewTextSource): string {
  return joinValues([
    source.feedback,
    source.journal?.title,
    source.journal?.publisher,
    source.journal?.subjectArea,
    source.journal?.about,
  ]);
}
