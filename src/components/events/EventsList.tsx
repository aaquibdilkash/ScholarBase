"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchInput } from "@/components/ui/SearchInput";
import { EventCard } from "./EventCard";
import type { EventWithAuthor } from "@/types/cards";
import { CacheBackedList } from "@/components/layout/CacheBackedList";
import { getEvents } from "@/app/actions/events";

export function EventsList({
  events,
  currentUserId,
  initialQuery,
}: {
  events: EventWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  // Part of the cache key so every cached search variant stays independent.
  const queryKey = useMemo(() => ["events", q] as const, [q]);


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
      <CacheBackedList<EventWithAuthor>
        queryKey={queryKey}
        initialItems={events}
        fetchPage={(cursor) => getEvents(q, 10, cursor)}
        renderItem={(event) => (
          <EventCard
            key={event.id}
            event={event}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
        emptyMessage="No research events posted yet."
      />
    </div>
  );
}
