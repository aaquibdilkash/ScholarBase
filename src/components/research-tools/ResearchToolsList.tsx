"use client";

import { FilterableOpportunityList } from "@/components/opportunities/FilterableList";
import { ResearchToolCard } from "./ResearchToolCard";
import type { ResearchToolWithAuthor } from "@/types/cards";

export function ResearchToolsList({
  tools,
  currentUserId,
  initialQuery,
}: {
  tools: ResearchToolWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
}) {
  return (
    <FilterableOpportunityList
      items={tools}
      placeholder="Search by name or description..."
      filterFn={(tool, query) => {
        const q = query.toLowerCase();

        return (
          tool.name.toLowerCase().includes(q) ||
          (tool.description && tool.description.toLowerCase().includes(q)) ||
          (tool.author.name && tool.author.name.toLowerCase().includes(q)) ||
          false
        );
      }}
      renderItem={(tool) => (
        <ResearchToolCard
          key={tool.id}
          tool={tool}
          currentUserId={currentUserId}
        />
      )}
      initialQuery={initialQuery ?? ""}
      queryParamKey="q"
      basePath="/research-tools"
    />
  );
}
