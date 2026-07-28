"use client";

import { useState, useCallback, useRef } from "react";
import { getProfileSections } from "@/app/actions/profile";
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

type ProfileData = {
  id: string;
  name: string | null;
  handle: string | null;
  avatarUrl: string | null;
  bio: string | null;
};

type SectionData = Awaited<ReturnType<typeof getProfileSections>>;

interface SectionConfig {
  key: keyof NonNullable<SectionData>;
  title: string;
  emptyMessage: string;
  renderItems: (items: any[], currentUserId?: string) => React.ReactNode;
}

const SECTIONS: SectionConfig[] = [
  {
    key: "articles",
    title: "Research Articles",
    emptyMessage: "No articles published yet.",
    renderItems: (items, currentUserId) =>
      items.map((a: any) => (
        <div key={a.id} className="flex-shrink-0 w-full snap-center">
          <ArticleCard article={a} currentUserId={currentUserId} />
        </div>
      )),
  },
  {
    key: "socialPosts",
    title: "Feed Posts",
    emptyMessage: "No feed posts yet.",
    renderItems: (items, currentUserId) =>
      items.map((p: any) => (
        <div key={p.id} className="flex-shrink-0 w-full snap-center">
          <SocialPostCard post={p} currentUserId={currentUserId} />
        </div>
      )),
  },
  {
    key: "vacancies",
    title: "Job Vacancies",
    emptyMessage: "No job vacancies posted yet.",
    renderItems: (items, currentUserId) =>
      items.map((v: any) => (
        <div key={v.id} className="flex-shrink-0 w-full snap-center">
          <VacancyCard vacancy={v} currentUserId={currentUserId} />
        </div>
      )),
  },
  {
    key: "admissions",
    title: "PhD Admissions",
    emptyMessage: "No PhD admissions posted yet.",
    renderItems: (items, currentUserId) =>
      items.map((a: any) => (
        <div key={a.id} className="flex-shrink-0 w-full snap-center">
          <AdmissionCard admission={a} currentUserId={currentUserId} />
        </div>
      )),
  },
  {
    key: "events",
    title: "Research Events",
    emptyMessage: "No research events posted yet.",
    renderItems: (items, currentUserId) =>
      items.map((e: any) => (
        <div key={e.id} className="flex-shrink-0 w-full snap-center">
          <EventCard event={e} currentUserId={currentUserId} />
        </div>
      )),
  },
  {
    key: "helpPosts",
    title: "Help Posts",
    emptyMessage: "No help posts yet.",
    renderItems: (items, currentUserId) =>
      items.map((h: any) => (
        <div key={h.id} className="flex-shrink-0 w-full snap-center">
          <HelpPostCard helpPost={h} currentUserId={currentUserId} />
        </div>
      )),
  },
  {
    key: "journals",
    title: "Journals",
    emptyMessage: "No journals posted yet.",
    renderItems: (items, currentUserId) =>
      items.map((j: any) => (
        <div key={j.id} className="flex-shrink-0 w-full snap-center">
          <JournalCard journal={j} currentUserId={currentUserId} />
        </div>
      )),
  },
  {
    key: "researchTools",
    title: "Research Tools",
    emptyMessage: "No research tools posted yet.",
    renderItems: (items, currentUserId) =>
      items.map((r: any) => (
        <div key={r.id} className="flex-shrink-0 w-full snap-center">
          <ResearchToolCard tool={r} currentUserId={currentUserId} />
        </div>
      )),
  },
  {
    key: "recommendations",
    title: "Recommendations Given",
    emptyMessage: "No recommendations given yet.",
    renderItems: (items, currentUserId) =>
      items.map((r: any) => (
        <div key={r.id} className="flex-shrink-0 w-full snap-center">
          <RecommendationCard
            recommendation={r}
            supervisor={r.supervisor}
            currentUserId={currentUserId}
          />
        </div>
      )),
  },
  {
    key: "supervisors",
    title: "Supervisor Profiles",
    emptyMessage: "No supervisor profiles created yet.",
    renderItems: (items, currentUserId) =>
      items.map((s: any) => (
        <div key={s.id} className="flex-shrink-0 w-full snap-center">
          <SupervisorCard
            supervisor={{ ...s, recommendations: [] }}
            currentUserId={currentUserId}
          />
        </div>
      )),
  },
  {
    key: "results",
    title: "Results",
    emptyMessage: "No results posted yet.",
    renderItems: (items, currentUserId) =>
      items.map((r: any) => (
        <div key={r.id} className="flex-shrink-0 w-full snap-center">
          <ResultCard result={r} currentUserId={currentUserId} />
        </div>
      )),
  },
  {
    key: "contributionPosts",
    title: "Contributions",
    emptyMessage: "No contributions made yet.",
    renderItems: (items, currentUserId) =>
      items.map((c: any) => (
        <div key={c.id} className="flex-shrink-0 w-full snap-center">
          <ContributionCard contribution={c} currentUserId={currentUserId} />
        </div>
      )),
  },
  {
    key: "publications",
    title: "Publications",
    emptyMessage: "No publications added yet.",
    renderItems: (items, currentUserId) =>
      items.map((p: any) => (
        <div key={p.id} className="flex-shrink-0 w-full snap-center">
          <PublicationCard publication={p} currentUserId={currentUserId} />
        </div>
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
  const [activeTab, setActiveTab] = useState<"about" | "content">("about");
  const [sections, setSections] = useState<SectionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadContent = useCallback(async () => {
    if (sections || isLoading) return;
    setIsLoading(true);
    try {
      const data = await getProfileSections(profileId, currentUserId);
      setSections(data);
    } catch (err) {
      console.error("Failed to load profile sections:", err);
    } finally {
      setIsLoading(false);
    }
  }, [profileId, currentUserId, sections, isLoading]);

  const handleContentTabClick = () => {
    setActiveTab("content");
    if (!sections) {
      loadContent();
    }
  };

  return (
    <div className="mt-8">
      {/* Tab Buttons */}
      <div className="flex gap-1 rounded-2xl bg-slate-100 p-1.5 w-fit mb-8">
        <button
          onClick={() => setActiveTab("about")}
          className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
            activeTab === "about"
              ? "bg-white text-slate-950 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          About
        </button>
        <button
          onClick={handleContentTabClick}
          className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
            activeTab === "content"
              ? "bg-white text-slate-950 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
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
        <div className="space-y-12">
          {isLoading && !sections && (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
            </div>
          )}

          {sections &&
            SECTIONS.map((section) => {
              const items = (sections as any)[section.key] ?? [];
              return (
                <section key={section.key}>
                  <h2 className="mb-4 text-xl font-semibold text-slate-950">
                    {section.title}
                  </h2>
                  {items.length > 0 ? (
                    <ScrollableSection>
                      {section.renderItems(items, currentUserId)}
                    </ScrollableSection>
                  ) : (
                    <p className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-6 text-center italic text-slate-500">
                      {section.emptyMessage}
                    </p>
                  )}
                </section>
              );
            })}
        </div>
      )}
    </div>
  );
}

/** Horizontally scrollable section with left/right navigation arrows */
function ScrollableSection({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = 320; // approximate card width
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <div className="relative group">
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-none pb-4 snap-x snap-mandatory"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {children}
      </div>
      <button
        type="button"
        onClick={() => scroll("left")}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-md border border-slate-200 text-slate-700 opacity-0 group-hover:opacity-100 hover:bg-white hover:shadow-lg transition-all duration-200"
        aria-label="Scroll left"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => scroll("right")}
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-md border border-slate-200 text-slate-700 opacity-0 group-hover:opacity-100 hover:bg-white hover:shadow-lg transition-all duration-200"
        aria-label="Scroll right"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
