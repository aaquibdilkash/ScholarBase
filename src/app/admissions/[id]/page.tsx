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
      authorHref={`/scholar/${admission.author.id}`}
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
      discussion={
        <div
          className="mt-8 sb-surface-strong p-8 md:p-12 rounded-xl"
          id="comments"
        >
          <h2 className="text-2xl font-bold text-slate-950 mb-6">Discussion</h2>
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
      <h1 className="text-2xl md:text-3xl font-bold text-slate-950 mb-2">
        {admission.university}
      </h1>
      <p className="text-md font-medium text-blue-700 mb-6">
        {admission.department}
      </p>
      <RichContent
        content={admission.description}
        className="text-slate-800 leading-relaxed mb-6"
      />

      <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-100/50 bg-red-50/50 p-3 text-sm font-semibold text-red-600">
        <svg
          className="w-5 h-5"
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
        {new Date(admission.deadline).toLocaleDateString("en-US", {
          dateStyle: "medium",
        })}
      </div>

      <div className="flex gap-4 mb-8">
        {admission.notificationLink && (
          <a
            href={admission.notificationLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-lg bg-slate-100 py-2.5 text-center text-sm font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-200"
          >
            View Circular
          </a>
        )}
        {admission.applyLink && (
          <a
            href={admission.applyLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-lg bg-slate-950 py-2.5 text-center text-sm font-semibold text-white transition-colors duration-200 hover:bg-slate-800"
          >
            Go to Portal
          </a>
        )}
      </div>
    </DetailPageCardShell>
  );
};

export default AdmissionDetailPage;
