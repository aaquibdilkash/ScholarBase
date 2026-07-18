import { VacancyCard } from "@/app/vacancies/components/VacancyCard";
import { AdmissionCard } from "@/app/admissions/components/AdmissionCard";
import { EventCard } from "@/app/events/components/EventCard";
import { ArticleCard } from "@/components/blog/ArticleCard";
import { SupervisorCard } from "@/app/supervisor/components/SupervisorCard";
import { TrendingItem } from "@/types/trending";
import { SocialPostCard } from "./SocialPostCard";

import { JournalCard } from "@/app/journals/components/JournalCard";
import { ResearchToolCard } from "@/app/research-tools/components/ResearchToolCard";

import { HelpPostCard } from "@/app/help/components/HelpPostCard";

export function TrendingList({ items }: { items: TrendingItem[] }) {
  return (
    <div className="flex flex-col gap-6">
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
          case "help-post":
            return <HelpPostCard key={item.id} helpPost={item} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
