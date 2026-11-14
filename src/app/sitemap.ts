import type { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import prisma from "@/lib/db";
import {
  capSitemap,
  contentEntries,
  staticEntries,
} from "@/lib/sitemap";

// `next build` runs without runtime secrets and the database is unreachable
// there, so the route must never be prerendered. It stays cheap at runtime
// because the queries below are wrapped in a 24-hour `unstable_cache`: a
// crawler gets a freshly serialised XML file, but the database sees at most one
// round of queries per day. (`export const revalidate` would be dead here —
// `force-dynamic` disables route-level caching, so the cache lives on the data.)
export const dynamic = "force-dynamic";

/**
 * One query per content table, all in parallel.
 *
 * `createdAt` + `editedAt` rather than `updatedAt`: the latter moves on counter
 * updates, so it would make every post's `lastmod` change each time someone
 * voted. See `lastModifiedOf` in `@/lib/sitemap`.
 *
 * Soft-deleted rows are excluded everywhere. Contributions additionally require
 * `status: "APPROVED"` — the module's own list applies the same rule, and a
 * pending contribution is not a public page yet.
 */
const getSitemapData = unstable_cache(
  async () =>
    Promise.all([
      prisma.article.findMany({
        where: { published: true, isDeleted: false },
        select: { slug: true, createdAt: true, editedAt: true },
      }),
      prisma.researchTool.findMany({
        where: { isDeleted: false },
        select: { id: true, createdAt: true, editedAt: true },
      }),
      prisma.researchGrant.findMany({
        where: { isDeleted: false },
        select: { id: true, createdAt: true, editedAt: true },
      }),
      prisma.course.findMany({
        where: { isDeleted: false },
        select: { id: true, createdAt: true, editedAt: true },
      }),
      prisma.journal.findMany({
        where: { isDeleted: false },
        select: { id: true, createdAt: true, editedAt: true },
      }),
      prisma.publication.findMany({
        where: { isDeleted: false },
        select: { id: true, createdAt: true, editedAt: true },
      }),
      prisma.researchSurvey.findMany({
        where: { isDeleted: false },
        select: { id: true, createdAt: true, editedAt: true },
      }),
      prisma.admission.findMany({
        where: { isDeleted: false },
        select: { id: true, createdAt: true, editedAt: true },
      }),
      prisma.academicPosition.findMany({
        where: { isDeleted: false },
        select: { id: true, createdAt: true, editedAt: true },
      }),
      prisma.callForPaper.findMany({
        where: { isDeleted: false },
        select: { id: true, createdAt: true, editedAt: true },
      }),
      prisma.result.findMany({
        where: { isDeleted: false },
        select: { id: true, createdAt: true, editedAt: true },
      }),
      prisma.helpPost.findMany({
        where: { isDeleted: false },
        select: { id: true, createdAt: true, editedAt: true },
      }),
      prisma.socialPost.findMany({
        where: { isDeleted: false },
        select: { id: true, createdAt: true, editedAt: true },
      }),
      prisma.supervisor.findMany({
        where: { isDeleted: false },
        select: { id: true, createdAt: true, editedAt: true },
      }),
      prisma.contribution.findMany({
        where: { status: "APPROVED", isDeleted: false },
        select: { id: true, createdAt: true, editedAt: true },
      }),
      prisma.recommendation.findMany({
        where: { isDeleted: false },
        select: { id: true, supervisorId: true, createdAt: true, editedAt: true },
      }),
      // Journal reviews are a real, indexable page
      // (`/journals/[id]/review/[reviewId]`) that was missing from this file
      // entirely. It is discoverable by crawling from the journal page, but a
      // page absent from the sitemap is a page waiting to be dropped.
      prisma.journalReview.findMany({
        where: { isDeleted: false },
        select: { id: true, journalId: true, createdAt: true, editedAt: true },
      }),
      prisma.user.findMany({
        where: { isDeleted: false },
        select: { id: true, createdAt: true, editedAt: true },
      }),
    ]),
  ["sitemap-content"],
  { revalidate: 86400 },
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [
    articles,
    researchTools,
    researchGrants,
    courses,
    journals,
    publications,
    surveys,
    admissions,
    academicPositions,
    events,
    results,
    helpPosts,
    socialPosts,
    supervisors,
    contributions,
    recommendations,
    journalReviews,
    users,
  ] = await getSitemapData();

  const dynamicRoutes: MetadataRoute.Sitemap = [
    ...contentEntries(articles, (item) => `/blog/${item.slug}`),
    ...contentEntries(researchTools, (item) => `/research-tools/${item.id}`),
    ...contentEntries(researchGrants, (item) => `/grants/${item.id}`),
    ...contentEntries(courses, (item) => `/learn/${item.id}`),
    ...contentEntries(journals, (item) => `/journals/${item.id}`),
    ...contentEntries(publications, (item) => `/publications/${item.id}`),
    ...contentEntries(surveys, (item) => `/surveys/${item.id}`),
    ...contentEntries(admissions, (item) => `/admissions/${item.id}`),
    ...contentEntries(
      academicPositions,
      (item) => `/academic-positions/${item.id}`,
    ),
    ...contentEntries(events, (item) => `/call-for-papers/${item.id}`),
    ...contentEntries(results, (item) => `/results/${item.id}`),
    ...contentEntries(helpPosts, (item) => `/help/${item.id}`),
    ...contentEntries(socialPosts, (item) => `/feed/${item.id}`),
    ...contentEntries(supervisors, (item) => `/supervisor/${item.id}`),
    ...contentEntries(contributions, (item) => `/contributions/${item.id}`),
    ...contentEntries(
      recommendations,
      (item) => `/supervisor/${item.supervisorId}/recommendation/${item.id}`,
    ),
    ...contentEntries(
      journalReviews,
      (item) => `/journals/${item.journalId}/review/${item.id}`,
    ),
    ...contentEntries(users, (item) => `/scholars/${item.id}`),
  ];

  return capSitemap([...staticEntries(), ...dynamicRoutes]);
}
