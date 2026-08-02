import { notFound } from "next/navigation";
import { CommentSection } from "@/components/interactions/CommentSection";
import { createClient } from "@/utils/supabase/server";
import { VoteButton } from "@/components/interactions/VoteButton";
import { deletePhdAdmission, getAdmission } from "@/app/actions/admissions";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { RichContent } from "@/components/content/RichContent";

const AdmissionDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admission = await getAdmission(id, user?.id);

  if (!admission) {
    notFound();
  }

  const upvotes =
    admission.votes?.filter((v: any) => v.voteType === "UPVOTE").length ?? 0;
  const downvotes =
    admission.votes?.filter((v: any) => v.voteType === "DOWNVOTE").length ?? 0;
  const userVote =
    (admission.votes?.find((v: any) => v.userId === user?.id)?.voteType as
      | "UPVOTE"
      | "DOWNVOTE"
      | null) ?? null;

  async function handleDelete() {
    "use server";
    await deletePhdAdmission(admission!.id);
  }

  return (
    <DetailPageCardShell
      backHref="/admissions"
      backLabel="Back to PhD Admissions"
      authorHref={`/scholars/${admission.author.id}`}
      authorName={admission.author.name || "Scholar"}
      authorHandle={admission.author.handle || undefined}
      authorAvatarUrl={admission.author.avatarUrl || undefined}
      managementControls={
        user?.id === admission.author.id ? (
          <OwnerActionsDropdown
            editHref={`/admissions/${admission.id}/edit`}
            onDelete={handleDelete}
            isOwner={true}
            editLabel="Edit Post"
            deleteLabel="Delete"
          />
        ) : null
      }
      authorId={admission.author.id}
      isFollowing={(admission.author as any)?.followers?.length ? true : false}
      currentUserId={user?.id}
      createdDate={admission.createdAt}
      footerVoteButton={
        <VoteButton
          targetId={admission.id}
          type="admission"
          initialUpvotes={upvotes}
          initialDownvotes={downvotes}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/admissions/${admission.id}#comments`}
      footerCommentsCount={admission._count.comments}
      bodyBottomContent={
        <div className="flex gap-3 sm:gap-4 mt-3 sm:mt-4">
          {admission.notificationLink && (
            <a
              href={admission.notificationLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sb-button-soft"
            >
              View Circular
            </a>
          )}
          {admission.applyLink && (
            <a
              href={admission.applyLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sb-button-primary"
            >
              Go to Portal
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
            comments={admission.comments}
            targetId={admission.id}
            type="admission"
            currentUserId={user?.id || null}
            postAuthorId={admission.author.id}
          />
        </div>
      }
    >
      <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-950 mb-1.5 sm:mb-2">
        {admission.university}
      </h1>
      <p className="text-sm sm:text-base font-medium text-blue-700 mb-3 sm:mb-4">
        {admission.department}
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
        Closing Date:{" "}
        <span className="font-medium">
          {new Date(admission.deadline).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>
      <RichContent
        content={admission.description}
        className="text-slate-800 leading-relaxed"
      />
    </DetailPageCardShell>
  );
};

export default AdmissionDetailPage;
