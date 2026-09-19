import type { Metadata } from "next";
import { buildNoindexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoindexMetadata(
  "Edit Journal Review - ScholarBase",
);
import { notFound } from "next/navigation";
import prisma from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import JournalReviewForm from "@/components/journals/JournalReviewForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";

export default async function EditJournalReviewPage({
  params,
}: {
  params: Promise<{ id: string; reviewId: string }>;
}) {
  const { id, reviewId } = await params;
  const user = await requireCurrentUser(
    "You must be logged in to edit this review.",
  );

  const review = await prisma.journalReview.findUnique({
    where: { id: reviewId },
    select: {
      id: true,
      rating: true,
      outcome: true,
      feedback: true,
      turnaroundTimeDays: true,
      editorialQualityScore: true,
      peerReviewRigorScore: true,
      isAnonymous: true,
      authorId: true,
      journalId: true,
    },
  });

  if (!review || review.journalId !== id) notFound();

  // Security Guard: Ensure the current user is the author.
  if (review.authorId !== user.id) {
    throw new Error("You are not authorized to edit this review.");
  }

  return (
    <CreateOrEditPageShell
      title="Edit your Journal Review"
      description="Update your review for this journal."
      backHref={`/journals/${id}/review/${reviewId}`}
      backLabel="Cancel and Back to Review"
      maxWidth="sm"
    >
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 p-8 md:p-10 dark:bg-slate-900 dark:border-slate-800">
        <JournalReviewForm
          mode="edit"
          journalId={id}
          reviewId={review.id}
          initialValues={{
            rating: review.rating.toString(),
            outcome: review.outcome,
            feedback: review.feedback,
            turnaroundTimeDays: review.turnaroundTimeDays.toString(),
            editorialQualityScore: review.editorialQualityScore.toString(),
            peerReviewRigorScore: review.peerReviewRigorScore.toString(),
            isAnonymous: review.isAnonymous,
          }}
        />
      </div>
    </CreateOrEditPageShell>
  );
}
