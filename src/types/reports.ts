/**
 * Shared report-related types used across the reporting UI and server actions.
 *
 * entityType is intentionally coarse-grained ("POST" vs "COMMENT") because
 * the actual Prisma model is resolved from the `module` field on the server
 * side — see MODULE_MODEL_MAP in src/app/actions/reports.ts.
 */

/**
 * Coarse-grained category of entity being reported.
 */
export type ReportEntityType = "POST" | "COMMENT";

/**
 * The module/context from which a report originates.
 * Used for analytics routing and to resolve the correct Prisma delegate
 * inside the submitReport / moderateContent server actions.
 */
export type ReportModule =
  | "SOCIAL_FEED"
  | "SOCIAL_COMMENT"
  | "ARTICLE_PAGE"
  | "ARTICLE_COMMENT"
  | "HELP_COMMENT"
  | "CONTRIBUTION_COMMENT"
  | "PUBLICATION_COMMENT"
  | "RESEARCH_TOOL_COMMENT"
  | "RESEARCH_GRANT_COMMENT"
  | "COURSE_COMMENT"
  | "JOURNAL_COMMENT"
  | "RESULT_COMMENT"
  | "SURVEY_COMMENT"
  | "RESEARCH_EVENT_COMMENT"
  | "PHD_ADMISSION_COMMENT"
  | "JOB_VACANCY_COMMENT"
  | "SUPERVISOR_COMMENT"
  | "RECOMMENDATION_COMMENT"
  | "RECOMMENDATION"
  | "SUPERVISOR"
  | "SCHOLAR_PROFILE"
  | "PUBLICATION"
  | "JOURNAL"
  | "RESEARCH_TOOL"
  | "RESEARCH_GRANT"
  | "COURSE"
  | "RESULT"
  | "CONTRIBUTION"
  | "HELP_POST"
  | "RESEARCH_EVENT"
  | "PHD_ADMISSION"
  | "JOB_VACANCY"
  | "RESEARCH_SURVEY";

/**
 * Lifecycle state of a report row in the database.
 */
export type ReportStatus = "PENDING" | "DISMISSED" | "RESOLVED";

/**
 * Standardised report reasons surfaced to users in the ReportModal.
 */
export type ReportReason =
  | "SPAM"
  | "HARASSMENT"
  | "PLAGIARISM"
  | "MISINFORMATION"
  | "OFF_TOPIC"
  | "COPYRIGHT"
  | "OTHER";

/**
 * The full Report entity as returned from the server.
 */
export interface Report {
  id: string;
  entityId: string;
  entityType: ReportEntityType;
  module: ReportModule;
  reason: ReportReason;
  details: string | null;
  reporterId: string;
  status: ReportStatus;
  createdAt: Date;
}

/**
 * Action types that can be dispatched through the `moderateContent` server
 * action from the AdminActionsDropdown.
 */
export type ModerationAction =
  | "FREEZE"
  | "UNFREEZE"
  | "DELETE"
  | "RECOVER"
  | "DISMISS_REPORTS"
  | "DISMISS_APPEAL";
