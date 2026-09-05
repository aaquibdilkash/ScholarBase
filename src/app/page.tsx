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
  Code2,
  Sparkles,
  Globe2,
  Users,
  HeartHandshake,
  Megaphone,
  Bug,
  SearchCheck,
  Mail,
  ArrowRight,
} from "lucide-react";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { BrandMark } from "@/components/BrandMark";
import { SBIcon } from "@/components/SBIcon";

export const metadata: Metadata = buildMetadata({
  title: "ScholarBase: A Quiet Workspace for the Noisy Academic Life",
  description:
    "Post your research, find honest PhD supervisors, and track admissions, events, and vacancies — all in one free, community-run workspace with no ads or paywalls.",
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
    <div className="mx-auto max-w-6xl px-0 py-6 sm:py-8 md:py-10">
      {/* Hero Section */}
      <section className="sb-surface overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          {/* Top Left: Headline & CTAs */}
          <div className="flex flex-col justify-center p-6 sm:p-8 md:p-10 lg:p-12 xl:p-14">
            <div className="mb-5 flex items-center gap-3 sm:gap-4">
              <SBIcon className="h-14 w-14 text-[26px] sm:h-20 sm:w-20 sm:text-[36px] md:h-24 md:w-24 md:text-[44px]" />
              <div className="leading-tight">
                <BrandMark className="sb-heading text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight" />
                <div className="text-base sm:text-xl md:text-2xl text-slate-500 dark:text-slate-400">
                  Research Community Platform
                </div>
              </div>
            </div>

            <h1 className="sb-heading !text-2xl sm:!text-3xl md:!text-4xl lg:!text-5xl max-w-3xl font-extrabold tracking-tight">
              One quiet workspace for the noisy academic life
            </h1>
            <h2 className="mt-3 sm:mt-4 max-w-3xl text-lg sm:text-xl md:text-2xl lg:text-3xl font-semibold tracking-tight text-slate-800 dark:text-slate-200">
              The academic hub for scholars, supervisors, surveys, and opportunities.
            </h2>

            <p className="sb-subtitle mt-5 sm:mt-6 max-w-2xl">
              Post your research, find honest PhD supervisors, track admissions
              and conferences, and surface what the community actually finds
              useful, all without ads, paywalls, or another inbox to babysit.
            </p>

            <div className="mt-7 sm:mt-8 flex flex-col gap-3 sm:flex-row">
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

          {/* Top Right: Live Pulse Cards */}
          <div className="sb-surface-soft border-t p-6 sm:p-8 md:p-10 lg:border-l lg:border-t-0 dark:border-slate-800 dark:bg-slate-900/60">
            
            <div className="grid gap-4">
              <StatCard
                icon={<ClipboardList className="h-5 w-5" />}
                accent="amber"
                title="Research Surveys"
                value="Active data collection"
                hint="Scholar-built studies you can join today"
              />
              <StatCard
                icon={<Star className="h-5 w-5" />}
                accent="violet"
                title="Supervisor Reviews"
                value="Community recommended"
                hint="Honest reviews from real PhD scholars"
              />
              <StatCard
                icon={<Newspaper className="h-5 w-5" />}
                accent="blue"
                title="Research Feed"
                value="Real-time updates"
                hint="Fresh posts from scholars across every field"
              />
              <StatCard
                icon={<HandCoins className="h-5 w-5" />}
                accent="emerald"
                title="Opportunities"
                value="Grants & vacancies"
                hint="Funding calls and research positions, in one place"
              />
            </div>
          </div>

          {/* Bottom Full-Width: Field notes spanning across both columns */}
          <div className="border-t sb-surface-soft p-6 sm:p-8 md:p-10 lg:col-span-2 lg:p-12 dark:border-slate-800 dark:bg-slate-900/40">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">
              Field notes from the founders
            </p>
            <div className="mt-4 grid gap-5 sm:gap-6 md:grid-cols-3 text-base leading-relaxed text-slate-700 dark:text-slate-300">
              <p>
                We started ScholarBase after one too many evenings hunting PhD
                deadlines across nine browser tabs, three WhatsApp groups, and a
                PDF named <span className="italic">final_v3_REALFINAL.pdf</span>.
                Turns out, the academic world doesn&apos;t need another social
                network — it needs a single, calm room where the good stuff
                actually floats to the top.
              </p>
              <p>
                No investors. No ads. No &ldquo;premium research tier.&rdquo; Just an
                open-source codebase, a stubborn belief in free knowledge, and
                a community that, against all odds, keeps voting for the
                useful stuff.
              </p>
              <p>
                Bring your work, your weird niche, your unanswered question.
                We&apos;ll keep the room quiet.
              </p>
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

      {/* Our Story — personality */}
      <section className="mt-16 sb-surface p-8 md:p-12">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-200/70 bg-blue-50/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
            <HeartHandshake className="h-3.5 w-3.5" />
            Our story
          </span>
          <h2 className="mt-5 text-2xl md:text-3xl font-bold tracking-tight text-slate-950">
            Built by scholars, for scholars; because opportunity shouldn&apos;t depend on being in the right group chat.
          </h2>
          <div className="mt-6 space-y-4 text-base md:text-lg leading-relaxed text-slate-600 dark:text-slate-400">
            <p>
              Every researcher knows the struggle. PhD admissions, journal calls, conference deadlines, research vacancies scattered across dozens of websites, mailing lists, and screenshots that get lost in the noise.
            </p>
            <p>
              So we built one open place where the academic community itself shares, discovers, and discusses what matters and where the best contributions rise through community votes, not advertising budgets.
            </p>
            <p>
              We&apos;re <strong className="text-slate-900 dark:text-slate-200">fully open source</strong>, with no company, no investors, and no revenue engine. ScholarBase answers only to its users and every feature ships because the community asked for it.
            </p>
          </div>
          <div className="mt-7">
            <Link
              href="/about"
              className="inline-flex items-center gap-2 text-sm md:text-base font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
            >
              Read the full story
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* What we believe — values grid */}
      <section className="mt-12">
        <div className="mx-auto max-w-3xl text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-950">
            What we believe
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            Four principles that decide every feature we ship.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Code2,
              title: "Open source",
              desc: "Every line of code is public. Anyone can read it, contribute to it, or build on it.",
              iconWrap: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300",
            },
            {
              icon: Sparkles,
              title: "Knowledge should be free",
              desc: "No paywalls. No premium tiers for core features. Ever.",
              iconWrap: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
            },
            {
              icon: Users,
              title: "Reputation is earned",
              desc: "Community votes decide what deserves attention — not ad budgets.",
              iconWrap: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
            },
            {
              icon: Globe2,
              title: "Borderless access",
              desc: "From Mumbai to Nairobi to São Paulo — the same free platform, for every scholar.",
              iconWrap: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
            },
          ].map(({ icon: Icon, title, desc, iconWrap }) => (
            <div
              key={title}
              className="sb-card sb-card-hover flex flex-col gap-3 p-6"
            >
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconWrap}`}>
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-950 dark:text-slate-50">
                {title}
              </h3>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Join the team — careers teaser */}
      <section className="mt-12 sb-surface-strong p-8 md:p-12">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/70 bg-emerald-50/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              <Megaphone className="h-3.5 w-3.5" />
              Join the team
            </span>
            <h2 className="mt-5 text-2xl md:text-3xl font-bold tracking-tight text-slate-950">
              We can&apos;t pay you — yet. But we can teach you what your first job probably won&apos;t.
            </h2>
            <p className="mt-4 text-slate-600 dark:text-slate-400 leading-relaxed">
              ScholarBase is fully open-source with no revenue behind it — by design. So instead of a paycheck, we offer hands-on mentorship on a live platform used by scholars around the world. Your campaigns, curated listings, and bug reports are public, credited to you, and interview-ready.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <Link href="/careers" className="sb-button-accent">
                See open tracks
              </Link>
              <a
                href="mailto:connect@scholarbase.app?subject=Joining%20ScholarBase%20—%20CV"
                className="sb-button-soft"
              >
                <Mail className="h-4 w-4 mr-2 inline" />
                Send your CV
              </a>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: Megaphone,
                title: "Growth & Marketing",
                desc: "Reach scholars one campus at a time.",
                iconWrap: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300",
              },
              {
                icon: Bug,
                title: "Testing & QA",
                desc: "Hunt every bug before our users do.",
                iconWrap: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
              },
              {
                icon: SearchCheck,
                title: "Research & Curation",
                desc: "Verify and build the directories scholars rely on.",
                iconWrap: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
              },
            ].map(({ icon: Icon, title, desc, iconWrap }) => (
              <div
                key={title}
                className="sb-card sb-card-hover p-5"
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconWrap}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-slate-950 dark:text-slate-50">
                  {title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {desc}
                </p>
              </div>
            ))}
          </div>
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

      {/* Asterisk note */}
      <p className="mt-12 text-center text-sm text-slate-400 dark:text-slate-500 italic">
        * ScholarBase runs on chai, coffee, and the quiet belief that
        academics deserve a homepage that doesn&apos;t try to sell them
        something. The cards above are non-negotiable. The em dashes,
        however, are a lifestyle choice — and yes, we are aware that one of
        them is hiding in this very footnote. We&apos;re not telling which
        one.
      </p>
    </div>
  );
}

function StatCard({
  icon,
  accent = "blue",
  title,
  value,
  hint,
}: {
  icon?: React.ReactNode;
  accent?: "blue" | "violet" | "emerald" | "amber";
  title: string;
  value: string;
  hint?: string;
}) {
  const accents: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300",
    violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  };
  return (
    <div
      className="group sb-card flex items-start gap-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        {icon && (
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${accents[accent]}`}>
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <p className="mt-1.5 text-lg font-semibold leading-snug text-slate-950 dark:text-slate-50">
            {value}
          </p>
          {hint && (
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {hint}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
