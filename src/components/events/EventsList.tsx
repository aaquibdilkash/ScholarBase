"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchInput } from "@/components/ui/SearchInput";
import { EventCard } from "./EventCard";
import type { EventWithAuthor } from "@/types/cards";
import { AppendMoreList } from "@/components/layout/AppendMoreList";

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
        initialItems={events}
        resource="events"
        params={loadMoreParams}
        renderItem={(event) => (
          <EventCard
            key={(event as EventWithAuthor).id}
            event={event as EventWithAuthor}
            currentUserId={currentUserId}
          />
        )}
      />
    </div>
  );
}
