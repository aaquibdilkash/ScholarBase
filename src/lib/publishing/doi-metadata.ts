import {
  formatPageRange,
  invertAuthorName,
  orcidIdFromUrl,
  type CitationAuthor,
} from "@/lib/publishing/citations";
import { parseManuscriptKeywords } from "@/lib/publishing/constants";
import type { ZenodoMetadata } from "@/lib/publishing/zenodo";

/**
 * Zenodo deposit metadata for one published manuscript.
 *
 * Pure by design: the Server Action owns HTTP and persistence, this module owns
 * the mapping from our citation shape to Zenodo's metadata schema. That keeps
 * "which authors, which pages, which licence" testable without a database or a
 * network stub, and it means the Zenodo record and the article page can never
 * disagree about the byline.
 *
 * The record is the *same work* as the article page, so the canonical URL is
 * attached as `isIdenticalTo` (not `isVersionOf`): a reader who lands on the
 * Zenodo record is one click from the version of record.
 */

export type DoiMetadataArticle = {
  id: string;
  title: string;
  abstract?: string | null;
  keywords?: string | null;
  publishedAt?: Date | string | null;
  volume?: number | null;
  issue?: number | null;
  firstPage?: string | null;
  lastPage?: string | null;
  isbn?: string | null;
};

export type DoiMetadataVenue = {
  name: string;
  type: "JOURNAL" | "CONFERENCE";
  issn?: string | null;
  eissn?: string | null;
  publisherName: string;
  licenseUrl?: string | null;
};

export type DoiMetadataInput = {
  article: DoiMetadataArticle;
  authors: readonly CitationAuthor[];
  venue: DoiMetadataVenue;
  /** Canonical public article URL on this site. */
  articleUrl: string;
};

export class DoiMetadataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DoiMetadataError";
  }
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}

/**
 * Maps a venue licence URL to Zenodo's licence vocabulary.
 *
 * `Venue.licenseUrl` defaults to CC BY 4.0. An unrecognised non-empty licence is
 * reported as `other-open` rather than silently relabelled as CC BY, because a
 * deposit's licence is a legal statement, not a display preference.
 */
export function zenodoLicenseId(licenseUrl: string | null | undefined): string {
  const value = licenseUrl?.trim();
  if (!value) return "cc-by-4.0";

  const match = value.toLowerCase().match(
    /creativecommons\.org\/(licenses|publicdomain)\/([a-z0-9-]+)(?:\/([0-9.]+))?/,
  );
  if (!match) return "other-open";

  if (match[1] === "publicdomain") {
    return match[2] === "zero" ? "cc0-1.0" : "other-open";
  }

  // `by/4.0` -> `cc-by-4.0`; `by-nc-nd/4.0` -> `cc-by-nc-nd-4.0`.
  return match[3] ? `cc-${match[2]}-${match[3]}` : `cc-${match[2]}`;
}

function formatPublicationDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

/**
 * Zenodo renders a restricted HTML subset in `description`. The abstract is
 * plain text, so escaping it here is the only way to keep `<` in a formula from
 * becoming markup on the record page.
 */
function buildDescription(article: DoiMetadataArticle, articleUrl: string): string {
  const abstract = article.abstract?.trim();
  const paragraphs = abstract
    ? abstract
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .map(
          (paragraph) =>
            `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`,
        )
    : [`<p>${escapeHtml(article.title.trim())}</p>`];

  paragraphs.push(
    `<p>Version of record: <a href="${escapeHtml(articleUrl)}">${escapeHtml(articleUrl)}</a></p>`,
  );

  return paragraphs.join("");
}

export function buildDoiMetadata(input: DoiMetadataInput): ZenodoMetadata {
  const title = input.article.title.trim();
  if (!title) throw new DoiMetadataError("The manuscript has no title.");

  const creators = input.authors.flatMap((author) => {
    const name = author.name.trim();
    if (!name) return [];

    const orcid = orcidIdFromUrl(author.orcid);
    const affiliation = author.affiliation?.trim();

    return [
      {
        name: invertAuthorName(name),
        ...(orcid ? { orcid } : {}),
        ...(affiliation ? { affiliation } : {}),
      },
    ];
  });

  if (creators.length === 0) {
    throw new DoiMetadataError("The manuscript has no author byline.");
  }

  const isConference = input.venue.type === "CONFERENCE";
  const pages = formatPageRange(input.article.firstPage, input.article.lastPage);
  const keywords = parseManuscriptKeywords(input.article.keywords ?? "");
  const publicationDate = formatPublicationDate(input.article.publishedAt);

  return {
    upload_type: "publication",
    publication_type: isConference ? "conferencepaper" : "article",
    title,
    creators,
    description: buildDescription(input.article, input.articleUrl),
    access_right: "open",
    license: zenodoLicenseId(input.venue.licenseUrl),
    related_identifiers: [
      {
        identifier: input.articleUrl,
        relation: "isIdenticalTo",
        resource_type: isConference
          ? "publication-conferencepaper"
          : "publication-article",
      },
    ],
    ...(publicationDate ? { publication_date: publicationDate } : {}),
    ...(keywords.length > 0 ? { keywords } : {}),
    ...(input.venue.publisherName.trim()
      ? { imprint_publisher: input.venue.publisherName.trim() }
      : {}),
    ...(isConference
      ? {
          conference_title: input.venue.name,
          ...(input.article.isbn ? { isbn: input.article.isbn } : {}),
        }
      : {
          journal_title: input.venue.name,
          ...(input.article.volume ? { journal_volume: String(input.article.volume) } : {}),
          ...(input.article.issue ? { journal_issue: String(input.article.issue) } : {}),
          ...(pages ? { journal_pages: pages } : {}),
          ...(input.venue.issn || input.venue.eissn
            ? { issn: input.venue.issn ?? input.venue.eissn ?? undefined }
            : {}),
        }),
  };
}
