"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { GraduationCap, MessageSquare, Reply, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { RichContent } from "@/components/content/RichContent";
import {
  getProfileSections,
  getProfileActivity,
  getProfileSection,
} from "@/app/actions/profile";
import { formatTimeAgo } from "@/utils/time-ago";
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
import { ActivityItem } from "@/types/activity";
import { ProfileData } from "@/types/profile";
import {
  SectionData,
  SectionKey,
  ArticleType,
  SocialPostType,
  VacancyType,
  AdmissionType,
  EventType,
  HelpPostType,
  JournalType,
  ResearchToolType,
  RecommendationType,
  SupervisorType,
  ResultType,
  ContributionType,
  PublicationType,
  SurveyType,
  SectionWithCount,
} from "@/types/components";

import { Carousel } from "@/components/ui/Carousel";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a11 11 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.73.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.21.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z" />
    </svg>
  );
}

function OrcidIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zM7.5 4.5h2v15h-2v-15zm4.5 0h1a5.25 5.25 0 0 1 0 10.5h-1V17h-2V4.5h2zm1 2.25v6h-.45a2.75 2.75 0 0 1 0-6h.45z" />
    </svg>
  );
}

const SECTIONS: SectionWithCount[] = [
  {
    key: "articles",
    title: "Research Articles",
    emptyMessage: "No articles published yet.",
    renderItems: (items: ArticleType[], currentUserId) =>
      items.map((a) => (
        <ArticleCard key={a.id} article={a} currentUserId={currentUserId} />
      )),
  },
  {
    key: "socialPosts",
    title: "Feed Posts",
    emptyMessage: "No feed posts yet.",
    renderItems: (items: SocialPostType[], currentUserId) =>
      items.map((p) => (
        <SocialPostCard key={p.id} post={p} currentUserId={currentUserId} />
      )),
  },
  {
    key: "vacancies",
    title: "Job Vacancies",
    emptyMessage: "No job vacancies posted yet.",
    renderItems: (items: VacancyType[], currentUserId) =>
      items.map((v) => (
        <VacancyCard key={v.id} vacancy={v} currentUserId={currentUserId} />
      )),
  },
  {
    key: "admissions",
    title: "PhD Admissions",
    emptyMessage: "No PhD admissions posted yet.",
    renderItems: (items: AdmissionType[], currentUserId) =>
      items.map((a) => (
        <AdmissionCard key={a.id} admission={a} currentUserId={currentUserId} />
      )),
  },
  {
    key: "events",
    title: "Research Events",
    emptyMessage: "No research events posted yet.",
    renderItems: (items: EventType[], currentUserId) =>
      items.map((e) => (
        <EventCard key={e.id} event={e} currentUserId={currentUserId} />
      )),
  },
  {
    key: "helpPosts",
    title: "Help Posts",
    emptyMessage: "No help posts yet.",
    renderItems: (items: HelpPostType[], currentUserId) =>
      items.map((h) => (
        <HelpPostCard key={h.id} helpPost={h} currentUserId={currentUserId} />
      )),
  },
  {
    key: "journals",
    title: "Journals",
    emptyMessage: "No journals posted yet.",
    renderItems: (items: JournalType[], currentUserId) =>
      items.map((j) => (
        <JournalCard key={j.id} journal={j} currentUserId={currentUserId} />
      )),
  },
  {
    key: "researchTools",
    title: "Research Tools",
    emptyMessage: "No research tools posted yet.",
    renderItems: (items: ResearchToolType[], currentUserId) =>
      items.map((r) => (
        <ResearchToolCard key={r.id} tool={r} currentUserId={currentUserId} />
      )),
  },
  {
    key: "recommendations",
    title: "Recommendations Given",
    emptyMessage: "No recommendations given yet.",
    renderItems: (items: RecommendationType[], currentUserId) =>
      items.map((r) => (
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
    renderItems: (items: SupervisorType[], currentUserId) =>
      items.map((s) => (
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
    renderItems: (items: ResultType[], currentUserId) =>
      items.map((r) => (
        <ResultCard key={r.id} result={r} currentUserId={currentUserId} />
      )),
  },
  {
    key: "contributionPosts",
    title: "Contributions",
    emptyMessage: "No contributions made yet.",
    renderItems: (items: ContributionType[], currentUserId) =>
      items.map((c) => (
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
    renderItems: (items: PublicationType[], currentUserId) =>
      items.map((p) => (
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
    renderItems: (items: SurveyType[], currentUserId) =>
      items.map((s) => (
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
  const [activeTab, setActiveTab] = useState<"about" | "content" | "activity">(
    searchParams.get("tab") === "content"
      ? "content"
      : searchParams.get("tab") === "activity"
        ? "activity"
        : "about",
  );
  const [sections, setSections] = useState<SectionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityItem[] | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);

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

  const loadActivity = useCallback(async () => {
    if (activity || activityLoading) return;
    setActivityLoading(true);
    try {
      const data = await getProfileActivity(profileId, 30);
      setActivity(data);
    } catch (err) {
      console.error("Failed to load profile activity:", err);
      setActivity([]);
    } finally {
      setActivityLoading(false);
    }
  }, [profileId, activity, activityLoading]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "content" && !sections) {
      loadContent();
    }
    if (tab === "activity" && !activity) {
      loadActivity();
    }
  }, [searchParams, sections, activity, loadActivity, loadContent]);

  const setTab = (tab: "about" | "content" | "activity") => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`);
    setActiveTab(tab);
  };

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

  const handleActivityTabClick = () => {
    setTab("activity");
    if (!activity) {
      loadActivity();
    }
  };

  return (
    <div className="mt-8">
      {/* Tab Buttons */}
      <div className="mb-8 grid w-full grid-cols-3 gap-1 rounded-2xl border border-slate-200/70 bg-white/80 p-1.5 shadow-sm dark:border-slate-800 dark:bg-slate-950/80 sm:w-fit sm:min-w-[24rem] sm:grid-cols-3">
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
        <button
          onClick={handleActivityTabClick}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 sm:px-5 ${
            activeTab === "activity"
              ? "bg-slate-950 text-white shadow-sm dark:bg-slate-100 dark:text-slate-950"
              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
          }`}
        >
          Activity
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "about" && (
        <div className="space-y-8">
          {/* Bio */}
          {profile.bio && (
            <div>
              <h2 className="mb-3 text-lg font-semibold text-slate-950">
                About
              </h2>
              <RichContent
                content={profile.bio}
                className="sb-card leading-relaxed text-slate-700 p-5"
              />
            </div>
          )}

          {/* Links & Identity */}
          <div>
            <h2 className="mb-3 text-lg font-semibold text-slate-950">
              Links &amp; Identity
            </h2>
            <div className="flex flex-wrap gap-3">
              {profile.githubUrl && (
                <a
                  href={profile.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600"
                >
                  <GithubIcon className="h-4 w-4" />
                  GitHub
                </a>
              )}
              {profile.orcidUrl && (
                <a
                  href={profile.orcidUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600"
                >
                  <OrcidIcon />
                  ORCID
                </a>
              )}
              {profile.linkedinUrl && (
                <a
                  href={profile.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600"
                >
                  <LinkedinIcon className="h-4 w-4" />
                  LinkedIn
                </a>
              )}
              {profile.googleScholarUrl && (
                <a
                  href={profile.googleScholarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600"
                >
                  <span className="flex h-4 w-4 items-center justify-center">
                    <GraduationCap className="h-4 w-4" />
                  </span>
                  Google Scholar
                </a>
              )}
              {!profile.githubUrl &&
                !profile.orcidUrl &&
                !profile.linkedinUrl &&
                !profile.googleScholarUrl && (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-8 text-center">
                    <p className="text-sm font-medium text-slate-400">
                      No profile links added yet.
                    </p>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "content" && (
        <div className="space-y-10">
          {isLoading && !sections && (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
            </div>
          )}

          {sections &&
            SECTIONS.map((section) => {
              const items = sections[section.key] ?? [];
              const count = items.length;
              const hasMore = items.length > 0;

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
                        {/* TypeScript cannot correlate the dynamic section.key with the items type */}
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {section.renderItems(items as any, currentUserId)}
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

      {activeTab === "activity" && (
        <div className="space-y-4">
          {activityLoading && (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
            </div>
          )}
          {activity && activity.length > 0
            ? activity.map((item, index) => (
                <ActivityItemCard
                  key={`${item.id}-${item.action}-${index}`}
                  item={item}
                />
              ))
            : !activityLoading && (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-8 text-center">
                  <p className="text-sm font-medium text-slate-400">
                    No activity to show yet.
                  </p>
                </div>
              )}
        </div>
      )}
    </div>
  );
}

// Human-readable metadata for each UserActivity module key, so the profile
// activity tab renders the global activity log without any DB JOINs.
const ACTIVITY_META: Record<
  string,
  { label: string; href?: (entityId: string) => string | undefined }
> = {
  SOCIAL_POST: { label: "social post", href: (id) => `/feed/${id}` },
  ARTICLE: { label: "article", href: (id) => `/blog/${id}` },
  PUBLICATION: { label: "publication", href: (id) => `/publications/${id}` },
  JOURNAL: { label: "journal", href: (id) => `/journals/${id}` },
  RESEARCH_TOOL: { label: "research tool", href: (id) => `/research-tools/${id}` },
  PHD_ADMISSION: { label: "PhD admission", href: (id) => `/admissions/${id}` },
  RESEARCH_EVENT: { label: "research event", href: (id) => `/events/${id}` },
  JOB_VACANCY: { label: "job vacancy", href: (id) => `/vacancies/${id}` },
  HELP_POST: { label: "help post", href: (id) => `/help/${id}` },
  RESULT: { label: "result", href: (id) => `/results/${id}` },
  CONTRIBUTION: { label: "contribution", href: (id) => `/contributions/${id}` },
  SUPERVISOR: { label: "supervisor", href: (id) => `/supervisor/${id}` },
  RECOMMENDATION: { label: "recommendation", href: () => undefined },
  RESEARCH_SURVEY: { label: "survey", href: (id) => `/surveys/${id}` },
  COURSE: { label: "course", href: (id) => `/learn/${id}` },
   RESEARCH_GRANT: { label: "research grant", href: (id) => `/grants/${id}` },
  USER: { label: "scholar", href: () => undefined },
  SOCIAL_POST_COMMENT: { label: "comment" },
  ARTICLE_COMMENT: { label: "comment" },
  JOB_VACANCY_COMMENT: { label: "comment" },
  PHD_ADMISSION_COMMENT: { label: "comment" },
  RESEARCH_EVENT_COMMENT: { label: "comment" },
  SUPERVISOR_COMMENT: { label: "comment" },
  RECOMMENDATION_COMMENT: { label: "comment" },
  HELP_POST_COMMENT: { label: "comment" },
  JOURNAL_COMMENT: { label: "comment" },
  RESEARCH_TOOL_COMMENT: { label: "comment" },
  RESEARCH_GRANT_COMMENT: { label: "comment" },
  COURSE_COMMENT: { label: "comment" },
  RESULT_COMMENT: { label: "comment" },
  CONTRIBUTION_COMMENT: { label: "comment" },
  PUBLICATION_COMMENT: { label: "comment" },
  RESEARCH_SURVEY_COMMENT: { label: "comment" },
};

const ACTIVITY_ACTION: Record<string, string> = {
  VOTED: "voted on",
  COMMENTED: "commented on",
  REPLIED: "replied to",
  FOLLOWED: "followed",
  PUBLISHED: "published",
};

function ActivityItemCard({ item }: { item: ActivityItem }) {
  const meta = ACTIVITY_META[item.moduleType] ?? { label: "content" };
  const href = meta.href?.(item.entityId);
  const actionText = ACTIVITY_ACTION[item.action] ?? "interacted with";
  const label = meta.label;

  const Icon =
    item.action === "COMMENTED"
      ? MessageSquare
      : item.action === "REPLIED"
        ? Reply
        : ThumbsUp;

  return (
    <div className="sb-card p-4">
      <div className="flex items-start gap-3">
        <Icon className="mt-1 h-5 w-5 flex-shrink-0 text-slate-400" />
        <div className="flex-1">
          <p className="text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              {actionText}
            </span>{" "}
            {label}{" "}
            {href && item.entityTitle ? (
              <Link
                href={href}
                className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
              >
                &ldquo;{item.entityTitle}&rdquo;
              </Link>
            ) : item.entityTitle ? (
              <span className="font-semibold text-slate-700">
                &ldquo;{item.entityTitle}&rdquo;
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {formatTimeAgo(new Date(item.createdAt))}
          </p>
        </div>
      </div>
    </div>
  );
}
