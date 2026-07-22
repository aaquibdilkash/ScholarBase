"use client";

import { FilterableOpportunityList } from "@/components/opportunities/FilterableList";
import { ResearchEvent, User } from "@prisma/client";
import { EventCard } from "./EventCard";

type EventWithDetails = ResearchEvent & {
  author: User;
  votes: { userId: string }[];
  _count: {
    votes: number;
    comments: number;
  };
};

export function EventsList({
  events,
  currentUserId,
  initialQuery,
}: {
  events: EventWithDetails[];
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
