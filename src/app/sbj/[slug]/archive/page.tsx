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
  const result = await getVenuePage(slug, "JOURNAL");
  return venueMetadata(result, {
    path: `/sbj/${slug}/archive`,
    title: "Archive",
    description: "Every issue, with its table of contents and page ranges.",
    section: "Research journals",
  });
}

export default async function JournalArchivePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <VenueArchivePage slug={slug} type="JOURNAL" />;
}
