import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-6xl flex-col justify-center px-0 py-6">
      <section className="sb-surface overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="p-8 md:p-12 lg:p-14">
            <div className="mb-6 inline-flex rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">
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

          <div className="border-t border-white/70 bg-white/55 p-8 md:p-10 lg:border-l lg:border-t-0">
            <div className="grid gap-4">
              <StatCard title="Research Posts" value="Fast updates" />
              <StatCard title="Supervisor Reviews" value="Verified notes" />
              <StatCard title="Opportunities" value="Always current" />
            </div>
          </div>
        </div>
      </section>

      <div className="mt-8 grid w-full gap-6 md:grid-cols-3 text-left">
        <FeatureCard
          title="Share Research"
          description="Publish blogs, discuss empirical findings, and build your academic portfolio."
        />
        <FeatureCard
          title="Find Supervisors"
          description="Read reviews and recommendations for university faculty before applying."
        />
        <FeatureCard
          title="Track Vacancies"
          description="Stay updated on the latest PhD admissions, JRF, and academic job openings."
        />
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-slate-200/70 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
        {title}
      </p>
      <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="sb-card sb-card-hover">
      <h3 className="mb-2 text-lg font-semibold text-slate-950">{title}</h3>
      <p className="leading-relaxed text-slate-600">{description}</p>
    </div>
  );
}
