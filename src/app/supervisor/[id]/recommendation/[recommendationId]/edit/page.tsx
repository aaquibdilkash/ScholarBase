import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireCurrentUser } from "@/lib/auth";
import RecommendationForm from "@/app/supervisor/components/RecommendationForm";

export default async function EditRecommendationPage({
  params,
}: {
  params: Promise<{ id: string; recommendationId: string }>;
}) {
  const { id, recommendationId } = await params;
  const user = await requireCurrentUser(
    "You must be logged in to edit this recommendation.",
  );

  const recommendation = await prisma.recommendation.findUnique({
    where: { id: recommendationId },
    select: {
      id: true,
      rating: true,
      turnaroundTimeDays: true,
      responsivenessScore: true,
      guidanceScore: true,
      feedback: true,
      authorId: true,
      supervisorId: true,
    },
  });

  if (!recommendation || recommendation.supervisorId !== id) {
    notFound();
  }

  // Security Guard: Ensure the current user is the author
  if (recommendation.authorId !== user.id) {
    throw new Error("You are not authorized to edit this recommendation.");
  }

  return (
    <main className="max-w-3xl mx-auto py-10 px-4">
      <div className="mb-8">
        <Link
          href={`/supervisor/${id}/recommendation/${recommendationId}`}
          className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-blue-600 mb-6 transition-colors"
        >
          ← Cancel and Back to Recommendation
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Edit your Recommendation
        </h1>
        <p className="text-slate-500 mt-2">
          Update your mentorship feedback for this supervisor.
        </p>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 p-8 md:p-10">
        <RecommendationForm
          mode="edit"
          supervisorId={id}
          recommendationId={recommendation.id}
          initialValues={{
            rating: recommendation.rating.toString(),
            turnaroundTimeDays: recommendation.turnaroundTimeDays.toString(),
            responsivenessScore: recommendation.responsivenessScore.toString(),
            guidanceScore: recommendation.guidanceScore.toString(),
            feedback: recommendation.feedback,
          }}
        />
      </div>
    </main>
  );
}
