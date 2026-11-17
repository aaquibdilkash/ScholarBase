import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { VenueGuidelinesPage } from "@/components/publishing/VenueGuidelinesPage";
import { getVenuePage } from "@/lib/publishing/public";
import { venueMetadata } from "@/lib/publishing/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await getVenuePage(slug, "JOURNAL");
  return venueMetadata(result, {
    path: `/sbj/${slug}/guidelines`,
    title: "Author guidelines",
    section: "Research journals",
  });
}

export default async function JournalGuidelinesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getVenuePage(slug, "JOURNAL");
  if (!result) notFound();

  return <VenueGuidelinesPage venue={result.venue} preview={result.preview} />;
}
