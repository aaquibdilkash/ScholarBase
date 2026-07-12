"use client";

import { FilterableOpportunityList } from "@/components/opportunities/FilterableList";
import { ResearchEvent, ResearchEventLike, User } from "@prisma/client";
import { EventCard } from "./EventCard";

type EventWithDetails = ResearchEvent & {
  author: User;
  likes: ResearchEventLike[];
  _count: {
    likes: number;
    comments: number;
  };
};

export function EventsList({ events }: { events: EventWithDetails[] }) {
  return (
    <FilterableOpportunityList
      items={events}
      placeholder="Search by title or location..."
      filterFn={(event, query) =>
        event.title.toLowerCase().includes(query.toLowerCase()) ||
        event.location.toLowerCase().includes(query.toLowerCase())
      }
      renderItem={(event) => (
        <EventCard
          key={event.id}
          event={{ ...event, isLiked: event.likes.length > 0 }}
        />
      )}
    />
  );
}
