import { getProfileSections } from "@/app/actions/profile";

export type SectionData = Awaited<ReturnType<typeof getProfileSections>>;
export type SectionKey = Exclude<keyof NonNullable<SectionData>, "id" | "_count">;
export type ArticleType = NonNullable<SectionData>["articles"][number];
export type SocialPostType = NonNullable<SectionData>["socialPosts"][number];
export type VacancyType = NonNullable<SectionData>["vacancies"][number];
export type AdmissionType = NonNullable<SectionData>["admissions"][number];
export type EventType = NonNullable<SectionData>["events"][number];
export type HelpPostType = NonNullable<SectionData>["helpPosts"][number];
export type JournalType = NonNullable<SectionData>["journals"][number];
export type ResearchToolType = NonNullable<SectionData>["researchTools"][number];
export type RecommendationType = NonNullable<SectionData>["recommendations"][number];
export type SupervisorType = NonNullable<SectionData>["supervisors"][number];
export type ResultType = NonNullable<SectionData>["results"][number];
export type ContributionType = NonNullable<SectionData>["contributionPosts"][number];
export type PublicationType = NonNullable<SectionData>["publications"][number];
export type SurveyType = NonNullable<SectionData>["surveys"][number];

export type SectionConfig = {
    [K in SectionKey]: {
      key: K;
      title: string;
      emptyMessage: string;
      renderItems: (
        items: NonNullable<SectionData>[K],
        currentUserId?: string,
      ) => React.ReactNode;
    };
  }[SectionKey];

export type SectionWithCount = SectionConfig & { count?: number };
