import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Research Events & Conferences",
  description: "Conferences, workshops, calls for papers, and academic gatherings worth tracking around the world.",
  path: "/events",
  section: "Events",
});
import { createClient } from "@/utils/supabase/server";
import ListPageShell from "@/components/layout/ListPageShell";
import { EventsList } from "@/components/events/EventsList";
import { getTrendingEvents } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";
import { getEvents } from "@/app/actions/events";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q, tab } = await searchParams as { q?: string; tab?: string };
  const pageSize = 10;
  const isTrendingTab = tab === "trending";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const events = isTrendingTab ? [] : await getEvents(q, user?.id, pageSize);

  const trendingItems = (isTrendingTab
    ? await getTrendingEvents()
    : []) as unknown as import("@/types/trending").TrendingItem[];

  return (
    <ListPageShell
      title="Research Events & Conferences"
      description="Conferences, calls, and academic gatherings worth tracking."
      addHref="/events/add"
      addLabel="+ Add Event"
      tab={tab}
      enableTrending={true}
      allHref="/events"
      trendingHref="/events?tab=trending"
      trending={<TrendingList items={trendingItems} currentUserId={user?.id} />}
      all={
        <EventsList
          events={events}
          currentUserId={user?.id}
          initialQuery={q ?? ""}
          loadMoreParams={!isTrendingTab ? { q } : undefined}
        />
      }
    />
  );
}
