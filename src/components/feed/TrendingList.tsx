import { VacancyCard } from "@/app/vacancies/components/VacancyCard";
import { AdmissionCard } from "@/app/admissions/components/AdmissionCard";
import { EventCard } from "@/app/events/components/EventCard";
import { ArticleCard } from "@/components/blog/ArticleCard";
import { SupervisorCard } from "@/app/supervisor/components/SupervisorCard";
import { TrendingItem } from "@/types/trending";
import { SocialPostCard } from "./SocialPostCard";

import { JournalCard } from "@/app/journals/components/JournalCard";
import { ResearchToolCard } from "@/app/research-tools/components/ResearchToolCard";

export function TrendingList({ items }: { items: TrendingItem[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.map((item) => {
        switch (item.type) {
          case "vacancy":
            return <VacancyCard key={item.id} vacancy={item} />;
          case "admission":
            return <AdmissionCard key={item.id} admission={item} />;
          case "event":
            return <EventCard key={item.id} event={item} />;
          case "article":
            return <ArticleCard key={item.id} article={item} />;
          case "journal":
            return <JournalCard key={item.id} journal={item} />;
          case "researchTool":
            return <ResearchToolCard key={item.id} tool={item} />;
          case "supervisor":
            return <SupervisorCard key={item.id} supervisor={item} />;
          case "social-post":
            return (
              <SocialPostCard
                key={item.id}
                post={item}
                isLiked={item.isLiked}
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
