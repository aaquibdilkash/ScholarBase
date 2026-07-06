import prisma from "@/lib/db";
import Link from "next/link";

export default async function SupervisorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supervisor = await prisma.supervisor.findUnique({
    where: { id },
    include: { reviews: { include: { author: true } } },
  });

  if (!supervisor)
    return (
      <div className="p-8 text-center text-slate-500 font-medium">
        Supervisor not found
      </div>
    );

  return (
    <main className="max-w-4xl mx-auto py-10 px-4">
      <Link
        href="/supervisor"
        className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-blue-600 mb-8 transition-colors"
      >
        ← Back to Search
      </Link>

      {/* Profile Header Card */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 p-8 md:p-10 mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
            {supervisor.name}
          </h1>
          <p className="text-lg text-slate-500 font-medium">
            {supervisor.university}
          </p>
          {supervisor.department && (
            <p className="text-sm text-slate-400 mt-1">
              {supervisor.department}
            </p>
          )}
        </div>

        <Link
          href={`/supervisor/${supervisor.id}/recommend`}
          className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold shadow-sm shadow-blue-600/20 hover:bg-blue-700 hover:shadow-md hover:shadow-blue-600/30 transition-all duration-200 whitespace-nowrap"
        >
          + Recommend
        </Link>
      </div>

      {/* Recommendations List */}
      <div className="space-y-6">
        <h3 className="text-2xl font-bold text-slate-900 mb-6">
          Recommendations ({supervisor.reviews.length})
        </h3>

        {supervisor.reviews.length === 0 ? (
          <p className="text-slate-500 bg-white p-8 rounded-2xl border border-slate-200/60 text-center">
            No recommendations yet. Be the first to share your experience!
          </p>
        ) : (
          supervisor.reviews.map((r) => (
            <div
              key={r.id}
              className="bg-white p-6 border border-slate-200/60 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-100 transition-all duration-300"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="bg-blue-50 text-blue-700 text-sm font-bold px-3 py-1 rounded-full">
                  {r.rating}/5 Stars
                </span>
                <Link
                  href={`/scholar/${r.author.id}`}
                  className="font-bold hover:underline"
                >
                  <span className="text-sm font-medium text-slate-400 ml-auto">
                    By {r.author?.name || "Anonymous Scholar"}
                  </span>
                </Link>
              </div>
              <p className="text-slate-700 leading-relaxed mt-2">
                {r.feedback}
              </p>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
