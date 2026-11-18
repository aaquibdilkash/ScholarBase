import "server-only";

import { cache } from "react";

import type { Prisma } from "@prisma/client";

import prisma from "@/lib/db";
import { getCurrentUser, isUserAdmin } from "@/lib/auth";
import {
  buildAuthorList,
  formatPageRange,
  type CitationArticle,
  type CitationAuthor,
  type CitationVenue,
} from "@/lib/publishing/citations";
import {
  countIssues,
  groupIssueArticles,
  type IssueGroupOf,
} from "@/lib/publishing/issues";
import { editionTermLabel } from "@/lib/publishing/editions";

/**
 * Public, read-only projections for a venue and its published papers.
 *
 * Every query here is viewer-agnostic except `getVenuePage`, which only falls
 * back to a viewer check when the venue is *unpublished* — that is the editor
 * preview path, and it is the one place a caller's identity affects the result.
 *
 * Only `PUBLISHED` manuscripts are ever exposed. A row that merely passed
 * review has no public page, so status is part of the query, not a filter
 * applied later in a component.
 */

export type VenueType = "JOURNAL" | "CONFERENCE";

const VENUE_SELECT = {
  id: true,
  slug: true,
  name: true,
  type: true,
  coverImageUrl: true,
  publisherName: true,
  issn: true,
  eissn: true,
  frequency: true,
  contactEmail: true,
  launchedAt: true,
  isPublished: true,
  isDemo: true,
  aimsAndScope: true,
  authorGuidelines: true,
  peerReviewPolicy: true,
  ethicsPolicy: true,
  editorName: true,
  editorAffiliation: true,
  editorOrcid: true,
  licenseUrl: true,
  createdAt: true,
  board: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      name: true,
      roleTitle: true,
      affiliation: true,
      orcid: true,
    },
  },
} satisfies Prisma.VenueSelect;

export type PublicVenue = {
  id: string;
  slug: string;
  name: string;
  type: VenueType;
  coverImageUrl: string | null;
  publisherName: string;
  issn: string | null;
  eissn: string | null;
  frequency: string | null;
  contactEmail: string | null;
  launchedAt: Date | null;
  isPublished: boolean;
  isDemo: boolean;
  aimsAndScope: string | null;
  authorGuidelines: string | null;
  peerReviewPolicy: string | null;
  ethicsPolicy: string | null;
  editorName: string | null;
  editorAffiliation: string | null;
  editorOrcid: string | null;
  licenseUrl: string | null;
  createdAt: Date;
  board: Array<{
    name: string;
    roleTitle: string;
    affiliation: string | null;
    orcid: string | null;
  }>;
};

export type VenuePageResult = {
  venue: PublicVenue;
  /** True when this is an editor/admin preview of an unpublished venue. */
  preview: boolean;
  /** Published and not a demo venue — the only state a crawler may index. */
  indexable: boolean;
};

export type ArticleSummary = {
  id: string;
  title: string;
  abstract: string | null;
  keywords: string | null;
  doi: string | null;
  isbn: string | null;
  volume: number | null;
  issue: number | null;
  firstPage: string | null;
  lastPage: string | null;
  pageRange: string | null;
  publishedAt: Date | null;
  authors: CitationAuthor[];
  /** File name of the version of record, when one exists. */
  fileName: string | null;
  sizeBytes: number | null;
};

export type PublicConferenceEdition = {
  id: string;
  slug: string;
  year: number;
  term: string | null;
  label: string;
  coverImageUrl: string | null;
  status: string;
  isPublished: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  location: string | null;
  timezone: string | null;
  websiteUrl: string | null;
  submissionDeadline: Date | null;
  cameraReadyAt: Date | null;
  volume: number | null;
  isbn: string | null;
  proceedingsDoi: string | null;
  programItems: Array<{
    id: string;
    type: string;
    title: string;
    description: string | null;
    speakers: string | null;
    track: string | null;
    room: string | null;
    startsAt: Date | null;
    endsAt: Date | null;
    externalUrl: string | null;
  }>;
};

export type PublicJournalIssue = {
  id: string;
  volume: number;
  number: number;
  title: string | null;
  description: string | null;
  status: string;
  isPublished: boolean;
  publicationDate: Date | null;
  coverImageUrl: string | null;
  doi: string | null;
  editorialHtml: string | null;
};

const EDITION_SELECT = {
  id: true,
  slug: true,
  year: true,
  term: true,
  label: true,
  coverImageUrl: true,
  status: true,
  isPublished: true,
  startsAt: true,
  endsAt: true,
  location: true,
  timezone: true,
  websiteUrl: true,
  submissionDeadline: true,
  cameraReadyAt: true,
  volume: true,
  isbn: true,
  proceedingsDoi: true,
  programItems: {
    orderBy: [{ startsAt: "asc" }, { sortOrder: "asc" }],
    select: { id: true, type: true, title: true, description: true, speakers: true, track: true, room: true, startsAt: true, endsAt: true, externalUrl: true },
  },
} satisfies Prisma.ConferenceEditionSelect;

const JOURNAL_ISSUE_SELECT = {
  id: true,
  volume: true,
  number: true,
  title: true,
  description: true,
  status: true,
  isPublished: true,
  publicationDate: true,
  coverImageUrl: true,
  doi: true,
  editorialHtml: true,
} satisfies Prisma.JournalIssueSelect;

const ARTICLE_SELECT = {
  id: true,
  title: true,
  abstract: true,
  keywords: true,
  doi: true,
  isbn: true,
  volume: true,
  issue: true,
  firstPage: true,
  lastPage: true,
  publishedAt: true,
  coAuthors: true,
  author: { select: { name: true, orcidUrl: true } },
  files: {
    where: { kind: "MANUSCRIPT" },
    orderBy: [{ round: "desc" }, { createdAt: "desc" }],
    take: 1,
    select: { fileName: true, sizeBytes: true },
  },
} satisfies Prisma.ManuscriptSelect;

type ArticleRow = {
  id: string;
  title: string;
  abstract: string | null;
  keywords: string | null;
  doi: string | null;
  isbn: string | null;
  volume: number | null;
  issue: number | null;
  firstPage: string | null;
  lastPage: string | null;
  publishedAt: Date | null;
  coAuthors: unknown;
  author: { name: string | null; orcidUrl: string | null };
  files: Array<{ fileName: string; sizeBytes: number }>;
};

function toArticleSummary(row: ArticleRow): ArticleSummary {
  return {
    id: row.id,
    title: row.title,
    abstract: row.abstract,
    keywords: row.keywords,
    doi: row.doi,
    isbn: row.isbn,
    volume: row.volume,
    issue: row.issue,
    firstPage: row.firstPage,
    lastPage: row.lastPage,
    pageRange: formatPageRange(row.firstPage, row.lastPage),
    publishedAt: row.publishedAt,
    authors: buildAuthorList(row.author, row.coAuthors),
    fileName: row.files[0]?.fileName ?? null,
    sizeBytes: row.files[0]?.sizeBytes ?? null,
  };
}

/**
 * Resolves a venue for a public page.
 *
 * Published venues are returned without touching auth, so a crawler costs one
 * query. Unpublished and demo venues are the exception: an unpublished venue is
 * visible only to a platform admin or someone holding a seat at that venue, and
 * a demo venue is visible but never indexable. Returning `null` here is the
 * caller's cue to `notFound()`.
 */
export const getVenuePage = cache(async function getVenuePage(
  slug: string,
  type: VenueType,
): Promise<VenuePageResult | null> {
  const venue = await prisma.venue.findFirst({
    where: { slug, type },
    select: VENUE_SELECT,
  });

  if (!venue) return null;

  if (venue.isPublished) {
    return { venue, preview: false, indexable: !venue.isDemo };
  }

  const user = await getCurrentUser();
  if (!user) return null;

  const [admin, role] = await Promise.all([
    isUserAdmin(user.id),
    prisma.editorialRole.findFirst({
      where: { userId: user.id, venueId: venue.id },
      select: { id: true },
    }),
  ]);

  if (!admin && !role) return null;

  return { venue, preview: true, indexable: false };
});

/** Published papers, newest first. Bounded — a venue page is not an export. */
export async function getPublishedArticles(
  venueId: string,
  take = 100,
): Promise<ArticleSummary[]> {
  const rows = await prisma.manuscript.findMany({
    where: { venueId, status: "PUBLISHED" },
    orderBy: [
      { publishedAt: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
    take,
    select: ARTICLE_SELECT,
  });

  return rows.map(toArticleSummary);
}

export async function getConferenceEditions(
  venueId: string,
  includeUnpublished = false,
): Promise<PublicConferenceEdition[]> {
  return prisma.conferenceEdition.findMany({
    where: { venueId, ...(includeUnpublished ? {} : { isPublished: true }) },
    orderBy: [{ year: "desc" }, { term: "desc" }],
    select: EDITION_SELECT,
  });
}

export const getConferenceEditionPage = cache(async function getConferenceEditionPage(
  slug: string,
  editionSlug: string,
): Promise<{ result: VenuePageResult; edition: PublicConferenceEdition; articles: ArticleSummary[] } | null> {
  const result = await getVenuePage(slug, "CONFERENCE");
  if (!result) return null;

  const edition = await prisma.conferenceEdition.findFirst({
    where: {
      slug: editionSlug,
      venueId: result.venue.id,
      ...(result.preview ? {} : { isPublished: true }),
    },
    select: EDITION_SELECT,
  });
  if (!edition) return null;

  const rows = await prisma.manuscript.findMany({
    where: { editionId: edition.id, status: "PUBLISHED" },
    orderBy: [{ firstPage: "asc" }, { publishedAt: "asc" }],
    take: 500,
    select: ARTICLE_SELECT,
  });
  return { result, edition, articles: rows.map(toArticleSummary) };
});

export function conferenceEditionLabel(edition: Pick<PublicConferenceEdition, "label" | "year" | "term">): string {
  return edition.label || `${edition.year} ${editionTermLabel(edition.term)}`;
}

export const getJournalIssuePage = cache(async function getJournalIssuePage(
  slug: string,
  volume: number,
  number: number,
): Promise<{ result: VenuePageResult; issue: PublicJournalIssue; articles: ArticleSummary[] } | null> {
  const result = await getVenuePage(slug, "JOURNAL");
  if (!result) return null;
  const issue = await prisma.journalIssue.findFirst({
    where: { venueId: result.venue.id, volume, number, ...(result.preview ? {} : { isPublished: true }) },
    select: JOURNAL_ISSUE_SELECT,
  });
  if (!issue) return null;
  const rows = await prisma.manuscript.findMany({
    where: { journalIssueId: issue.id, status: "PUBLISHED" },
    orderBy: [{ firstPage: "asc" }, { publishedAt: "asc" }],
    take: 500,
    select: ARTICLE_SELECT,
  });
  return { result, issue, articles: rows.map(toArticleSummary) };
});

/** One published paper, scoped to the venue in the URL. */
export const getPublishedArticle = cache(async function getPublishedArticle(
  venueId: string,
  id: string,
): Promise<ArticleSummary | null> {
  const row = await prisma.manuscript.findFirst({
    where: { id, venueId, status: "PUBLISHED" },
    select: ARTICLE_SELECT,
  });

  return row ? toArticleSummary(row) : null;
});

export type IssueGroup = IssueGroupOf<ArticleSummary>;

/** Volume/issue grouping. The rules live in `issues.ts` so they are testable. */
export function groupIntoIssues(
  articles: readonly ArticleSummary[],
): IssueGroup[] {
  return groupIssueArticles(articles);
}

export const issueStats = countIssues<ArticleSummary>;

/** Published, non-demo venues for the directory pages. */
export async function getPublishedVenues(type: VenueType): Promise<  Array<{
    slug: string;
    name: string;
    aimsAndScope: string | null;
    issn: string | null;
    eissn: string | null;
    frequency: string | null;
    editorName: string | null;
    launchedAt: Date | null;
    _count: { manuscripts: number };
  }>
> {
  return prisma.venue.findMany({
    where: { type, isPublished: true, isDemo: false },
    orderBy: [{ launchedAt: "desc" }, { name: "asc" }],
    select: {
      slug: true,
      name: true,
      aimsAndScope: true,
      issn: true,
      eissn: true,
      frequency: true,
      editorName: true,
      launchedAt: true,
      // One indexed count per venue for a directory of a handful of rows. The
      // alternative (per-row `_count` on manuscripts) is the same query.
      _count: { select: { manuscripts: { where: { status: "PUBLISHED" } } } },
    },
  });
}

/** Article summary → the shape citation builders and metadata consume. */
export function toCitationArticle(article: ArticleSummary): CitationArticle {
  return {
    id: article.id,
    title: article.title,
    keywords: article.keywords,
    doi: article.doi,
    volume: article.volume,
    issue: article.issue,
    firstPage: article.firstPage,
    lastPage: article.lastPage,
    publishedAt: article.publishedAt,
    isbn: article.isbn,
    authors: article.authors,
  };
}

export function toCitationVenue(venue: PublicVenue): CitationVenue {
  return {
    slug: venue.slug,
    name: venue.name,
    type: venue.type,
    issn: venue.issn,
    eissn: venue.eissn,
    publisherName: venue.publisherName,
  };
}

/**
 * One published paper plus its venue, for the citation and PDF endpoints.
 *
 * The venue must itself be published: an article cannot be reachable while the
 * journal that published it is hidden. `isDemo` is allowed through — a demo
 * venue is live for testing but is never indexed.
 */
export async function getPublishedArticleWithVenue(id: string): Promise<{
  venue: PublicVenue;
  article: ArticleSummary;
} | null> {
  const row = await prisma.manuscript.findFirst({
    where: { id, status: "PUBLISHED", venue: { isPublished: true } },
    select: {
      ...ARTICLE_SELECT,
      venue: { select: VENUE_SELECT },
    },
  });

  if (!row) return null;

  const { venue, ...article } = row;
  return { venue, article: toArticleSummary(article) };
}

/** The stored object path for a published paper's version of record. */
export async function getPublishedPdfPath(id: string): Promise<string | null> {
  const row = await prisma.manuscript.findFirst({
    where: { id, status: "PUBLISHED", venue: { isPublished: true } },
    select: {
      files: {
        where: { kind: "MANUSCRIPT" },
        orderBy: [{ round: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: { filePath: true },
      },
    },
  });

  return row?.files[0]?.filePath ?? null;
}
