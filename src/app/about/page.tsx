import Link from "next/link";
import { buildMetadata } from "@/lib/seo";
import { ArrowRight, BookOpen, Globe2, HeartHandshake, Sparkles, Users } from "lucide-react";

export const metadata = buildMetadata({
  title: "About Us | ScholarBase",
  description:
    "Learn about ScholarBase — a free, community-driven academic platform. Discover our motivation, our values, and how we help scholars and academia globally.",
  path: "/about",
  keywords: [
    "about ScholarBase",
    "academic networking platform",
    "free platform for researchers",
    "academic community",
    "PhD admissions and research opportunities",
  ],
});

const features = [
  {
    icon: BookOpen,
    title: "Share What Matters",
    description:
      "Publish articles, PhD admission updates, journal calls, vacancies, events, and results — all in one place, visible to scholars everywhere.",
  },
  {
    icon: Users,
    title: "A Community That Votes",
    description:
      "Community-driven voting surfaces the most useful contributions, so good academic work gets the visibility it deserves.",
  },
  {
    icon: Globe2,
    title: "Borderless Access",
    description:
      "No paywalls, no subscriptions, no gatekeeping. Every scholar — from Mumbai to Nairobi to São Paulo — gets the same free access.",
  },
  {
    icon: HeartHandshake,
    title: "Built With the Community",
    description:
      "ScholarBase improves because its users speak up. Feature requests, feedback, and contributions directly shape the roadmap.",
  },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen py-12 sm:py-16 md:py-20">
      <div className="sb-shell">
        <div className="mx-auto max-w-3xl">
          {/* Hero */}
          <div className="text-center mb-12 sm:mb-16">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-950 dark:text-slate-50 mb-4 sm:mb-6">
              About ScholarBase
            </h1>
            <p className="text-xl sm:text-2xl text-slate-600 dark:text-slate-400">
              A free, community-driven home for the global academic community — built by scholars, for scholars.
            </p>
          </div>

          {/* Our Story */}
          <section className="mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Why We Built This
            </h2>
            <div className="space-y-4 text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
              <p>
                Every researcher knows the struggle. Important opportunities — PhD admissions, journal calls, conference deadlines, research vacancies — are scattered across dozens of websites, WhatsApp groups, mailing lists, and screenshots that get lost in the noise. Meanwhile, academic social networks that do exist are either paywalled, ad-heavy, or designed for institutions rather than individuals.
              </p>
              <p>
                ScholarBase started with a simple question: <strong className="text-slate-900 dark:text-slate-200">why should a brilliant student&apos;s access to opportunity depend on being in the right group chat?</strong> We decided the answer was to build one open platform where the academic community itself shares, discovers, and discusses what matters — and where the best contributions rise to the top through community votes, not advertising budgets.
              </p>
              <p>
                We are a small, independent team with no external funding. That independence is a feature: it means ScholarBase answers only to its users, and every feature we ship is chosen because the community asked for it.
              </p>
            </div>
          </section>

          {/* What ScholarBase Does */}
          <section className="mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-slate-100 mb-6">
              How ScholarBase Helps Academia Globally
            </h2>
            <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
              {features.map(({ icon: Icon, title, description }) => (
                <div key={title} className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
                  </div>
                  <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">{description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Our Values */}
          <section className="mb-12 sm:mb-16 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 md:p-10 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-slate-100 mb-4">
              What We Believe
            </h2>
            <ul className="space-y-3 text-lg text-slate-600 dark:text-slate-400">
              <li className="flex gap-3">
                <Sparkles className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
                <span>
                  <strong className="text-slate-900 dark:text-slate-200">Knowledge should be free.</strong> No paywalls, no premium tiers for core features, ever.
                </span>
              </li>
              <li className="flex gap-3">
                <Users className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
                <span>
                  <strong className="text-slate-900 dark:text-slate-200">Reputation is earned, not bought.</strong> Community votes decide what deserves attention.
                </span>
              </li>
              <li className="flex gap-3">
                <Globe2 className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
                <span>
                  <strong className="text-slate-900 dark:text-slate-200">Opportunity should not depend on geography.</strong> A scholar anywhere deserves access to everything.
                </span>
              </li>
            </ul>
          </section>

          {/* CTA */}
          <section className="text-center">
            <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Join the Community
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-6 max-w-xl mx-auto">
              Whether you&apos;re a PhD aspirant, a professor, a journal editor, or simply curious — there&apos;s a place for you here.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-blue-700">
                Explore ScholarBase
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/contact" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-base font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
                Get in Touch
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
