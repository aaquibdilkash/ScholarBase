import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import {
  getResearchGrantById,
  deleteResearchGrant,
} from "@/app/actions/grants";
import { buildMetadata, buildNoindexMetadata } from "@/lib/seo";
import { SEO_PAGES } from "@/constants/seo";
import { CommentSection } from "@/components/interactions/CommentSection";
import { VoteButton } from "@/components/interactions/VoteButton";
import { BookmarkButton } from "@/components/interactions/BookmarkButton";
import { RichContent } from "@/components/content/RichContent";
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
import { SmartExternalLink } from "@/components/ui/SmartExternalLink";
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
  try {
    const grant = await getResearchGrantById(id);
    if (!grant) throw new Error("not found");
    const description = grant.amount
      ? `${grant.title} funding opportunity: ${grant.amount}.`
      : `Research grant opportunity: ${grant.title}.`;

    return buildMetadata({
      title: grant.title || SEO_PAGES.grants.title,
      description,
      path: `/grants/${grant.id}`,
      type: "article",
      section: SEO_PAGES.grants.section,
    });
  } catch {
    return buildNoindexMetadata("Removed content");
  }
}

export default async function ResearchGrantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const grant = await getResearchGrantById(id, user?.id).catch(() => null);

  if (!grant) {
    const removed = await getModeratorDeletedContent("researchGrant", { id });
    if (!removed) notFound();
    return (
      <RemovedContentNotice
        backHref="/grants"
        backLabel="Back to Research Grants"
        entityId={removed.id}
        module="RESEARCH_GRANT"
        ownerId={removed.authorId}
        currentUserId={user?.id}
        hasActiveAppeal={removed.hasActiveAppeal}
        noun="grant"
      />
    );
  }

  const userVote = grant.votes?.[0]?.voteType ?? null;

  const related = await getRelatedContent("RESEARCH_GRANT", grant.id);

  async function handleDelete() {
    "use server";
    const res = await deleteResearchGrant(grant!.id);
    if (res?.success === false) return res;
    return { redirect: "/grants", invalidateQueries: [["grants"]] };
  }

  return (
    <DetailPageCardShell
      structuredData={
        <JsonLd
          data={[
            buildContentJsonLd({
              type: CONTENT_SCHEMA.researchGrant,
              path: `/grants/${grant.id}`,
              name: grant.title,
              description: grant.description,
              author: {
                name: grant.author?.name,
                path: grant.author?.id ? `/scholars/${grant.author.id}` : null,
              },
              datePublished: grant.createdAt,
              dateModified: grant.editedAt,
            }),
            buildBreadcrumbList([
              { name: "Grants", path: "/grants" },
              { name: grant.title, path: `/grants/${grant.id}` },
            ]),
          ]}
        />
      }
      relatedContent={<RelatedContent title="Related grants" items={related} />}
      isFrozen={grant.isFrozen ?? false}
      frozenEntityId={grant.id}
      frozenModule="RESEARCH_GRANT"
      frozenEntityType="POST"
      frozenOwnerId={grant.author?.id ?? null}
      frozenHasActiveAppeal={grant.hasActiveAppeal ?? false}
      backHref="/grants"
      backLabel="Back to Research Grants"
      authorHref={`/scholars/${grant.author?.id}`}
      authorName={grant.author?.name || "Scholar"}
      authorHandle={grant.author?.handle || undefined}
      authorAvatarUrl={grant.author?.avatarUrl || undefined}
      authorVerified={!!grant.author?.institutionVerifiedAt}
      authorId={grant.author?.id}
      isFollowing={!!grant.author?.followers?.length}
      currentUserId={user?.id}
      createdDate={grant.createdAt}
      editedDate={
        grant.editedAt && grant.editedAt > grant.createdAt
          ? grant.editedAt
          : undefined
      }
      managementControls={
        user?.id === grant.author?.id ? (
          <OwnerActionsDropdown
            editHref={`/grants/${grant.id}/edit`}
            onDelete={handleDelete}
            isOwner={true}
            editLabel="Edit Grant"
            deleteLabel="Delete"
          />
        ) : null
      }
      footerVoteButton={
        <VoteButton
          targetId={grant.id}
          module="RESEARCH_GRANT"
          initialTotalVotes={grant.totalVotes}
          initialUserVote={userVote}
          isOwnContent={user?.id === grant.author?.id}
        />
      }
      footerBookmarkButton={
        <BookmarkButton
          frozen={grant.isFrozen === true}
          targetId={grant.id}
          module="RESEARCH_GRANT"
          initialTotalBookmarks={grant.totalBookmarks ?? 0}
          initialIsBookmarked={
            Array.isArray(grant.bookmarks) && grant.bookmarks.length > 0
          }
        />
      }
      footerCommentsHref={`/grants/${grant.id}#comments`}
      footerCommentsCount={grant.totalComments}
      footerReportMenu={
        <ReportMenu
          entityId={grant.id}
          entityType="POST"
          module="RESEARCH_GRANT"
          ownerId={grant.author?.id ?? null}
          currentUserId={user?.id ?? null}
          isFrozen={grant.isFrozen}
          hasActiveAppeal={grant.hasActiveAppeal}
        />
      }
      discussion={
        <CommentSection
          locked={grant.isFrozen ?? false}
          comments={grant.comments}
          totalComments={grant.totalComments}
          targetId={grant.id}
          module="researchGrant"
          currentUserId={user?.id || null}
          postAuthorId={grant.author?.id}
        />
      }
    >
      <h1 className="mb-2 min-w-0 max-w-full break-words text-lg font-bold text-slate-950 dark:text-slate-50 sm:text-xl md:text-2xl [overflow-wrap:anywhere]">
        {grant.title}
      </h1>
      {grant.amount && (
        <p className="mb-4 min-w-0 max-w-full break-words text-sm text-slate-600 dark:text-slate-300 sm:text-base [overflow-wrap:anywhere]">
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            Amount:
          </span>{" "}
          {grant.amount}
        </p>
      )}
      <RichContent content={grant.description} />
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <SmartExternalLink
          url={grant.applyLink}
          className="flex-1 rounded-lg bg-slate-950 py-2 text-center text-xs font-semibold text-white transition-colors hover:bg-slate-800 sm:text-sm"
          urlLabel="Apply"
          emailLabel="Email to Apply"
        />
        <SafeExternalLink
          url={grant.infoLink}
          className="flex-1 rounded-lg border border-slate-200 py-2 text-center text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900 sm:text-sm"
        >
          More Info
        </SafeExternalLink>
      </div>
    </DetailPageCardShell>
  );
}
