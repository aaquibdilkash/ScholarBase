import type { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import prisma from "@/lib/db";

// Keep sitemap generation out of the build, where the database may not be
// reachable. The route can still be refreshed by the platform at runtime.
export const dynamic = "force-dynamic";
export const revalidate = 86400;

// 2. Safely grab the correct URL based on Vercel's build environment
const baseUrl = 
  process.env.VERCEL_ENV === "production"
    ? "https://scholarbase.app"
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}` // Vercel Preview Deployment URL
      : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"; // Local Fallback


const staticRoutes = [
  "",
  "/feed",
  "/scholars",
  "/supervisor",
  "/surveys",
  "/admissions",
  "/vacancies",
  "/events",
  "/results",
  "/blog",
  "/research-tools",
  "/grants",
  "/learn",
  "/journals",
  "/publications",
  "/contributions",
  "/help",
  "/contact",
  "/about",
  "/careers",
  "/privacy",
  "/terms",
];

const getSitemapData = unstable_cache(
  async () => Promise.all([
    prisma.article.findMany({ where: { published: true, isDeleted: false }, select: { slug: true, updatedAt: true } }),
    prisma.researchTool.findMany({ where: { isDeleted: false }, select: { id: true, updatedAt: true } }),
    prisma.researchGrant.findMany({ where: { isDeleted: false }, select: { id: true, updatedAt: true } }),
    prisma.course.findMany({ where: { isDeleted: false }, select: { id: true, updatedAt: true } }),
    prisma.journal.findMany({ where: { isDeleted: false }, select: { id: true, updatedAt: true } }),
    prisma.publication.findMany({ where: { isDeleted: false }, select: { id: true, updatedAt: true } }),
    prisma.researchSurvey.findMany({ where: { isDeleted: false }, select: { id: true, updatedAt: true } }),
    prisma.phdAdmission.findMany({ where: { isDeleted: false }, select: { id: true, updatedAt: true } }),
    prisma.jobVacancy.findMany({ where: { isDeleted: false }, select: { id: true, updatedAt: true } }),
    prisma.researchEvent.findMany({ where: { isDeleted: false }, select: { id: true, updatedAt: true } }),
    prisma.result.findMany({ where: { isDeleted: false }, select: { id: true, updatedAt: true } }),
    prisma.helpPost.findMany({ where: { isDeleted: false }, select: { id: true, updatedAt: true } }),
    prisma.socialPost.findMany({ where: { isDeleted: false }, select: { id: true, updatedAt: true } }),
    prisma.supervisor.findMany({ where: { isDeleted: false }, select: { id: true, updatedAt: true } }),
    prisma.contribution.findMany({ where: { status: "APPROVED", isDeleted: false }, select: { id: true, updatedAt: true } }),
    prisma.recommendation.findMany({ where: { isDeleted: false }, select: { id: true, supervisorId: true, updatedAt: true } }),
    prisma.user.findMany({ where: { isDeleted: false }, select: { id: true, updatedAt: true } }),
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
    vacancies,
    events,
    results,
    helpPosts,
    socialPosts,
    supervisors,
    contributions,
    recommendations,
    users,
  ] = await getSitemapData();

  const dynamicRoutes = [
    ...articles.map((item) => ({ path: `/blog/${item.slug}`, updatedAt: item.updatedAt })),
    ...researchTools.map((item) => ({ path: `/research-tools/${item.id}`, updatedAt: item.updatedAt })),
    ...researchGrants.map((item) => ({ path: `/grants/${item.id}`, updatedAt: item.updatedAt })),
    ...courses.map((item) => ({ path: `/learn/${item.id}`, updatedAt: item.updatedAt })),
    ...journals.map((item) => ({ path: `/journals/${item.id}`, updatedAt: item.updatedAt })),
    ...publications.map((item) => ({ path: `/publications/${item.id}`, updatedAt: item.updatedAt })),
    ...surveys.map((item) => ({ path: `/surveys/${item.id}`, updatedAt: item.updatedAt })),
    ...admissions.map((item) => ({ path: `/admissions/${item.id}`, updatedAt: item.updatedAt })),
    ...vacancies.map((item) => ({ path: `/vacancies/${item.id}`, updatedAt: item.updatedAt })),
    ...events.map((item) => ({ path: `/events/${item.id}`, updatedAt: item.updatedAt })),
    ...results.map((item) => ({ path: `/results/${item.id}`, updatedAt: item.updatedAt })),
    ...helpPosts.map((item) => ({ path: `/help/${item.id}`, updatedAt: item.updatedAt })),
    ...socialPosts.map((item) => ({ path: `/feed/${item.id}`, updatedAt: item.updatedAt })),
    ...supervisors.map((item) => ({ path: `/supervisor/${item.id}`, updatedAt: item.updatedAt })),
    ...contributions.map((item) => ({ path: `/contributions/${item.id}`, updatedAt: item.updatedAt })),
    ...recommendations.map((item) => ({ path: `/supervisor/${item.supervisorId}/recommendation/${item.id}`, updatedAt: item.updatedAt })),
    ...users.map((item) => ({ path: `/scholars/${item.id}`, updatedAt: item.updatedAt })),
  ];

  return [
    ...staticRoutes.map((path) => ({
      url: `${baseUrl}${path}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: path === "" ? 1 : 0.7,
    })),
    ...dynamicRoutes.map((route) => ({
      url: `${baseUrl}${route.path}`,
      lastModified: route.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
