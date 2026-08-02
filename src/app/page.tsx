import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "ScholarBase: The Academic Hub for Researchers",
  description:
    "Connect with peers, publish your research, track supervisors, and discover PhD admissions, academic events, and vacancies in one focused workspace.",
};

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const features = [
    {
      title: "Feed",
      description: "Short research updates from the community.",
      href: "/feed",
      icon: (
        <svg
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5L18.5 7H20z"
          />
        </svg>
      ),
    },
    {
      title: "Blog",
      description: "Publish and read research articles and insights.",
      href: "/blog",
      icon: (
        <svg
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
    {
      title: "Research Tools",
      description: "Discover tools and software for your research.",
      href: "/research-tools",
      icon: (
        <svg
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      ),
    },
    {
      title: "Journals",
      description: "Browse academic journals and publications.",
      href: "/journals",
      icon: (
        <svg
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      ),
    },
    {
      title: "Supervisors",
      description: "Find and review PhD supervisors and mentors.",
      href: "/supervisor",
      icon: (
        <svg
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
          />
        </svg>
      ),
    },
    {
      title: "Events",
      description: "Academic conferences, workshops, and seminars.",
      href: "/events",
      icon: (
        <svg
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    {
      title: "Admissions",
      description: "PhD and research program admissions worldwide.",
      href: "/admissions",
      icon: (
        <svg
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M12 14l9-5-9-5-9 5 9 5z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
          />
        </svg>
      ),
    },
    {
      title: "Vacancies",
      description: "Academic job openings and research positions.",
      href: "/vacancies",
      icon: (
        <svg
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    {
      title: "Research Surveys",
      description: "Participate in or create academic surveys.",
      href: "/surveys",
      icon: (
        <svg
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
      ),
    },
    {
      title: "Publications",
      description: "Share and discover academic publications.",
      href: "/publications",
      icon: (
        <svg
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5l-1.5-1.5H18V9l1 1v9a1 1 0 01-1 1zM9 12h3m-3 4h6"
          />
        </svg>
      ),
    },
    {
      title: "Results",
      description: "Exam results and academic outcome announcements.",
      href: "/results",
      icon: (
        <svg
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      ),
    },
    {
      title: "Help",
      description: "Get assistance and support from the community.",
      href: "/help",
      icon: (
        <svg
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M8.257 13.257A6 6 0 1114 6h-1a3 3 0 00-3 3v1m0 4h.01M12 18h.01"
          />
        </svg>
      ),
    },
    {
      title: "Contributions",
      description: "Support the platform and track contributions.",
      href: "/contributions",
      icon: (
        <svg
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-6xl flex-col justify-center px-0 py-6">
      {/* Hero Section */}
      <section className="sb-surface overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="p-8 md:p-12 lg:p-14">
            <div className="mb-6 inline-flex rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200">
              Research community platform
            </div>

            <h1 className="sb-heading max-w-3xl">
              The academic hub for scholars, supervisors, and opportunities.
            </h1>

            <p className="sb-subtitle mt-6 max-w-2xl">
              Connect with peers, publish your research, track supervisors, and
              discover PhD admissions, academic events, and vacancies in one
              focused workspace.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              {user ? (
                <Link href="/feed" className="sb-button-accent">
                  Go to Your Feed
                </Link>
              ) : (
                <>
                  <Link href="/login" className="sb-button-accent">
                    Join the Community
                  </Link>
                  <Link href="/blog" className="sb-button-soft">
                    Read Research Blogs
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="border-t border-white/70 bg-white/55 p-8 md:p-10 lg:border-l lg:border-t-0 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="grid gap-4">
              <StatCard title="Research Posts" value="Fast updates" />
              <StatCard title="Supervisor Reviews" value="Verified notes" />
              <StatCard title="Opportunities" value="Always current" />
              <StatCard title="Open Source" value="Community driven" />
            </div>
          </div>
        </div>
      </section>

      {/* All Features Grid */}
      <section className="mt-12">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-950 mb-8 text-center">
          Everything You Need for Your Academic Journey
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {features.map((feature) => (
            <Link
              key={feature.title}
              href={feature.href}
              className="sb-card sb-card-hover group flex flex-col gap-4"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors dark:bg-blue-500/15 dark:text-blue-300 dark:group-hover:bg-blue-500/25">
                {feature.icon}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-950 group-hover:text-blue-700 transition-colors dark:text-slate-50 dark:group-hover:text-blue-300">
                  {feature.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {feature.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      {!user && (
        <section className="mt-16 sb-surface-strong p-10 md:p-14 text-center">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-950">
            Ready to Join the Community?
          </h2>
          <p className="mt-3 text-slate-600 max-w-lg mx-auto">
            Sign up for free and start connecting with fellow researchers,
            discovering opportunities, and sharing your work.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/login" className="sb-button-accent">
              Create Your Account
            </Link>
            <Link href="/feed" className="sb-button-soft">
              Browse Public Feed
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-slate-200/70 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
        {title}
      </p>
      <p className="mt-3 text-2xl font-semibold text-slate-950 dark:text-slate-50">
        {value}
      </p>
    </div>
  );
}
