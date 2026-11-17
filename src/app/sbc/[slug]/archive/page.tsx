import type { Metadata } from "next";

import { VenueArchivePage } from "@/components/publishing/VenueArchivePage";
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
    path: `/sbc/${slug}/archive`,
    title: "Archive",
    description: "Published papers and proceedings volumes.",
    section: "Conferences",
  });
}

export default async function ConferenceArchivePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <VenueArchivePage slug={slug} type="CONFERENCE" />;
}
