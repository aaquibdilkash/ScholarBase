/**
 * ZERO-COMPUTE TRENDING
 * ---------------------
 * Trending items are ranked by the pre-computed `trendingScore` column that a
 * background cron job refreshes (see src/app/api/cron/trending). Reads never
 * compute scores on the fly and never run relational `_count` aggregations —
 * the materialized `totalVotes`/`totalComments` columns are returned directly.
 *
 * Caching
 * -------
 * Each tab is a `unstable_cache`d, viewer-agnostic top-N batch plus the shared
 * live overlay, so the read costs one indexed statement instead of a full
 * `findMany` on every navigation. The overlay is not optional: a cached batch
 * has no viewer's vote, bookmark or follow state in it, and `stitchLiveState`
 * puts those back before the card ever sees them.
 *
 * The batch is purged by the same funnel that purges the All tab
 * (`revalidateContent` and siblings), so a publish, edit, freeze or delete
 * cannot leave a deleted row sitting in a Trending tab. The 5-minute TTL
 * (`LIST_REVALIDATE_SECONDS`) is then only a backstop — for the score ordering
 * the cron rewrites, which is refreshed on its own schedule anyway.
 *
 * Every `getTrending*` function here takes no arguments. The viewer is resolved
 * from the session inside the loader, which is what stops a caller from
 * rendering another user's vote or follow state.
 */
import { createContentTrending, createScholarsTrending } from "@/lib/tri-split/trending";

export type TrendingItem = Record<string, unknown>;

const loaders = {
  articles: createContentTrending({
    module: "ARTICLE",
    tag: "articles",
    type: "article",
    // RULE 4 / moderation: an unpublished draft is not trending content.
    where: { published: true },
  }),
  socialPosts: createContentTrending({
    module: "SOCIAL_POST",
    tag: "feed",
    type: "social-post",
  }),
  vacancies: createContentTrending({
    module: "JOB_VACANCY",
    tag: "vacancies",
    type: "vacancy",
  }),
  admissions: createContentTrending({
    module: "PHD_ADMISSION",
    tag: "admissions",
    type: "admission",
  }),
  events: createContentTrending({
    module: "RESEARCH_EVENT",
    tag: "events",
    type: "event",
  }),
  journals: createContentTrending({
    module: "JOURNAL",
    tag: "journals",
    type: "journal",
  }),
  researchTools: createContentTrending({
    module: "RESEARCH_TOOL",
    tag: "research-tools",
    type: "researchTool",
  }),
  helpPosts: createContentTrending({
    module: "HELP_POST",
    tag: "help",
    type: "help-post",
  }),
  results: createContentTrending({
    module: "RESULT",
    tag: "results",
    type: "result",
  }),
  publications: createContentTrending({
    module: "PUBLICATION",
    tag: "publications",
    type: "publication",
  }),
  contributions: createContentTrending({
    module: "CONTRIBUTION",
    tag: "contributions",
    type: "contribution",
    // Only approved contributions are public; the rest stay out of trending too.
    where: { status: "APPROVED" },
  }),
  surveys: createContentTrending({
    module: "RESEARCH_SURVEY",
    tag: "surveys",
    type: "survey",
  }),
  grants: createContentTrending({
    module: "RESEARCH_GRANT",
    tag: "grants",
    type: "grant",
  }),
  courses: createContentTrending({
    module: "COURSE",
    tag: "courses",
    type: "course",
  }),
  supervisors: createContentTrending({
    module: "SUPERVISOR",
    tag: "supervisors",
    type: "supervisor",
  }),
  scholars: createScholarsTrending(),
} as const;

export type TrendingModule = keyof typeof loaders;

export const getTrendingArticles = () => loaders.articles.fetch();
export const getTrendingSocialPosts = () => loaders.socialPosts.fetch();
export const getTrendingVacancies = () => loaders.vacancies.fetch();
export const getTrendingAdmissions = () => loaders.admissions.fetch();
export const getTrendingEvents = () => loaders.events.fetch();
export const getTrendingJournals = () => loaders.journals.fetch();
export const getTrendingResearchTools = () => loaders.researchTools.fetch();
export const getTrendingHelpPosts = () => loaders.helpPosts.fetch();
export const getTrendingResults = () => loaders.results.fetch();
export const getTrendingPublications = () => loaders.publications.fetch();
export const getTrendingContributions = () => loaders.contributions.fetch();
export const getTrendingSurveys = () => loaders.surveys.fetch();
export const getTrendingGrants = () => loaders.grants.fetch();
export const getTrendingCourses = () => loaders.courses.fetch();
export const getTrendingSupervisors = () => loaders.supervisors.fetch();
export const getTrendingScholars = () => loaders.scholars.fetch();

/**
 * Purges one module's Trending tab.
 *
 * Called from the shared content-mutation funnel alongside the All-tab purge —
 * a deleted or frozen row must disappear from both lists, not just the one the
 * user happened to be looking at.
 */
export function revalidateTrending(module: TrendingModule): void {
  loaders[module].revalidate();
}
