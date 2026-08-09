"use client";

import { FilterableOpportunityList } from "@/components/opportunities/FilterableList";
import { EventCard } from "./EventCard";
import type { EventWithAuthor } from "@/types/cards";

export function EventsList({
  events,
  currentUserId,
  initialQuery,
}: {
  events: EventWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
}) {
  return (
    <FilterableOpportunityList
      items={events}
      placeholder="Search by title or location..."
      filterFn={(event, query) =>
        event.title.toLowerCase().includes(query.toLowerCase()) ||
        event.location.toLowerCase().includes(query.toLowerCase())
      }
      renderItem={(event) => (
        <EventCard key={event.id} event={event} currentUserId={currentUserId} />
      )}
      initialQuery={initialQuery ?? ""}
      queryParamKey="q"
      basePath="/events"
    />
  );
}
