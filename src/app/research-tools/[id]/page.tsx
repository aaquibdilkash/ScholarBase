import { notFound } from "next/navigation";
import { CommentSection } from "@/components/interactions/CommentSection";
import { createClient } from "@/utils/supabase/server";
import { VoteButton } from "@/components/interactions/VoteButton";
import { getResearchToolById } from "../../actions/researchTools";
import { RichContent } from "@/components/content/RichContent";
import { deleteResearchTool } from "@/app/actions/researchTools";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import { ReportMenu } from "@/components/cards/ReportMenu";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const tool = await getResearchToolById(id).catch(() => null);
  if (!tool) return { title: "Research Tool" };
  return buildMetadata({
    title: tool.name,
    description: `${tool.name} helps researchers with ${tool.use}.`,
    path: `/research-tools/${tool.id}`,
    type: "article",
  });
}

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

  const userVote =
    (tool.votes?.find((v) => v.userId === user?.id)?.voteType as
      "UPVOTE" | "DOWNVOTE" | null) ?? null;

  // Define the delete action outside of the JSX
  async function handleDelete() {
    "use server";
    await deleteResearchTool(tool!.id);
    return { redirect: "/research-tools" };
  }

  return (
    <DetailPageCardShell
      isFrozen={tool.isFrozen ?? false}
      backHref="/research-tools"
      backLabel="Back to Research Tools"
      authorHref={`/scholars/${tool.author?.id}`}
      authorName={tool.author?.name || "Scholar"}
      authorHandle={tool.author?.handle || undefined}
      authorAvatarUrl={tool.author?.avatarUrl || undefined}
      authorId={tool.author?.id}
      isFollowing={!!tool.author?.followers?.length}
      currentUserId={user?.id}
      createdDate={tool.createdAt}
      editedDate={tool.updatedAt > tool.createdAt ? tool.updatedAt : undefined}
      managementControls={
        user?.id === tool.author?.id ? (
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
          module="RESEARCH_TOOL"
          initialTotalVotes={tool.totalVotes}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/research-tools/${tool.id}#comments`}
      footerCommentsCount={tool.totalComments}
      footerReportMenu={
        <ReportMenu
          entityId={tool.id}
          entityType="POST"
          module="RESEARCH_TOOL"
          ownerId={tool.author?.id ?? null}
          currentUserId={user?.id ?? null}
          isFrozen={tool.isFrozen}
          isDeleted={false}
          hasActiveAppeal={tool.hasActiveAppeal}
        />
      }
      discussion={
        <CommentSection
          locked={tool.isFrozen ?? false}
          comments={tool.comments}
          totalComments={tool.totalComments}
          targetId={tool.id}
          module="researchTool"
          currentUserId={user?.id || null}
          postAuthorId={tool.author?.id}
        />
      }
    >
      <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-950 mb-1.5 sm:mb-2">
        {tool.name}
      </h1>

      <p className="mb-4 text-sm sm:text-base text-slate-600 dark:text-slate-300">
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          Primary use:
        </span>{" "}
        {tool.use}
      </p>

      <RichContent content={tool.description} />

      <div className="flex gap-3 sm:gap-4 mt-2 sm:mt-2">
        {tool.website && (
          <a
            href={tool.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-lg bg-slate-950 py-2 sm:py-2.5 text-center text-xs sm:text-sm font-semibold text-white transition-colors duration-200 hover:bg-slate-800"
          >
            View Website
          </a>
        )}
      </div>
    </DetailPageCardShell>
  );
};

export default ResearchToolDetailPage;
