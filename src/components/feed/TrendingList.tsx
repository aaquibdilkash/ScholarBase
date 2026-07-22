import { VacancyCard } from "@/components/vacancies/VacancyCard";
import { AdmissionCard } from "@/components/admissions/AdmissionCard";
import { EventCard } from "@/components/events/EventCard";
import { ArticleCard } from "@/components/blog/ArticleCard";
import { SupervisorCard } from "@/components/supervisor/SupervisorCard";
import { TrendingItem } from "@/types/trending";
import { SocialPostCard } from "./SocialPostCard";

import { JournalCard } from "@/components/journals/JournalCard";
import { ResearchToolCard } from "@/components/research-tools/ResearchToolCard";

import { HelpPostCard } from "@/components/help/HelpPostCard";

export function TrendingList({
  items,
  currentUserId,
}: {
  items: TrendingItem[];
  currentUserId?: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      {items.map((item) => {
        switch (item.type) {
          case "vacancy":
            return (
              <VacancyCard
                key={item.id}
                vacancy={item}
                currentUserId={currentUserId}
              />
            );
          case "admission":
            return (
              <AdmissionCard
                key={item.id}
                admission={item}
                currentUserId={currentUserId}
              />
            );
          case "event":
            return (
              <EventCard
                key={item.id}
                event={item}
                currentUserId={currentUserId}
              />
            );
          case "article":
            return (
              <ArticleCard
                key={item.id}
                article={item}
                currentUserId={currentUserId}
              />
            );
          case "journal":
            return (
              <JournalCard
                key={item.id}
                journal={item}
                currentUserId={currentUserId}
              />
            );
          case "researchTool":
            return (
              <ResearchToolCard
                key={item.id}
                tool={item}
                currentUserId={currentUserId}
              />
            );
          case "supervisor":
            return (
              <SupervisorCard
                key={item.id}
                supervisor={item}
                currentUserId={currentUserId}
              />
            );
          case "social-post":
            return (
              <SocialPostCard
                key={item.id}
                post={item}
                currentUserId={currentUserId}
              />
            );
          case "help-post":
            return (
              <HelpPostCard
                key={item.id}
                helpPost={item}
                currentUserId={currentUserId}
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
