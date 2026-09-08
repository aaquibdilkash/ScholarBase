/**
 * Shared metadata for profile content sections.
 *
 * The Prisma models still need separate queries because their selected fields
 * are not identical, but the section-to-model mapping belongs in one place.
 */
export const PROFILE_SECTION_CONFIG = {
  articles: { model: "article" },
  socialPosts: { model: "socialPost" },
  vacancies: { model: "jobVacancy" },
  admissions: { model: "phdAdmission" },
  events: { model: "researchEvent" },
  helpPosts: { model: "helpPost" },
  journals: { model: "journal" },
  researchTools: { model: "researchTool" },
  recommendations: { model: "recommendation" },
  supervisors: { model: "supervisor" },
  results: { model: "result" },
  contributionPosts: { model: "contribution" },
  publications: { model: "publication" },
  surveys: { model: "researchSurvey" },
  researchGrants: { model: "researchGrant" },
  courses: { model: "course" },
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
