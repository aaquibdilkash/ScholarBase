/** Posts vs Comments sub-view toggle used across the admin content tables. */
export type ContentView = "posts" | "comments";

export interface AdminSection {
  id: string;
  title: string;
  href: string;
}

/** Sidebar + stats-card sections. Ordered by precedence; "appeals" and
 *  "users" have no public route (they're admin-only). */
export const ADMIN_SECTIONS: AdminSection[] = [
  { id: "appeals", title: "Appeals", href: "#" },
  { id: "feed", title: "Feed", href: "/feed" },
  { id: "blog", title: "Blog", href: "/blog" },
  { id: "publications", title: "Publications", href: "/publications" },
  { id: "journals", title: "Journals", href: "/journals" },
  { id: "researchTools", title: "Research Tools", href: "/research-tools" },
  { id: "admissions", title: "Admissions", href: "/admissions" },
  { id: "events", title: "Events", href: "/events" },
  { id: "vacancies", title: "Vacancies", href: "/vacancies" },
  { id: "help", title: "Help", href: "/help" },
  { id: "results", title: "Results", href: "/results" },
  { id: "contributions", title: "Contributions", href: "/contributions" },
  { id: "supervisors", title: "Supervisors", href: "/supervisor" },
  { id: "recommendations", title: "Recommendations", href: "/supervisor" },
  { id: "surveys", title: "Surveys", href: "/surveys" },
  { id: "users", title: "Users", href: "#" },
];

// Section id -> contentType key expected by toggleContentFreeze /
// moderateContent (reports.ts). Do NOT derive these by stripping the
// trailing "s" — feed/help/blog have no plural, vacancies → vacancie, etc.
export const SECTION_CONTENT_TYPES: Record<string, string> = {
  feed: "feed",
  blog: "blog",
  publications: "publication",
  journals: "journal",
  researchTools: "researchTool",
  admissions: "admission",
  events: "event",
  vacancies: "vacancy",
  help: "help",
  results: "result",
  contributions: "contribution",
  supervisors: "supervisor",
  recommendations: "recommendation",
  surveys: "survey",
  users: "SCHOLAR_PROFILE",
};