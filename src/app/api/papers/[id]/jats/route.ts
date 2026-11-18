import { NextResponse } from "next/server";

import { SITE_URL } from "@/constants/seo";
import { buildJatsXml } from "@/lib/publishing/jats";
import { getPublishedArticleWithVenue } from "@/lib/publishing/public";

export const dynamic = "force-dynamic";

/**
 * Public JATS metadata export for every published article.
 *
 * This endpoint intentionally does not convert the PDF or invent full text.
 * It emits validated front matter and the PDF self-reference; future
 * structured-body content can be added without changing the URL or the
 * publication identity.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const found = await getPublishedArticleWithVenue(id);
  if (!found) return new NextResponse("Not found", { status: 404 });

  const base = found.venue.type === "JOURNAL" ? "/sbj" : "/sbc";
  const articleUrl = `${SITE_URL}${base}/${found.venue.slug}/article/${id}`;
  const body = buildJatsXml(found.article, found.venue, articleUrl);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/jats+xml; charset=utf-8",
      "Content-Disposition": `inline; filename="${id}.jats.xml"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
