"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { getProfileSections, getProfileSection } from "@/app/actions/profile";
import { ArticleCard } from "@/components/blog/ArticleCard";
import { SocialPostCard } from "@/components/feed/SocialPostCard";
import { VacancyCard } from "@/components/vacancies/VacancyCard";
import { AdmissionCard } from "@/components/admissions/AdmissionCard";
import { EventCard } from "@/components/events/EventCard";
import { HelpPostCard } from "@/components/help/HelpPostCard";
import { JournalCard } from "@/components/journals/JournalCard";
import { ResearchToolCard } from "@/components/research-tools/ResearchToolCard";
import { RecommendationCard } from "@/components/supervisor/RecommendationCard";
import { SupervisorCard } from "@/components/supervisor/SupervisorCard";
import { ResultCard } from "@/components/results/ResultCard";
import { ContributionCard } from "@/components/contributions/ContributionCard";
import { PublicationCard } from "@/components/publications/PublicationCard";
import { SurveyCard } from "@/components/surveys/SurveyCard";
import ListPageCardShell from "@/components/cards/ListPageCardShell";

import { Carousel } from "@/components/ui/Carousel";

type ProfileData = {
  id: string;
  name: string | null;
  handle: string | null;
  avatarUrl: string | null;
  bio: string | null;
};

type SectionData = Awaited<ReturnType<typeof getProfileSections>>;
type SectionKey = Exclude<keyof NonNullable<SectionData>, "id" | "_count">;

interface SectionConfig {
  key: SectionKey;
  title: string;
  emptyMessage: string;
  renderItems: (items: any[], currentUserId?: string) => React.ReactNode;
}

type SectionWithCount = SectionConfig & { count?: number };

const SECTIONS: SectionWithCount[] = [
  {
    key: "articles",
    title: "Research Articles",
    emptyMessage: "No articles published yet.",
    renderItems: (items, currentUserId) =>
      items.map((a: any) => (
        <ArticleCard key={a.id} article={a} currentUserId={currentUserId} />
      )),
  },
  {
    key: "socialPosts",
    title: "Feed Posts",
    emptyMessage: "No feed posts yet.",
    renderItems: (items, currentUserId) =>
      items.map((p: any) => (
        <SocialPostCard key={p.id} post={p} currentUserId={currentUserId} />
      )),
  },
  {
    key: "vacancies",
    title: "Job Vacancies",
    emptyMessage: "No job vacancies posted yet.",
    renderItems: (items, currentUserId) =>
      items.map((v: any) => (
        <VacancyCard key={v.id} vacancy={v} currentUserId={currentUserId} />
      )),
  },
  {
    key: "admissions",
    title: "PhD Admissions",
    emptyMessage: "No PhD admissions posted yet.",
    renderItems: (items, currentUserId) =>
      items.map((a: any) => (
        <AdmissionCard key={a.id} admission={a} currentUserId={currentUserId} />
      )),
  },
  {
    key: "events",
    title: "Research Events",
    emptyMessage: "No research events posted yet.",
    renderItems: (items, currentUserId) =>
      items.map((e: any) => (
        <EventCard key={e.id} event={e} currentUserId={currentUserId} />
      )),
  },
  {
    key: "helpPosts",
    title: "Help Posts",
    emptyMessage: "No help posts yet.",
    renderItems: (items, currentUserId) =>
      items.map((h: any) => (
        <HelpPostCard key={h.id} helpPost={h} currentUserId={currentUserId} />
      )),
  },
  {
    key: "journals",
    title: "Journals",
    emptyMessage: "No journals posted yet.",
    renderItems: (items, currentUserId) =>
      items.map((j: any) => (
        <JournalCard key={j.id} journal={j} currentUserId={currentUserId} />
      )),
  },
  {
    key: "researchTools",
    title: "Research Tools",
    emptyMessage: "No research tools posted yet.",
    renderItems: (items, currentUserId) =>
      items.map((r: any) => (
        <ResearchToolCard key={r.id} tool={r} currentUserId={currentUserId} />
      )),
  },
  {
    key: "recommendations",
    title: "Recommendations Given",
    emptyMessage: "No recommendations given yet.",
    renderItems: (items, currentUserId) =>
      items.map((r: any) => (
        <RecommendationCard
          key={r.id}
          recommendation={r}
          supervisor={r.supervisor}
          currentUserId={currentUserId}
        />
      )),
  },
  {
    key: "supervisors",
    title: "Supervisor Profiles",
    emptyMessage: "No supervisor profiles created yet.",
    renderItems: (items, currentUserId) =>
      items.map((s: any) => (
        <SupervisorCard
          key={s.id}
          supervisor={s}
          currentUserId={currentUserId}
        />
      )),
  },
  {
    key: "results",
    title: "Results",
    emptyMessage: "No results posted yet.",
    renderItems: (items, currentUserId) =>
      items.map((r: any) => (
        <ResultCard key={r.id} result={r} currentUserId={currentUserId} />
      )),
  },
  {
    key: "contributionPosts",
    title: "Contributions",
    emptyMessage: "No contributions made yet.",
    renderItems: (items, currentUserId) =>
      items.map((c: any) => (
        <ContributionCard
          key={c.id}
          contribution={c}
          currentUserId={currentUserId}
        />
      )),
  },
  {
    key: "publications",
    title: "Publications",
    emptyMessage: "No publications added yet.",
    renderItems: (items, currentUserId) =>
      items.map((p: any) => (
        <PublicationCard
          key={p.id}
          publication={p}
          currentUserId={currentUserId}
        />
      )),
  },
  {
    key: "surveys",
    title: "Research Surveys",
    emptyMessage: "No research surveys created yet.",
    renderItems: (items, currentUserId) =>
      items.map((s: any) => (
        <SurveyCard key={s.id} survey={s} currentUserId={currentUserId} />
      )),
  },
];

export default function ProfileTabs({
  profile,
  profileId,
  currentUserId,
}: {
  profile: ProfileData;
  profileId: string;
  currentUserId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"about" | "content">(
    searchParams.get("tab") === "content" ? "content" : "about",
  );
  const [sections, setSections] = useState<SectionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState<string | null>(null);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "content" && !sections) {
      loadContent();
    }
  }, [searchParams, sections]);

  const setTab = (tab: "about" | "content") => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`);
    setActiveTab(tab);
  };

  const loadContent = useCallback(async () => {
    if (sections || isLoading) return;
    setIsLoading(true);
    try {
      const data = await getProfileSections(profileId, currentUserId, 1);
      setSections(data);
    } catch (err) {
      console.error("Failed to load profile sections:", err);
    } finally {
      setIsLoading(false);
    }
  }, [profileId, currentUserId, sections, isLoading]);

  const loadMore = async (sectionKey: SectionKey) => {
    if (loadingMore) return;

    setLoadingMore(sectionKey);
    try {
      const currentItems = sections?.[sectionKey] ?? [];
      const newItems = await getProfileSection(
        profileId,
        sectionKey,
        currentUserId,
        currentItems.length,
      );

      if (newItems) {
        setSections((prevSections) => ({
          ...(prevSections as NonNullable<SectionData>),
          [sectionKey]: [...currentItems, ...newItems],
        }));
      }
    } catch (err) {
      console.error(`Failed to load more ${sectionKey}:`, err);
    } finally {
      setLoadingMore(null);
    }
  };

  const handleContentTabClick = () => {
    setTab("content");
    if (!sections) {
      loadContent();
    }
  };

  return (
    <div className="mt-8">
      {/* Tab Buttons */}
      <div className="mb-8 grid w-full grid-cols-2 gap-1 rounded-2xl border border-slate-200/70 bg-white/80 p-1.5 shadow-sm dark:border-slate-800 dark:bg-slate-950/80 sm:w-fit sm:min-w-[18rem] sm:grid-cols-2">
        <button
          onClick={() => setTab("about")}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 sm:px-5 ${
            activeTab === "about"
              ? "bg-slate-950 text-white shadow-sm dark:bg-slate-100 dark:text-slate-950"
              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
          }`}
        >
          About
        </button>
        <button
          onClick={handleContentTabClick}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 sm:px-5 ${
            activeTab === "content"
              ? "bg-slate-950 text-white shadow-sm dark:bg-slate-100 dark:text-slate-950"
              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
          }`}
        >
          Content
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "about" ? (
        <div className="space-y-8">
          {/* Bio */}
          {profile.bio && (
            <div>
              <h2 className="mb-3 text-lg font-semibold text-slate-950">
                About
              </h2>
              <p className="sb-card leading-relaxed text-slate-700 p-5">
                {profile.bio}
              </p>
            </div>
          )}

          {/* Placeholder for future fields */}
          <div>
            <h2 className="mb-3 text-lg font-semibold text-slate-950">
              Links &amp; Identity
            </h2>
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-8 text-center">
              <p className="text-sm font-medium text-slate-400">
                ORCID iD, LinkedIn, GitHub, Publications, and more will appear
                here in a future update.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          {isLoading && !sections && (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
            </div>
          )}

          {sections &&
            SECTIONS.map((section) => {
              const items = (sections as any)[section.key] ?? [];
              const count = sections?._count?.[section.key] ?? items.length;
              const hasMore = items.length < count;

              return (
                <section key={section.key}>
                  <h2 className="mb-4 text-xl font-semibold text-slate-950">
                    {section.title} ({count})
                  </h2>
                  {items.length > 0 ? (
                    <div className="relative">
                      <Carousel
                        onLoadMore={
                          hasMore ? () => loadMore(section.key) : undefined
                        }
                        hasMore={hasMore}
                      >
                        {section.renderItems(items, currentUserId)}
                      </Carousel>
                      {loadingMore === section.key && (
                        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                          <div className="flex items-center gap-2 rounded-full bg-slate-900/80 px-4 py-2 text-sm font-medium text-white shadow-lg">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                            Loading more...
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-8 text-center">
                      <p className="text-sm font-medium text-slate-400">
                        {section.emptyMessage}
                      </p>
                    </div>
                  )}
                </section>
              );
            })}
        </div>
      )}
    </div>
  );
}
