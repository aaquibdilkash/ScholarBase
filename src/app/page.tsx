import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="max-w-5xl mx-auto flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
      <div className="space-y-6">
        <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight">
          The Academic Hub for <br className="hidden md:block" />
          <span className="text-blue-600">Scholars & Researchers</span>
        </h1>

        <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Connect with peers, track your publications, find the right
          supervisor, and discover PhD admissions and JRF vacancies all in one
          place.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
          {user ? (
            <Link
              href="/feed"
              className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition shadow-sm"
            >
              Go to Your Feed
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition shadow-sm"
              >
                Join the Community
              </Link>
              <Link
                href="/blog"
                className="px-8 py-3 bg-white text-slate-700 font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition shadow-sm"
              >
                Read Research Blogs
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 text-left w-full">
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

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition">
      <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600 leading-relaxed">{description}</p>
    </div>
  );
}
