"use client";

import { FilterableOpportunityList } from "@/components/opportunities/FilterableList";
import { ResearchTool, ResearchToolLike, User } from "@prisma/client";
import { ResearchToolCard } from "./ResearchToolCard";

type ResearchToolWithDetails = ResearchTool & {
  author: User & {
    followers?: { followerId: string }[];
  };
  likes: ResearchToolLike[];
  _count: {
    likes: number;
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
          tool={{ ...tool, isLiked: (tool.likes?.length ?? 0) > 0 }}
          currentUserId={currentUserId}
        />
      )}
      initialQuery={initialQuery ?? ""}
      queryParamKey="q"
      basePath="/research-tools"
    />
  );
}
