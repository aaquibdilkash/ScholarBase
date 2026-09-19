import { notFound } from "next/navigation";
import { getJournalReview } from "@/app/actions/journalReviews";
import { JournalReviewCard } from "@/components/journals/JournalReviewCard";

// The slug is dynamic: /journals/[id]/review/[reviewId]
// `reviewId` comes from the URL; we render the single review by fetching
// only that row (cursor-based lookup keeps it cheap).
export default async function JournalReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string; reviewId: string }>;
}) {
  const { reviewId } = await params;

  const review = await getJournalReview(reviewId, undefined);

  if (!review) {
    return notFound();
  }

  return (
    <main className="max-w-2xl mx-auto py-10 px-4">
      <JournalReviewCard review={review} />
    </main>
  );
}

