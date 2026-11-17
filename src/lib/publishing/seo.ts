import type { Metadata } from "next";

import { SITE_URL } from "@/constants/seo";
import { buildMetadata, buildNoindexMetadata } from "@/lib/seo";
import {
  buildHighwireMeta,
  type CitationArticle,
  type CitationVenue,
} from "@/lib/publishing/citations";
import { plainText } from "@/lib/schema";
import { formatIssn } from "@/lib/publishing/identifiers";
import type { VenuePageResult } from "@/lib/publishing/public";

/**
 * Scholarly metadata, layered on the app's `buildMetadata`.
 *
 * Two rules, both of which have bitten real journal sites:
 *
 * 1. An unpublished or demo venue is `noindex` on *every* page under it —
 *    including article pages — because indexing a venue before it is ready is
 *    how a publisher ends up pleading with Google to remove thin pages.
 * 2. An article also emits Highwire tags, which Google Scholar reads instead of
 *    (not in addition to) the page copy.
 */

function fallbackDescription(venue: VenuePageResult["venue"]): string {
  const kind = venue.type === "JOURNAL" ? "research journal" : "conference proceedings";
  const rawIssn = venue.issn ?? venue.eissn;
  const issn = rawIssn ? formatIssn(rawIssn) || rawIssn : null;
  return `${venue.name} — ${kind} published by ${venue.publisherName}${
    issn ? `, ISSN ${issn}` : ""
  }.`;
}

/**
 * Venue copy → a description. `buildMetadata` clamps the final string, so this
 * only has to unwrap the rich text and fall back when the CMS field is empty.
 */
function describe(
  venue: VenuePageResult["venue"],
  raw: string | null | undefined,
): string {
  const text = raw ? (plainText(raw, 1000) ?? "").trim() : "";
  return text || fallbackDescription(venue);
}

export function venueMetadata(
  result: VenuePageResult | null,
  options: { path: string; title?: string; description?: string | null; section?: string },
): Metadata {
  if (!result) return buildNoindexMetadata("Venue not found");

  const title = options.title ? `${options.title} | ${result.venue.name}` : result.venue.name;
  const description = describe(result.venue, options.description ?? result.venue.aimsAndScope);

  if (!result.indexable) return buildNoindexMetadata(title);

  return buildMetadata({
    title,
    description,
    path: options.path,
    section: options.section,
  });
}

export function articleMetadata({
  article,
  venue,
  path,
  indexable,
  hasPdf,
}: {
  article: CitationArticle;
  venue: CitationVenue;
  path: string;
  indexable: boolean;
  hasPdf: boolean;
}): Metadata {
  if (!indexable) return buildNoindexMetadata(article.title);

  const authorNames = article.authors.map((author) => author.name).join(", ");
  const base = buildMetadata({
    title: article.title,
    description:
      article.keywords?.trim() ||
      (authorNames ? `${authorNames}. ${venue.name}.` : venue.name),
    path,
    type: "article",
    author: authorNames || undefined,
    publishedTime: article.publishedAt ?? null,
    section: venue.name,
  });

  return {
    ...base,
    other: buildHighwireMeta(article, venue, {
      articleUrl: `${SITE_URL}${path}`,
      pdfUrl: hasPdf ? `${SITE_URL}/api/papers/${article.id}/file` : null,
    }),
  };
}
