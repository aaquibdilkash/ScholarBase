import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProceedingsVolumePage } from "@/components/publishing/ProceedingsVolumePage";
import { buildNoindexMetadata } from "@/lib/seo";
import {
  getPublishedArticles,
  getVenuePage,
} from "@/lib/publishing/public";
import { groupIssueArticles } from "@/lib/publishing/issues";
import { venueMetadata } from "@/lib/publishing/seo";

/** The archive is capped, so a volume beyond the window is simply not found. */
const VOLUME_ARTICLE_LIMIT = 500;

async function loadVolume(slug: string, volumeParam: string) {
  const volume = Number(volumeParam);
  if (!Number.isInteger(volume) || volume < 1) return null;

  const result = await getVenuePage(slug, "CONFERENCE");
  if (!result) return null;

  // A proceedings table of contents is ordered by page, not by the order the
  // papers happened to be published. `groupIssueArticles` applies that rule.
  const articles = groupIssueArticles(
    (await getPublishedArticles(result.venue.id, VOLUME_ARTICLE_LIMIT)).filter(
      (article) => article.volume === volume,
    ),
  ).flatMap((group) => group.articles);

  if (articles.length === 0) return null;

  return { result, volume, articles };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; volume: string }>;
}): Promise<Metadata> {
  const { slug, volume } = await params;
  const loaded = await loadVolume(slug, volume);
  if (!loaded) return buildNoindexMetadata("Proceedings volume not found");

  return venueMetadata(loaded.result, {
    path: `/sbc/${slug}/proceedings/${volume}`,
    title: `Proceedings volume ${volume}`,
    description: `Collected proceedings of ${loaded.result.venue.name}, volume ${volume}.`,
    section: "Conferences",
  });
}

export default async function ProceedingsVolumeRoute({
  params,
}: {
  params: Promise<{ slug: string; volume: string }>;
}) {
  const { slug, volume } = await params;
  const loaded = await loadVolume(slug, volume);
  if (!loaded) notFound();

  return (
    <ProceedingsVolumePage
      venue={loaded.result.venue}
      volume={loaded.volume}
      articles={loaded.articles}
      preview={loaded.result.preview}
    />
  );
}
