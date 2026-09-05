"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { SearchInput } from "@/components/ui/SearchInput";
import { EventCard } from "./EventCard";
import type { EventWithAuthor } from "@/types/cards";
import { AppendMoreList } from "@/components/layout/AppendMoreList";
import { getEvents } from "@/app/actions/events";

export function EventsList({
  events,
  currentUserId,
  initialQuery,
  loadMoreParams,
}: {
  events: EventWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
  loadMoreParams?: Record<string, string | undefined>;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";

  const { data: eventsData } = useQuery({
    queryKey: ["events", q],
    queryFn: () => getEvents(q, currentUserId),
    initialData: events,
  });

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const params = new URLSearchParams(window.location.search);
    params.set("q", query);
    router.push(`/events?${params.toString()}`);
  };

  return (
    <div>
      <form onSubmit={handleSearch}>
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title or location..."
          className="mb-4"
        />
      </form>
      <AppendMoreList
        initialItems={eventsData}
        resource="events"
        params={{ q, ...loadMoreParams }}
        renderItem={(event) => (
          <EventCard
            key={(event as EventWithAuthor).id}
            event={event as EventWithAuthor}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
        emptyMessage="No research events posted yet."
      />
    </div>
  );
}
