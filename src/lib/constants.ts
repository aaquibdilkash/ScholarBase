export const MAX_ARTICLE_TITLE = 64;
export const MAX_ARTICLE_EXCERPT = 128;
export const MAX_ARTICLE_CONTENT = 8192;

export const MAX_PUBLICATION_TITLE = 64;
export const MAX_PUBLICATION_AUTHORS = 128;
export const MAX_PUBLICATION_JOURNAL = 64;
export const MAX_PUBLICATION_PUBLISHER = 64;
export const MAX_PUBLICATION_DOI = 32;
export const MAX_PUBLICATION_ISBN = 16;
export const MAX_PUBLICATION_URL = 128;
export const MAX_PUBLICATION_KEYWORDS = 256;
export const MAX_PUBLICATION_DOMAIN = 32;
export const MAX_PUBLICATION_ABSTRACT = 512;
export const MAX_PUBLICATION_VOLUME = 4;
export const MAX_PUBLICATION_ISSUE = 4;
export const MAX_PUBLICATION_PAGES = 8;

export const MAX_VACANCY_TITLE = 64;
export const MAX_VACANCY_INSTITUTION = 64;
export const MAX_VACANCY_NOTIFICATION_LINK = 128;
export const MAX_VACANCY_APPLY_LINK = 128;
export const MAX_VACANCY_DESCRIPTION = 256;

export const MAX_EVENT_TITLE = 64;
export const MAX_EVENT_LOCATION = 64;
export const MAX_EVENT_NOTIFICATION_LINK = 128;
export const MAX_EVENT_APPLY_LINK = 128;
export const MAX_EVENT_DESCRIPTION = 256;

export const MAX_HELP_POST_TITLE = 64;
export const MAX_HELP_POST_SUBJECT = 128;
export const MAX_HELP_POST_MESSAGE = 256;

export const MAX_JOURNAL_TITLE = 64;
export const MAX_JOURNAL_ISSN = 16;
export const MAX_JOURNAL_DESCRIPTION = 512;
export const MAX_JOURNAL_PUBLISHER = 64;
export const MAX_JOURNAL_WEBSITE = 128;
export const MAX_JOURNAL_IMPACT_FACTOR = 8;
export const MAX_JOURNAL_CITESCORE = 8;
export const MAX_JOURNAL_SJR_SCORE = 8;
export const MAX_JOURNAL_SUBJECT_AREA = 64;
export const MAX_JOURNAL_FREQUENCY = 16;

export const MAX_RESULT_TITLE = 64;
export const MAX_RESULT_CATEGORY = 32;
export const MAX_RESULT_CONDUCTING_BODY = 32;
export const MAX_RESULT_SESSION = 32;
export const MAX_RESULT_DESCRIPTION = 512;
export const MAX_RESULT_NOTIFICATION_LINK = 128;
export const MAX_RESULT_RESULT_LINK = 128;

export const MAX_SUPERVISOR_NAME = 32;
export const MAX_SUPERVISOR_UNIVERSITY = 32;
export const MAX_SUPERVISOR_DEPARTMENT = 32;
export const MAX_SUPERVISOR_ABOUT = 512;

export const MAX_RESEARCH_TOOL_NAME = 64;
export const MAX_RESEARCH_TOOL_DESCRIPTION = 512;
export const MAX_RESEARCH_TOOL_WEBSITE = 128;
export const MAX_RESEARCH_TOOL_USE = 64;

export const MAX_RESEARCH_GRANT_TITLE = 64;
export const MAX_RESEARCH_GRANT_AMOUNT = 16;
export const MAX_RESEARCH_GRANT_DESCRIPTION = 512;
export const MAX_RESEARCH_GRANT_APPLY_LINK = 128;
export const MAX_RESEARCH_GRANT_INFO_LINK = 128;

export const MAX_COURSE_TITLE = 64;
export const MAX_COURSE_PROVIDER = 32;
export const MAX_COURSE_INSTRUCTOR = 32;
export const MAX_COURSE_FORMAT = 16;
export const MAX_COURSE_LEVEL = 16;
export const MAX_COURSE_PRICE = 8;
export const MAX_COURSE_DURATION = 16;
export const MAX_COURSE_URL = 128;
export const MAX_COURSE_DESCRIPTION = 512;

export const MAX_SURVEY_TITLE = 64;
export const MAX_SURVEY_DESCRIPTION = 512;
export const MAX_SURVEY_QUESTION_TITLE = 128;
export const MAX_SURVEY_QUESTION_OPTION = 64;
export const MAX_SURVEY_ANSWER_SHORT = 64;
export const MAX_SURVEY_ANSWER_LONG = 512;

export const MAX_REJECTION_REASON = 64;
export const MAX_REPORT_DETAILS = 256;
export const MAX_APPEAL_REASON = 256;

// Structured appeal categories — single source of truth shared by the
// AppealButton UI and the `AppealReason` Prisma enum (schema.prisma).
// Keep the values in sync with the enum.
export const APPEAL_CATEGORIES = [
  {
    value: "MISTAKEN_MODERATION",
    label: "Mistaken Moderation",
    description: "I believe my content was moderated in error",
  },
  {
    value: "CONTEXT_MISSING",
    label: "Context Missing",
    description: "The moderation did not consider important context",
  },
  {
    value: "POLICY_CLARIFICATION",
    label: "Policy Clarification",
    description: "I believe my content does not violate the policy",
  },
  { value: "OTHER", label: "Other", description: "Something else" },
] as const;

export type AppealCategory = (typeof APPEAL_CATEGORIES)[number]["value"];

export const MAX_RECOMMENDATION_FEEDBACK = 512;

export const MAX_ADMISSION_UNIVERSITY = 64;
export const MAX_ADMISSION_DEPARTMENT = 64;
export const MAX_ADMISSION_DESCRIPTION = 512;
export const MAX_ADMISSION_NOTIFICATION_LINK = 128;
export const MAX_ADMISSION_APPLY_LINK = 128;

export const MAX_PROFILE_NAME = 32;
export const MAX_PROFILE_HANDLE = 16;
export const MAX_PROFILE_BIO = 512;
export const MAX_PROFILE_URL = 128;

export const MAX_CONTACT_NAME = 32;
export const MAX_CONTACT_EMAIL = 64;
export const MAX_CONTACT_SUBJECT = 64;
export const MAX_CONTACT_MESSAGE = 512;

export const MAX_INVITE_NAME = 32;
export const MAX_INVITE_EMAIL = 64;
export const MAX_INVITE_MESSAGE = 512;

export const MAX_AUTH_EMAIL = 32;
export const MAX_AUTH_PASSWORD = 16;

export const MAX_CONTRIBUTION_TITLE = 64;
export const MAX_CONTRIBUTION_UPI_ID = 64;
export const MAX_CONTRIBUTION_MESSAGE = 512;

export const MAX_SOCIAL_POST_CONTENT = 256;

export const MAX_MESSAGE_BODY = 128;

export const MAX_COMMENT_BODY = 256;

// Shallow page size for lazy comment/reply pagination (see fetchParentComments /
// fetchReplies in src/app/actions/comments.ts). Lives here because "use server"
// files may only export async functions.
export const COMMENT_PAGE_SIZE = 5;

// Rows per page in the admin panel tables (feeds, comments, users).
export const ADMIN_PAGE_SIZE = 10;

// Map ReportModule values to the contentType keys expected by moderateContent
// and the admin content fetchers. Shared between client and server code so
// it lives in a plain module (not a "use server" file).
export const MODULE_TO_CONTENT_TYPE: Record<string, string> = {
  SOCIAL_FEED: "feed",
  ARTICLE_PAGE: "blog",
  PUBLICATION: "publication",
  JOURNAL: "journal",
  RESEARCH_TOOL: "researchTool",
  RESEARCH_GRANT: "researchGrant",
  COURSE: "course",
  RESULT: "result",
  CONTRIBUTION: "contribution",
  HELP_POST: "help",
  RESEARCH_EVENT: "event",
  PHD_ADMISSION: "admission",
  JOB_VACANCY: "vacancy",
  SUPERVISOR: "supervisor",
  RECOMMENDATION: "recommendation",
  RESEARCH_SURVEY: "survey",
  SCHOLAR_PROFILE: "SCHOLAR_PROFILE",
  SOCIAL_COMMENT: "socialComment",
  ARTICLE_COMMENT: "articleComment",
  HELP_COMMENT: "helpComment",
  CONTRIBUTION_COMMENT: "contributionComment",
  PUBLICATION_COMMENT: "publicationComment",
  RESEARCH_TOOL_COMMENT: "researchToolComment",
  RESEARCH_GRANT_COMMENT: "researchGrantComment",
  COURSE_COMMENT: "courseComment",
  JOURNAL_COMMENT: "journalComment",
  RESULT_COMMENT: "resultComment",
  SURVEY_COMMENT: "surveyComment",
  RESEARCH_EVENT_COMMENT: "researchEventComment",
  PHD_ADMISSION_COMMENT: "admissionComment",
  JOB_VACANCY_COMMENT: "vacancyComment",
  SUPERVISOR_COMMENT: "supervisorComment",
  RECOMMENDATION_COMMENT: "recommendationComment",
};