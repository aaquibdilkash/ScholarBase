/**
 * Shared metadata for profile content sections.
 *
 * The Prisma models still need separate queries because their selected fields
 * are not identical, but the section-to-model mapping belongs in one place.
 */
export const PROFILE_SECTION_CONFIG = {
  articles: { model: "article", bookmarkModel: "articleBookmark", bookmarkParent: "article" },
  socialPosts: { model: "socialPost", bookmarkModel: "socialPostBookmark", bookmarkParent: "socialPost" },
  vacancies: { model: "jobVacancy", bookmarkModel: "jobVacancyBookmark", bookmarkParent: "jobVacancy" },
  admissions: { model: "phdAdmission", bookmarkModel: "phdAdmissionBookmark", bookmarkParent: "phdAdmission" },
  events: { model: "researchEvent", bookmarkModel: "researchEventBookmark", bookmarkParent: "researchEvent" },
  helpPosts: { model: "helpPost", bookmarkModel: "helpPostBookmark", bookmarkParent: "helpPost" },
  journals: { model: "journal", bookmarkModel: "journalBookmark", bookmarkParent: "journal" },
  researchTools: { model: "researchTool", bookmarkModel: "researchToolBookmark", bookmarkParent: "researchTool" },
  recommendations: { model: "recommendation", bookmarkModel: "recommendationBookmark", bookmarkParent: "recommendation" },
  supervisors: { model: "supervisor", bookmarkModel: "supervisorBookmark", bookmarkParent: "supervisor" },
  results: { model: "result", bookmarkModel: "resultBookmark", bookmarkParent: "result" },
  contributionPosts: { model: "contribution", bookmarkModel: "contributionBookmark", bookmarkParent: "contribution" },
  publications: { model: "publication", bookmarkModel: "publicationBookmark", bookmarkParent: "publication" },
  surveys: { model: "researchSurvey", bookmarkModel: "surveyBookmark", bookmarkParent: "researchSurvey" },
  researchGrants: { model: "researchGrant", bookmarkModel: "researchGrantBookmark", bookmarkParent: "researchGrant" },
  courses: { model: "course", bookmarkModel: "courseBookmark", bookmarkParent: "course" },
} as const;

export type ProfileSection = keyof typeof PROFILE_SECTION_CONFIG;

/** Allowlisted parent tables used by maintenance jobs. */
export const CONTENT_TABLES = [
  "Article",
  "SocialPost",
  "HelpPost",
  "Contribution",
  "Publication",
  "ResearchTool",
  "ResearchGrant",
  "Course",
  "Journal",
  "Result",
  "ResearchSurvey",
  "ResearchEvent",
  "PhdAdmission",
  "JobVacancy",
  "Recommendation",
] as const;
