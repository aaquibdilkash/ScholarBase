import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import {
  Newspaper,
  FileText,
  Search,
  BookCopy,
  Star,
  Calendar,
  GraduationCap,
  Briefcase,
  ClipboardList,
  BookMarked,
  BarChart,
  HelpCircle,
  CreditCard,
  MessageCircle,
  HandCoins,
} from "lucide-react";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { BrandMark } from "@/components/BrandMark";
import { SBIcon } from "@/components/SBIcon";

export const metadata: Metadata = buildMetadata({
  title: "ScholarBase: The Academic Hub for Researchers",
  description:
    "Connect with peers, publish your research, track supervisors, and discover PhD admissions, academic events, and vacancies in one focused workspace.",
  path: "/",
});

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
      icon: <Newspaper className="h-8 w-8" />,
    },
    {
      title: "Blog",
      description: "Publish and read research articles and insights.",
      href: "/blog",
      icon: <FileText className="h-8 w-8" />,
    },
    {
      title: "Research Tools",
      description: "Discover tools and software for your research.",
      href: "/research-tools",
      icon: <Search className="h-8 w-8" />,
    },
    {
      title: "Journals",
      description: "Browse academic journals and publications.",
      href: "/journals",
      icon: <BookCopy className="h-8 w-8" />,
    },
    {
      title: "Supervisors",
      description: "Find and review PhD supervisors and mentors.",
      href: "/supervisor",
      icon: <Star className="h-8 w-8" />,
    },
    {
      title: "Events",
      description: "Academic conferences, workshops, and seminars.",
      href: "/events",
      icon: <Calendar className="h-8 w-8" />,
    },
    {
      title: "Admissions",
      description: "PhD and research program admissions worldwide.",
      href: "/admissions",
      icon: <GraduationCap className="h-8 w-8" />,
    },
    {
      title: "Learn",
      description: "Access educational resources and courses.",
      href: "/learn",
      icon: <BookMarked className="h-8 w-8" />, // Reusing BookMarked for learn
    },
    {
      title: "Vacancies",
      description: "Academic job openings and research positions.",
      href: "/vacancies",
      icon: <Briefcase className="h-8 w-8" />,
    },
    {
      title: "Research Surveys",
      description: "Participate in or create academic surveys.",
      href: "/surveys",
      icon: <ClipboardList className="h-8 w-8" />,
    },
    {
      title: "Publications",
      description: "Share and discover academic publications.",
      href: "/publications",
      icon: <BookMarked className="h-8 w-8" />,
    },
    {
      title: "Results",
      description: "Exam results and academic outcome announcements.",
      href: "/results",
      icon: <BarChart className="h-8 w-8" />,
    },
    {
      title: "Scholar Suggest",
      description: "Get assistance and support from the community.",
      href: "/help",
      icon: <HelpCircle className="h-8 w-8" />,
    },
    {
      title: "Messages",
      description: "Chat with other scholars on the platform.",
      href: "/messages",
      icon: <MessageCircle className="h-8 w-8" />,
    },
    {
      title: "Contributions",
      description: "Support the platform and track contributions.",
      href: "/contributions",
      icon: <CreditCard className="h-8 w-8" />,
    },
    {
      title: "Grants",
      description: "Discover and apply for research grants.",
      href: "/grants",
      icon: <HandCoins className="h-8 w-8" />,
    },
  ];

  return (
    <div className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-6xl flex-col justify-center px-0 py-6">
      {/* Hero Section */}
      <section className="sb-surface overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="p-8 md:p-12 lg:p-14">
            <div className="mb-6 flex items-center gap-4">
              <SBIcon className="h-18 w-18 text-[30px] md:h-24 md:w-24 md:text-[44px]" />
              <div className="leading-tight">
                <BrandMark className="sb-heading 3xl md:text-6xl font-extrabold tracking-tight" />
                <div className="xl md:text-2xl text-slate-500 dark:text-slate-400">
                  Research Community Platform
                </div>
              </div>
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
