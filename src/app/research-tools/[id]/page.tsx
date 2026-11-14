import { notFound } from "next/navigation";
import { CommentSection } from "@/components/interactions/CommentSection";
import { createClient } from "@/utils/supabase/server";
import { VoteButton } from "@/components/interactions/VoteButton";
import { BookmarkButton } from "@/components/interactions/BookmarkButton";
import { getResearchToolById } from "../../actions/researchTools";
import { RichContent } from "@/components/content/RichContent";
import { deleteResearchTool } from "@/app/actions/researchTools";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  buildBreadcrumbList,
  buildContentJsonLd,
  CONTENT_SCHEMA,
} from "@/lib/schema";
import { ReportMenu } from "@/components/cards/ReportMenu";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { SafeExternalLink } from "@/components/ui/SafeExternalLink";
import type { Metadata } from "next";
import { buildMetadata, buildNoindexMetadata } from "@/lib/seo";
import RelatedContent from "@/components/content/RelatedContent";
import { getRelatedContent } from "@/lib/semantic/related";
import { getModeratorDeletedContent } from "@/lib/deleted-content";
import { RemovedContentNotice } from "@/components/moderation/RemovedContentNotice";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const tool = await getResearchToolById(id).catch(() => null);
  if (!tool) {
    return buildNoindexMetadata("Removed content");
  }
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
    const removed = await getModeratorDeletedContent("researchTool", { id });
    if (!removed) notFound();
    return (
      <RemovedContentNotice
        backHref="/research-tools"
        backLabel="Back to Research Tools"
        entityId={removed.id}
        module="RESEARCH_TOOL"
        ownerId={removed.authorId}
        currentUserId={user?.id}
        hasActiveAppeal={removed.hasActiveAppeal}
        noun="research tool"
      />
    );
  }

  const userVote =
    (tool.votes?.[0]?.voteType as "UPVOTE" | "DOWNVOTE" | null) ?? null;

  const related = await getRelatedContent("RESEARCH_TOOL", tool.id);

  // Define the delete action outside of the JSX
  async function handleDelete() {
    "use server";
    const res = await deleteResearchTool(tool!.id);
    if (res?.success === false) return res;
    return { redirect: "/research-tools", invalidateQueries: [["researchTools"]] };
  }

  return (
    <DetailPageCardShell
      structuredData={
        <JsonLd
          data={[
            buildContentJsonLd({
              type: CONTENT_SCHEMA.researchTool,
              path: `/research-tools/${tool.id}`,
              name: tool.name,
              description: tool.description || tool.use,
              author: {
                name: tool.author?.name,
                path: tool.author?.id ? `/scholars/${tool.author.id}` : null,
              },
              datePublished: tool.createdAt,
              dateModified: tool.editedAt,
              extra: {
                applicationCategory: "ResearchApplication",
                ...(tool.website ? { sameAs: [tool.website] } : {}),
              },
            }),
            buildBreadcrumbList([
              { name: "Research Tools", path: "/research-tools" },
              { name: tool.name, path: `/research-tools/${tool.id}` },
            ]),
          ]}
        />
      }
      relatedContent={
        <RelatedContent title="Related research tools" items={related} />
      }
      isFrozen={tool.isFrozen ?? false}
      frozenEntityId={tool.id}
      frozenModule="RESEARCH_TOOL"
      frozenEntityType="POST"
      frozenOwnerId={tool.author?.id ?? null}
      frozenHasActiveAppeal={tool.hasActiveAppeal ?? false}
      backHref="/research-tools"
      backLabel="Back to Research Tools"
      authorHref={`/scholars/${tool.author?.id}`}
      authorName={tool.author?.name || "Scholar"}
      authorHandle={tool.author?.handle || undefined}
      authorAvatarUrl={tool.author?.avatarUrl || undefined}
      authorVerified={!!tool.author?.institutionVerifiedAt}
      authorId={tool.author?.id}
      isFollowing={!!tool.author?.followers?.length}
      currentUserId={user?.id}
      createdDate={tool.createdAt}
      editedDate={
        tool.editedAt && tool.editedAt > tool.createdAt
          ? tool.editedAt
          : undefined
      }
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
          isOwnContent={user?.id === tool.author?.id}
        />
      }
      footerBookmarkButton={
        <BookmarkButton
          frozen={tool.isFrozen === true}
          targetId={tool.id}
          module="RESEARCH_TOOL"
          initialTotalBookmarks={tool.totalBookmarks ?? 0}
          initialIsBookmarked={
            Array.isArray(tool.bookmarks) && tool.bookmarks.length > 0
          }
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
      <h1 className="min-w-0 max-w-full break-words pe-1 text-lg font-bold text-slate-950 mb-1.5 sm:mb-2 sm:text-xl md:text-2xl">
        {tool.name}
      </h1>

      <p className="mb-4 min-w-0 max-w-full break-words text-sm sm:text-base text-slate-600 dark:text-slate-300 [overflow-wrap:anywhere]">
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          Primary use:
        </span>{" "}
        {tool.use}
      </p>

      <RichContent content={tool.description} />

      <div className="flex gap-3 sm:gap-4 mt-2 sm:mt-2">
        <SafeExternalLink
          url={tool.website}
          className="flex-1 rounded-lg bg-slate-950 py-2 sm:py-2.5 text-center text-xs sm:text-sm font-semibold text-white transition-colors duration-200 hover:bg-slate-800"
        >
          View Website
        </SafeExternalLink>
      </div>
    </DetailPageCardShell>
  );
};

export default ResearchToolDetailPage;
