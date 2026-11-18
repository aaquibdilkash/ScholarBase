import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JournalIssuePage } from "@/components/publishing/JournalIssuePage";
import { getJournalIssuePage } from "@/lib/publishing/public";
import { buildNoindexMetadata } from "@/lib/seo";
import { venueMetadata } from "@/lib/publishing/seo";

async function load(slug: string, volumeParam: string, numberParam: string) {
  const volume = Number(volumeParam);
  const number = Number(numberParam);
  if (!Number.isInteger(volume) || !Number.isInteger(number) || volume < 1 || number < 1) return null;
  return getJournalIssuePage(slug, volume, number);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; volume: string; number: string }> }): Promise<Metadata> {
  const { slug, volume, number } = await params;
  const loaded = await load(slug, volume, number);
  if (!loaded) return buildNoindexMetadata("Journal issue not found");
  return venueMetadata(loaded.result, { path: `/sbj/${slug}/issues/${volume}/${number}`, title: `Volume ${volume}, Issue ${number}`, description: `${loaded.result.venue.name}, Volume ${volume}, Issue ${number}.`, section: "Journals" });
}

export default async function JournalIssueRoute({ params }: { params: Promise<{ slug: string; volume: string; number: string }> }) {
  const { slug, volume, number } = await params;
  const loaded = await load(slug, volume, number);
  if (!loaded) notFound();
  return <JournalIssuePage venue={loaded.result.venue} issue={loaded.issue} articles={loaded.articles} preview={loaded.result.preview} />;
}
