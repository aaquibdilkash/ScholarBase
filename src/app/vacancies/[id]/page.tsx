import { notFound } from "next/navigation";
import { CommentSection } from "@/components/interactions/CommentSection";
import { createClient } from "@/utils/supabase/server";
import { VoteButton } from "@/components/interactions/VoteButton";
import { deleteJobVacancy, getVacancyById } from "@/app/actions/vacancies";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { RichContent } from "@/components/content/RichContent";

const VacancyDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const vacancy = await getVacancyById(id);

  if (!vacancy) {
    notFound();
  }

  const upvotes =
    vacancy.votes?.filter((v: any) => v.voteType === "UPVOTE").length ?? 0;
  const downvotes =
    vacancy.votes?.filter((v: any) => v.voteType === "DOWNVOTE").length ?? 0;
  const userVote =
    (vacancy.votes?.find((v: any) => v.userId === user?.id)?.voteType as
      | "UPVOTE"
      | "DOWNVOTE"
      | null) ?? null;

  async function handleDelete() {
    "use server";
    await deleteJobVacancy(vacancy!.id);
  }

  return (
    <DetailPageCardShell
      backHref="/vacancies"
      backLabel="Back to Academic Vacancies"
      authorHref={`/scholars/${vacancy.author.id}`}
      authorName={vacancy.author.name || "Scholar"}
      authorHandle={vacancy.author.handle || undefined}
      authorAvatarUrl={vacancy.author.avatarUrl || undefined}
      authorId={vacancy.author.id}
      isFollowing={(vacancy.author as any)?.followers?.length ? true : false}
      currentUserId={user?.id}
      createdDate={vacancy.createdAt}
      managementControls={
        user?.id === vacancy.author.id ? (
          <OwnerActionsDropdown
            editHref={`/vacancies/${vacancy.id}/edit`}
            onDelete={handleDelete}
            isOwner={true}
            editLabel="Edit Vacancy"
            deleteLabel="Delete"
          />
        ) : null
      }
      footerVoteButton={
        <VoteButton
          targetId={vacancy.id}
          type="vacancy"
          initialUpvotes={upvotes}
          initialDownvotes={downvotes}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/vacancies/${vacancy.id}#comments`}
      footerCommentsCount={vacancy._count.comments}
      bodyBottomContent={
        <div className="flex gap-3 sm:gap-4 mt-3 sm:mt-4">
          {vacancy.notificationLink && (
            <a
              href={vacancy.notificationLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sb-button-soft"
            >
              View Details
            </a>
          )}
          {vacancy.applyLink && (
            <a
              href={vacancy.applyLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sb-button-primary"
            >
              Apply Now
            </a>
          )}
        </div>
      }
      discussion={
        <div
          className="mt-4 sm:mt-6 p-4 sm:p-6 md:p-8 md:mt-8 sb-surface-strong rounded-xl"
          id="comments"
        >
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-950 mb-3 sm:mb-4 md:mb-6">
            Discussion
          </h2>
          <CommentSection
            comments={vacancy.comments}
            targetId={vacancy.id}
            type="vacancy"
            currentUserId={user?.id || null}
            postAuthorId={vacancy.author.id}
          />
        </div>
      }
    >
      <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-950 mb-1.5 sm:mb-2">
        {vacancy.title}
      </h1>
      <p className="text-sm sm:text-base font-medium text-slate-600 mb-3 sm:mb-4">
        {vacancy.institution}
      </p>

      <div className="mb-3 sm:mb-4 flex items-center gap-2 text-xs sm:text-sm text-slate-600">
        <svg
          className="h-5 w-5 shrink-0 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>Last Date to Apply:</span>
        <span className="font-medium">
          {new Date(vacancy.deadline).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>
      <RichContent
        content={vacancy.description}
        className="text-slate-800 leading-relaxed"
      />
    </DetailPageCardShell>
  );
};

export default VacancyDetailPage;
