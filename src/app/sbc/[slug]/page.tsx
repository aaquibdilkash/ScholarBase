import type { Metadata } from "next";

import { PublicVenuePage } from "@/components/publishing/PublicVenuePage";
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
    path: `/sbc/${slug}`,
    section: "Conferences",
  });
}

export default async function ConferenceVenuePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <PublicVenuePage slug={slug} type="CONFERENCE" />;
}
