import { NextResponse } from "next/server";

import { SITE_URL } from "@/constants/seo";
import {
  buildBibtexRecord,
  buildRisRecord,
} from "@/lib/publishing/citations";
import {
  getPublishedArticleWithVenue,
  toCitationArticle,
  toCitationVenue,
} from "@/lib/publishing/public";

/**
 * RIS / BibTeX download for a published paper.
 *
 * Generated from the same builders the article page uses for its "Cite this
 * article" block, so the downloaded record and the visible citation cannot
 * drift. Only `PUBLISHED` manuscripts resolve, and the venue must be published.
 */

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const format = new URL(request.url).searchParams.get("format") ?? "ris";
  if (format !== "ris" && format !== "bibtex") {
    return new NextResponse("Unsupported citation format.", { status: 400 });
  }

  const found = await getPublishedArticleWithVenue(id);
  if (!found) return new NextResponse("Not found", { status: 404 });

  const article = toCitationArticle(found.article);
  const venue = toCitationVenue(found.venue);
  const base = venue.type === "JOURNAL" ? "/sbj" : "/sbc";
  const articleUrl = `${SITE_URL}${base}/${venue.slug}/article/${article.id}`;

  const isRis = format === "ris";
  const body = isRis
    ? buildRisRecord(article, venue, articleUrl)
    : buildBibtexRecord(article, venue);

  const filename = `${venue.slug}-${article.id}.${isRis ? "ris" : "bib"}`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": isRis
        ? "application/x-research-info-systems; charset=utf-8"
        : "application/x-bibtex; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
