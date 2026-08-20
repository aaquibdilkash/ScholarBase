import { notFound } from "next/navigation";
import { CommentSection } from "@/components/interactions/CommentSection";
import { createClient } from "@/utils/supabase/server";
import { VoteButton } from "@/components/interactions/VoteButton";
import { deletePhdAdmission, getAdmission } from "@/app/actions/admissions";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { RichContent } from "@/components/content/RichContent";
import { Clock } from "lucide-react";

import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const admission = await getAdmission(id).catch(() => null);
  if (!admission) return { title: "PhD Admission" };
  return buildMetadata({
    title: `${admission.university} - ${admission.department} PhD Admission`,
    description: `Apply for PhD admission at ${admission.university} (${admission.department}). Deadline: ${new Date(admission.deadline).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.`,
    path: `/admissions/${admission.id}`,
    type: "article",
    publishedTime: admission.createdAt,
    section: "PhD Admissions",
  });
}

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

  const userVote =
    (admission.votes?.find((v) => v.userId === user?.id)?.voteType as
      | "UPVOTE"
      | "DOWNVOTE"
      | null) ?? null;

  async function handleDelete() {
    "use server";
        await deletePhdAdmission(admission!.id);
    return { redirect: "/admissions" };
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
      isFollowing={(admission.author as { followers?: { followerId: string }[] })?.followers?.length ? true : false}
      currentUserId={user?.id}
      createdDate={admission.createdAt}
      footerVoteButton={
        <VoteButton
          targetId={admission.id}
          module="PHD_ADMISSION"
          initialTotalVotes={admission.totalVotes}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/admissions/${admission.id}#comments`}
      footerCommentsCount={admission.totalComments}
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
          <CommentSection
            comments={admission.comments}
            targetId={admission.id}
            module="admission"
            currentUserId={user?.id || null}
            postAuthorId={admission.author.id}
          />
      }
    >
      <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-950 mb-1.5 sm:mb-2">
        {admission.university}
      </h1>
      <p className="text-sm sm:text-base font-medium text-blue-700 mb-3 sm:mb-4">
        {admission.department}
      </p>

      <div className="mb-3 sm:mb-4 flex items-center gap-2 text-xs sm:text-sm text-slate-600">
        <Clock className="h-5 w-5 shrink-0 text-slate-400" />
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
