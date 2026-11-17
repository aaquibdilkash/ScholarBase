import type { Metadata } from "next";

import { VenueDirectory } from "@/components/publishing/VenueDirectory";
import { buildMetadata } from "@/lib/seo";
import { getPublishedVenues } from "@/lib/publishing/public";

export const metadata: Metadata = buildMetadata({
  title: "Research journals",
  description:
    "Open-access research journals published by ScholarBase, with their editorial boards, aims and scope, and full archives.",
  path: "/sbj",
  section: "Research journals",
});

export default async function JournalsIndexPage() {
  const venues = await getPublishedVenues("JOURNAL");
  return <VenueDirectory type="JOURNAL" venues={venues} />;
}
