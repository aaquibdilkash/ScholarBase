/**
 * Canonical moderation registry.
 *
 * Lives outside the `"use server"` action modules on purpose: a `use server`
 * file may only export async functions, and these maps also need to be
 * importable from tests so their key sets can be cross-checked.
 *
 * Every moderatable content type MUST appear in both `MODEL_MAP` and
 * `AUTHOR_COUNT_FIELD`, because the admin DELETE/RECOVER branches move the
 * author's reputation and materialized counter from these tables. A missing
 * key used to silently skip both (courses and research grants until
 * 2026-09-30); `test/security/admin-moderation-maps` now enforces the key
 * sets stay in lockstep.
 *
 * `SECTION_CONTENT_TYPES` (src/lib/adminConfig.ts) — what the admin UI
 * actually sends — must be a subset of these keys, or `moderateContent`
 * throws "Invalid content type" at click time.
 */

/** contentType -> Prisma model name (resolved against the transaction client). */
export const MODEL_MAP: Record<string, { model: string }> = {
  feed: { model: "socialPost" },
  blog: { model: "article" },
  publication: { model: "publication" },
  journal: { model: "journal" },
  researchTool: { model: "researchTool" },
  researchGrant: { model: "researchGrant" },
  course: { model: "course" },
  admission: { model: "phdAdmission" },
  event: { model: "researchEvent" },
  vacancy: { model: "jobVacancy" },
  help: { model: "helpPost" },
  result: { model: "result" },
  contribution: { model: "contribution" },
  supervisor: { model: "supervisor" },
  recommendation: { model: "recommendation" },
  survey: { model: "researchSurvey" },
  journalReview: { model: "journalReview" },
  SCHOLAR_PROFILE: { model: "user" },
};

/** Comment contentType -> Prisma comment model name. */
export const COMMENT_MODEL_MAP: Record<string, { model: string }> = {
  socialComment: { model: "socialComment" },
  articleComment: { model: "articleComment" },
  helpComment: { model: "helpPostComment" },
  contributionComment: { model: "contributionComment" },
  publicationComment: { model: "publicationComment" },
  researchToolComment: { model: "researchToolComment" },
  researchGrantComment: { model: "researchGrantComment" },
  courseComment: { model: "courseComment" },
  journalComment: { model: "journalComment" },
  journalReviewComment: { model: "journalReviewComment" },
  resultComment: { model: "resultComment" },
  surveyComment: { model: "surveyComment" },
  researchEventComment: { model: "researchEventComment" },
  admissionComment: { model: "phdAdmissionComment" },
  vacancyComment: { model: "jobVacancyComment" },
  supervisorComment: { model: "supervisorComment" },
  recommendationComment: { model: "recommendationComment" },
};

/**
 * Comment contentType -> the top-level content table + FK linking the comment
 * to it. Used to restore materialized `totalComments` / `totalReplies` counters
 * when a soft-deleted comment is recovered, and to resolve where a comment's
 * moderation notification should link.
 */
export const COMMENT_TOP_LEVEL: Record<string, { model: string; fk: string }> = {
  socialComment: { model: "socialPost", fk: "socialPostId" },
  articleComment: { model: "article", fk: "articleId" },
  helpComment: { model: "helpPost", fk: "helpPostId" },
  contributionComment: { model: "contribution", fk: "contributionId" },
  publicationComment: { model: "publication", fk: "publicationId" },
  researchToolComment: { model: "researchTool", fk: "researchToolId" },
  researchGrantComment: { model: "researchGrant", fk: "researchGrantId" },
  courseComment: { model: "course", fk: "courseId" },
  journalComment: { model: "journal", fk: "journalId" },
  journalReviewComment: { model: "journalReview", fk: "journalReviewId" },
  resultComment: { model: "result", fk: "resultId" },
  surveyComment: { model: "researchSurvey", fk: "surveyId" },
  researchEventComment: { model: "researchEvent", fk: "researchEventId" },
  admissionComment: { model: "phdAdmission", fk: "phdAdmissionId" },
  vacancyComment: { model: "jobVacancy", fk: "jobVacancyId" },
  supervisorComment: { model: "supervisor", fk: "supervisorId" },
  recommendationComment: { model: "recommendation", fk: "recommendationId" },
};

/**
 * Content types whose author counter is intentionally NOT incremented while
 * the row is anonymous — and therefore must not be decremented on delete /
 * restored on recover either. Reputation is still reversed for these: it is
 * vote-derived, and anonymous authors still earn votes.
 */
export const ANONYMOUS_CONTENT_TYPES = new Set(["recommendation", "journalReview"]);

/**
 * Materialized author counter per content type. `null` means the row IS the
 * user, so there is no counter to move.
 */
export const AUTHOR_COUNT_FIELD: Record<string, string | null> = {
  feed: "socialPostCount",
  blog: "articleCount",
  publication: "publicationCount",
  journal: "journalCount",
  researchTool: "researchToolCount",
  researchGrant: "researchGrantCount",
  course: "courseCount",
  admission: "phdAdmissionCount",
  event: "researchEventCount",
  vacancy: "jobVacancyCount",
  help: "helpPostCount",
  result: "resultCount",
  contribution: "contributionCount",
  supervisor: "supervisorCount",
  recommendation: "recommendationCount",
  survey: "surveyCount",
  journalReview: "journalReviewCount",
  SCHOLAR_PROFILE: null,
};

/**
 * contentType -> `targetType` key consumed by `getNotificationLink`
 * (src/lib/notification-links.ts). Must be a registered target there or the
 * moderation notification renders as a dead link.
 */
export const CONTENT_TARGET_TYPE: Record<string, string> = {
  // Top-level content
  feed: "post",
  blog: "article",
  publication: "publication",
  journal: "journal",
  researchTool: "researchTool",
  researchGrant: "researchGrant",
  course: "course",
  admission: "admission",
  event: "event",
  vacancy: "vacancy",
  help: "help",
  result: "result",
  contribution: "contribution",
  supervisor: "supervisor",
  recommendation: "recommendation",
  survey: "survey",
  journalReview: "journalReview",
  SCHOLAR_PROFILE: "profile",
  // Nested comments -> resource they belong to
  socialComment: "post",
  articleComment: "article",
  helpComment: "help",
  contributionComment: "contribution",
  publicationComment: "publication",
  researchToolComment: "researchTool",
  researchGrantComment: "researchGrant",
  courseComment: "course",
  journalComment: "journal",
  journalReviewComment: "journalReview",
  resultComment: "result",
  surveyComment: "survey",
  researchEventComment: "event",
  admissionComment: "admission",
  vacancyComment: "vacancy",
  supervisorComment: "supervisor",
  recommendationComment: "recommendation",
};

