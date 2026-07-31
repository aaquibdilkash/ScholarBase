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

import { Carousel } from "@/components/ui/Carousel";

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
          supervisor={{ ...s, recommendations: [] }}
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
                    <Carousel>
                      {section.renderItems(items, currentUserId)}
                    </Carousel>
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
