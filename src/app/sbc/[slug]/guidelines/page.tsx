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
  const result = await getVenuePage(slug, "CONFERENCE");
  return venueMetadata(result, {
    path: `/sbc/${slug}/guidelines`,
    title: "Submission guidelines",
    section: "Conferences",
  });
}

export default async function ConferenceGuidelinesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getVenuePage(slug, "CONFERENCE");
  if (!result) notFound();

  return <VenueGuidelinesPage venue={result.venue} preview={result.preview} />;
}
