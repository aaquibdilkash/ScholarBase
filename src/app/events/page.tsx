import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Research Events & Conference",
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
import { AsyncListRegion } from "@/components/cards/AsyncListRegion";

type TrendingItem = import("@/types/trending").TrendingItem;

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q, tab } = await searchParams;
  // Auth is resolved lazily (no top-level await) so the shell heading/tabs
  // render instantly while the AsyncListRegion fetchers suspend as needed.
  const supabasePromise = createClient();

  return (
    <ListPageShell
      title="Research Events & Conference"
      description="Conferences, calls, and academic gatherings worth tracking."
      addHref="/events/add"
      addLabel="+ Add Event"
      tab={tab}
      enableTrending={true}
      allHref="/events"
      trendingHref="/events?tab=trending"
      trending={
        <AsyncListRegion
          fetcher={async () => {
            const supabase = await supabasePromise;
            const { data: { user } } = await supabase.auth.getUser();
            const items = (await getTrendingEvents()) as unknown as TrendingItem[];
            return { items, userId: user?.id };
          }}
        >
          {({ items, userId }) => (
            <TrendingList items={items} currentUserId={userId ?? ""} />
          )}
        </AsyncListRegion>
      }
      all={
        <AsyncListRegion
          key={q}
          fetcher={async () => {
            const supabase = await supabasePromise;
            const { data: { user } } = await supabase.auth.getUser();
            const events = await getEvents(q ?? "", user?.id, 10);
            return { events, userId: user?.id };
          }}
        >
          {({ events, userId }) => (
            <EventsList
              events={events}
              currentUserId={userId}
              initialQuery={q ?? ""}
            />
          )}
        </AsyncListRegion>
      }
    />
  );
}
