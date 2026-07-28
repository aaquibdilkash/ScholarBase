import { notFound } from "next/navigation";
import { CommentSection } from "@/components/interactions/CommentSection";
import { createClient } from "@/utils/supabase/server";
import { VoteButton } from "@/components/interactions/VoteButton";
import { getResearchToolById } from "../../actions/researchTools";
import { RichContent } from "@/components/content/RichContent";
import { deleteResearchTool } from "@/app/actions/researchTools";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";

const ResearchToolDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const tool = await getResearchToolById(id, user?.id);

  if (!tool) {
    notFound();
  }

  const upvotes =
    tool.votes?.filter((v: any) => v.voteType === "UPVOTE").length ?? 0;
  const downvotes =
    tool.votes?.filter((v: any) => v.voteType === "DOWNVOTE").length ?? 0;
  const userVote =
    (tool.votes?.find((v: any) => v.userId === user?.id)?.voteType as
      | "UPVOTE"
      | "DOWNVOTE"
      | null) ?? null;

  // Define the delete action outside of the JSX
  async function handleDelete() {
    "use server";
    await deleteResearchTool(tool!.id);
  }

  return (
    <DetailPageCardShell
      backHref="/research-tools"
      backLabel="Back to Research Tools"
      authorHref={`/scholar/${tool.author.id}`}
      authorName={tool.author.name || "Scholar"}
      authorHandle={tool.author.handle || undefined}
      authorAvatarUrl={tool.author.avatarUrl || undefined}
      authorId={tool.author.id}
      isFollowing={!!tool.author.followers?.length}
      createdDate={tool.createdAt}
      editedDate={tool.updatedAt > tool.createdAt ? tool.updatedAt : undefined}
      managementControls={
        user?.id === tool.author.id ? (
          <OwnerActionsDropdown
            editHref={`/research-tools/${tool.id}/edit`}
            onDelete={handleDelete}
            isOwner={true}
            editLabel="Edit Tool"
            deleteLabel="Delete"
          />
        ) : null
      }
      footerVoteButton={
        <VoteButton
          targetId={tool.id}
          type="researchTool"
          initialUpvotes={upvotes}
          initialDownvotes={downvotes}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/research-tools/${tool.id}#comments`}
      footerCommentsCount={tool._count.comments}
      discussion={
        <div
          className="mt-8 sb-surface-strong p-8 md:p-12 rounded-xl"
          id="comments"
        >
          <h2 className="text-2xl font-bold text-slate-950 mb-6">Discussion</h2>
          <CommentSection
            comments={tool.comments}
            targetId={tool.id}
            type="researchTool"
            currentUserId={user?.id || null}
            postAuthorId={tool.author.id}
          />
        </div>
      }
    >
      <h1 className="text-2xl md:text-3xl font-bold text-slate-950 mb-2">
        {tool.name}
      </h1>

      <RichContent content={tool.description} />

      <div className="flex gap-4 mb-8">
        {tool.website && (
          <a
            href={tool.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-lg bg-slate-950 py-2.5 text-center text-sm font-semibold text-white transition-colors duration-200 hover:bg-slate-800"
          >
            View Website
          </a>
        )}
      </div>
    </DetailPageCardShell>
  );
};

export default ResearchToolDetailPage;
