import { VacancyCard } from "@/components/vacancies/VacancyCard";
import { AdmissionCard } from "@/components/admissions/AdmissionCard";
import { EventCard } from "@/components/events/EventCard";
import { ArticleCard } from "@/components/blog/ArticleCard";
import { SupervisorCard } from "@/components/supervisor/SupervisorCard";
import { TrendingItem } from "@/types/trending";
import { SocialPostCard } from "./SocialPostCard";
import { ScholarCard } from "@/components/scholars/ScholarCard";

import { JournalCard } from "@/components/journals/JournalCard";
import { ResearchToolCard } from "@/components/research-tools/ResearchToolCard";

import { HelpPostCard } from "@/components/help/HelpPostCard";
import { ContributionCard } from "@/components/contributions/ContributionCard";
import { ResultCard } from "@/components/results/ResultCard";
import { PublicationCard } from "@/components/publications/PublicationCard";
import { SurveyCard } from "@/components/surveys/SurveyCard";
import type { SocialPostWithAuthor } from "@/types/cards";

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
                post={
                  {
                    ...item,
                    mentions: Array.isArray(item.mentions)
                      ? (item.mentions as SocialPostWithAuthor["mentions"])
                      : null,
                  } as SocialPostWithAuthor
                }
                currentUserId={currentUserId}
              />
            );
            case "scholar":
            return (
              <ScholarCard
                key={item.id}
                scholar={item}
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
          case "contribution":
            return (
              <ContributionCard
                key={item.id}
                contribution={item}
                currentUserId={currentUserId}
              />
            );
          case "result":
            return (
              <ResultCard
                key={item.id}
                result={item}
                currentUserId={currentUserId}
              />
            );
          case "publication":
            return (
              <PublicationCard
                key={item.id}
                publication={item}
                currentUserId={currentUserId}
              />
            );
          case "survey":
            return (
              <SurveyCard
                key={item.id}
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore - TrendingItem survey counts are partial
                survey={item}
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
