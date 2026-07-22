"use client";

import { FilterableOpportunityList } from "@/components/opportunities/FilterableList";
import { ResearchTool, User } from "@prisma/client";
import { ResearchToolCard } from "./ResearchToolCard";

type ResearchToolWithDetails = ResearchTool & {
  author: User & {
    followers?: { followerId: string }[];
  };
  votes: { userId: string }[];
  _count: {
    votes: number;
    comments: number;
  };
};

export function ResearchToolsList({
  tools,
  currentUserId,
  initialQuery,
}: {
  tools: ResearchToolWithDetails[];
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
