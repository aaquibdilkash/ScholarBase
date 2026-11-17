import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArticleView } from "@/components/publishing/ArticleView";
import { buildNoindexMetadata } from "@/lib/seo";
import {
  getPublishedArticle,
  getVenuePage,
  toCitationArticle,
  toCitationVenue,
} from "@/lib/publishing/public";
import { articleMetadata } from "@/lib/publishing/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}): Promise<Metadata> {
  const { slug, id } = await params;
  const result = await getVenuePage(slug, "CONFERENCE");
  if (!result) return buildNoindexMetadata("Paper not found");

  const article = await getPublishedArticle(result.venue.id, id);
  if (!article) return buildNoindexMetadata("Paper not found");

  return articleMetadata({
    article: toCitationArticle(article),
    venue: toCitationVenue(result.venue),
    path: `/sbc/${slug}/article/${id}`,
    indexable: result.indexable,
    hasPdf: Boolean(article.fileName),
  });
}

export default async function ConferencePaperPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const result = await getVenuePage(slug, "CONFERENCE");
  if (!result) notFound();

  const article = await getPublishedArticle(result.venue.id, id);
  if (!article) notFound();

  return (
    <ArticleView
      venue={result.venue}
      article={article}
      preview={result.preview}
    />
  );
}
