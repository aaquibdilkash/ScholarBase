import prisma from "@/lib/db";
import Link from "next/link";
import RecommendationForm from "@/app/supervisor/components/RecommendationForm";

export default async function RecommendSupervisorNew({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const supervisor = await prisma.supervisor.findUnique({
    where: { id },
    select: { name: true },
  });

  return (
    <main className="max-w-3xl mx-auto py-10 px-4">
      <div className="mb-8">
        <Link
          href={`/supervisor/${id}`}
          className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-blue-600 mb-6 transition-colors"
        >
          ← Cancel
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Recommend {supervisor?.name}
        </h1>
        <p className="text-slate-500 mt-2">
          Help fellow scholars by sharing your positive mentorship experience
          with {supervisor?.name}.
        </p>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 p-8 md:p-10">
        <RecommendationForm mode="create" supervisorId={id} />
      </div>
    </main>
  );
}
