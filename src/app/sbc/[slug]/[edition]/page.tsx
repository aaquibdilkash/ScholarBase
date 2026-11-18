import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ConferenceEditionPage } from "@/components/publishing/ConferenceEditionPage";
import { getConferenceEditionPage } from "@/lib/publishing/public";
import { buildNoindexMetadata } from "@/lib/seo";
import { venueMetadata } from "@/lib/publishing/seo";

async function load(slug: string, edition: string) {
  return getConferenceEditionPage(slug, edition);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; edition: string }> }): Promise<Metadata> {
  const { slug, edition } = await params;
  const loaded = await load(slug, edition);
  if (!loaded) return buildNoindexMetadata("Conference edition not found");
  return venueMetadata(loaded.result, {
    path: `/sbc/${slug}/${edition}`,
    title: loaded.edition.label,
    description: `${loaded.edition.label} of ${loaded.result.venue.name}.`,
    section: "Conferences",
  });
}

export default async function ConferenceEditionRoute({ params }: { params: Promise<{ slug: string; edition: string }> }) {
  const { slug, edition } = await params;
  const loaded = await load(slug, edition);
  if (!loaded) notFound();
  return <ConferenceEditionPage venue={loaded.result.venue} edition={loaded.edition} articles={loaded.articles} preview={loaded.result.preview} />;
}
