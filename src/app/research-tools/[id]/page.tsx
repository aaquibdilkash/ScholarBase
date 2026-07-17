import { notFound } from "next/navigation";
import { CommentSection } from "@/components/interactions/CommentSection";
import { createClient } from "@/utils/supabase/server";
import { LikeButton } from "@/components/interactions/LikeButton";
import Link from "next/link";
import Image from "next/image";
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
      footerLikeButton={
        <LikeButton
          targetId={tool.id}
          type="researchTool"
          initialLikes={tool._count.likes}
          initialIsLiked={!!tool.likes?.length}
        />
      }
      footerCommentsHref={`/research-tools/${tool.id}#comments`}
      footerCommentsCount={tool._count.comments}
      discussion={
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-slate-950 mb-6">Discussion</h2>
          <CommentSection
            comments={tool.comments}
            targetId={tool.id}
            type="researchTool"
            currentUserId={user?.id || null}
          />
        </div>
      }
    >
      <h1 className="text-2xl md:text-3xl font-bold text-slate-950 mb-2">
        {tool.name}
      </h1>

      <RichContent content={tool.description} />

      <div className="mt-3 flex items-center gap-4">
        {tool.website && (
          <a
            href={tool.website}
            target="_blank"
            rel="noopener noreferrer"
            className="sb-button-accent"
          >
            View Website
          </a>
        )}
      </div>
    </DetailPageCardShell>
  );
};

export default ResearchToolDetailPage;
