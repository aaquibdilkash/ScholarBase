import Link from "next/link";
import { buildMetadata } from "@/lib/seo";
import { Bug, GraduationCap, Heart, Mail, Megaphone, Rocket, SearchCheck, TrendingUp } from "lucide-react";

export const metadata = buildMetadata({
  title: "Careers | ScholarBase",
  description:
    "Join ScholarBase — an unpaid early-career opportunity in growth marketing, software QA, or research curation on a live academic platform. Send your CV and grow with us.",
  path: "/careers",
  keywords: [
    "ScholarBase careers",
    "volunteer growth marketing",
    "software testing internship",
    "QA training for beginners",
    "early career opportunity",
    "research curation",
    "academic content curator",
  ],
});

const growthLearnings = [
  "How to identify and understand a platform's potential users — researchers, PhD aspirants, professors — and speak their language.",
  "Community-led growth: reaching scholars one scholar at a time, and universities one campus at a time.",
  "Writing content and campaigns that actually convert, and measuring what worked with real analytics.",
  "Positioning, storytelling, and how a zero-budget product competes for attention.",
];

const qaLearnings = [
  "Structured exploratory testing — hunting every teeny-tiny bug hiding in every corner of the product.",
  "Thinking in edge cases: empty states, slow networks, weird inputs, timezone traps, and every scenario users didn't read the manual for.",
  "Writing clear, reproducible bug reports that developers love — with steps, evidence, and severity.",
  "Working directly with developers to reproduce, isolate, and verify fixes until quality is airtight."
];

const curationLearnings = [
  "How to hunt down and verify genuine opportunities — PhD admissions, research vacancies, academic events, and exam results — from official sources only.",
  "Fact-checking discipline: cross-referencing deadlines, eligibility, and links so scholars never chase stale or fake opportunities.",
  "Building structured directories — PhD supervisors, research grants, research tools, the learning zone, and research journals — entry by verified entry.",
  "Organising academic information the way scholars actually search for it, so ScholarBase becomes the first place they check.",
];

const whatYouGet = [
  {
    icon: Rocket,
    title: "Real Platform, Real Users",
    description:
      "Skip the toy projects. Everything you do — campaigns, curated listings, bug reports — happens on a live, open-source platform used by scholars around the world, and your contributions are public for anyone to see.",
  },
  {
    icon: GraduationCap,
    title: "Skills Employers Actually Ask For",
    description:
      "Growth marketing, quality assurance, and research curation are three of the most in-demand, hard-to-teach skills. You'll learn them by doing, not by watching tutorials.",
  },
  {
    icon: Heart,
    title: "Mentorship & Honest Feedback",
    description:
      "Every experiment, campaign, and bug report gets detailed feedback. You'll learn the why behind every decision, not just the what.",
  },
  {
    icon: TrendingUp,
    title: "Visible Impact You Can Claim",
    description:
      "Grew signups from a new campus? Caught a critical bug before launch? That's a measurable, interview-ready achievement with your name on it.",
  },
];

export default function CareersPage() {
  return (
    <main className="min-h-screen py-12 sm:py-16 md:py-20">
      <div className="sb-shell">
        <div className="mx-auto max-w-3xl">
          {/* Hero */}
          <div className="text-center mb-12 sm:mb-16">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-950 dark:text-slate-50 mb-4 sm:mb-6">
              Join ScholarBase
            </h1>
            <p className="text-xl sm:text-2xl text-slate-600 dark:text-slate-400">
              An honest offer: we can&apos;t pay you — yet. But we can teach you skills your first job probably won&apos;t.
            </p>
          </div>

          {/* The Honest Pitch */}
          <section className="mb-12 sm:mb-16 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 md:p-10 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3 mb-4">
              <Heart className="h-6 w-6 text-rose-600 dark:text-rose-400" />
              <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-slate-100">
                Let&apos;s Be Honest With You
              </h2>
            </div>
            <div className="space-y-4 text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
              <p>
                ScholarBase is a <strong className="text-slate-900 dark:text-slate-200">fully open-source</strong> platform — built for the community, by the community. Our entire codebase is public on{" "}
                {/* <a href="https://github.com/" target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"> */}
                GitHub
                {/* </a> */}
                , and we don&apos;t run ads, we don&apos;t charge users, and we don&apos;t have investors.
              </p>
              <p>
                That&apos;s exactly why, quite simply: <strong className="text-slate-900 dark:text-slate-200">we can&apos;t pay you right now.</strong> There is no revenue behind this platform — by design. It exists to serve scholars, not to earn from them.
              </p>
              <p>
                What we <em>can</em> offer is something far more valuable for your early journey: <strong className="text-slate-900 dark:text-slate-200">the opportunity to learn how a real platform grows and how real software is tested</strong> — hands-on, with mentorship, and with your name on the results.
              </p>
            </div>
          </section>

          {/* Two Tracks */}
          <section className="mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Pick Your Track
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">
              Three ways to grow with us — and with your own career.
            </p>

            {/* Growth Track */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 mb-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Megaphone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Growth &amp; Marketing</h3>
                  <p className="text-base text-slate-500 dark:text-slate-400">Learn how to market a platform to its potential users</p>
                </div>
              </div>
              <p className="text-lg text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                You&apos;ll take ScholarBase to the people it was built for — <strong className="text-slate-900 dark:text-slate-200">scholar by scholar, university by university</strong>. Campus by campus, community by community, you&apos;ll figure out what makes academics care, sign up, and stay. Along the way you&apos;ll learn:
              </p>
              <ul className="space-y-2.5">
                {growthLearnings.map((item) => (
                  <li key={item} className="flex gap-3 text-lg text-slate-600 dark:text-slate-400">
                    <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* QA Track */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 mb-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <Bug className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Testing &amp; Quality Assurance</h3>
                  <p className="text-base text-slate-500 dark:text-slate-400">Learn how professionals find every bug, in every corner</p>
                </div>
              </div>
              <p className="text-lg text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                You&apos;ll put ScholarBase through every scenario a real user could throw at it — and plenty they shouldn&apos;t. Our developers will know about <strong className="text-slate-900 dark:text-slate-200">every teeny-tiny bug in every corner </strong>before our users ever find them. Along the way you&apos;ll learn:
              </p>
              <ul className="space-y-2.5">
                {qaLearnings.map((item) => (
                  <li key={item} className="flex gap-3 text-lg text-slate-600 dark:text-slate-400">
                    <span className="text-emerald-600 dark:text-emerald-400 mt-1">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Research & Curation Track */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <SearchCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Research &amp; Curation</h3>
                  <p className="text-base text-slate-500 dark:text-slate-400">Find verified opportunities and build the directories scholars rely on</p>
                </div>
              </div>
              <p className="text-lg text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                You&apos;ll grow ScholarBase&apos;s most valuable asset: <strong className="text-slate-900 dark:text-slate-200">trustworthy information</strong>. That means finding and verifying opportunities in <strong className="text-slate-900 dark:text-slate-200">admissions, vacancies, events, and results</strong>, and building our directories — <strong className="text-slate-900 dark:text-slate-200">PhD supervisors, research grants, research tools, the learning zone, and research journals </strong>— so scholars everywhere get one reliable place for everything academic. Along the way you&apos;ll learn:
              </p>
              <ul className="space-y-2.5">
                {curationLearnings.map((item) => (
                  <li key={item} className="flex gap-3 text-lg text-slate-600 dark:text-slate-400">
                    <span className="text-amber-600 dark:text-amber-400 mt-1">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* What You Get */}
          <section className="mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-slate-100 mb-6">
              What You&apos;ll Get Instead of a Paycheck
            </h2>
            <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
              {whatYouGet.map(({ icon: Icon, title, description }) => (
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

          {/* Who We're Looking For */}
          <section className="mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Who We&apos;re Looking For
            </h2>
            <div className="space-y-4 text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
              <p>
                Students, fresh graduates, and early-career folks who want to break into growth marketing or software QA. We don&apos;t care much about your degree or your college name — we care about:
              </p>
              <ul className="space-y-2.5 pl-1">
                <li className="flex gap-3">
                  <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
                  <span><strong className="text-slate-900 dark:text-slate-200">Curiosity</strong> — you wonder why people do what they do, or why things break the way they break.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
                  <span><strong className="text-slate-900 dark:text-slate-200">Ownership</strong> — when you take something on, you see it through.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
                  <span><strong className="text-slate-900 dark:text-slate-200">A few hours a week</strong> — flexible and remote; consistency matters more than intensity.</span>
                </li>
              </ul>
            </div>
          </section>

          {/* How to Apply */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 md:p-10 dark:border-slate-800 dark:bg-slate-900 text-center">
            <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Ready to Grow With Us?
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-2 max-w-xl mx-auto leading-relaxed">
              Send your CV to <a href="mailto:connect@scholarbase.app?subject=Joining%20ScholarBase%20—%20CV" className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">connect@scholarbase.app</a> with the subject line <span className="font-semibold text-slate-900 dark:text-slate-200">&quot;Joining ScholarBase&quot;</span>.
            </p>
            <p className="text-lg text-slate-500 dark:text-slate-400 mb-8 max-w-xl mx-auto leading-relaxed">
              Along with your CV, tell us one thing: <strong className="text-slate-700 dark:text-slate-300">which of the three tracks do you want, and how would you use it to grow ScholarBase? </strong>A campus you&apos;d start with, a community you&apos;d reach, or the first corner of the app you&apos;d tear apart looking for bugs — we want to see how you think.
            </p>
            <a href="mailto:connect@scholarbase.app?subject=Joining%20ScholarBase%20—%20CV" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-blue-700">
              <Mail className="h-5 w-5" />
              Send Your CV
            </a>
            <p className="mt-6 text-base text-slate-500 dark:text-slate-400">
              Want to learn more about the platform first? <Link href="/about" className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">Read our story</Link>.
            </p>
          </section>

          {/* Asterisk note */}
          <p className="mt-12 text-center text-sm text-slate-400 dark:text-slate-500 italic">
            * All em dashes on this page are 100% human-written. An AI would
            have used far more of them — believe us — and we simply refuse to
            be outdashed by a machine. Yes, we see the irony of that sentence.
          </p>
        </div>
      </div>
    </main>
  );
}
