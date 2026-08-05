import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth";
import RecommendationForm from "@/components/supervisor/RecommendationForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";

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
    <CreateOrEditPageShell
      title="Edit your Recommendation"
      description="Update your mentorship feedback for this supervisor."
      backHref={`/supervisor/${id}/recommendation/${recommendationId}`}
      backLabel="← Cancel and Back to Recommendation"
      maxWidth="sm"
    >
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 p-8 md:p-10 dark:bg-slate-900 dark:border-slate-800">
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
    </CreateOrEditPageShell>
  );
}
