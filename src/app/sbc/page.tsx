import type { Metadata } from "next";

import { VenueDirectory } from "@/components/publishing/VenueDirectory";
import { buildMetadata } from "@/lib/seo";
import { getPublishedVenues } from "@/lib/publishing/public";

export const metadata: Metadata = buildMetadata({
  title: "Conferences",
  description:
    "Conference proceedings published by ScholarBase, with their committees, volumes, and ISBN record.",
  path: "/sbc",
  section: "Conferences",
});

export default async function ConferencesIndexPage() {
  const venues = await getPublishedVenues("CONFERENCE");
  return <VenueDirectory type="CONFERENCE" venues={venues} />;
}
