import { notFound } from "next/navigation";
import { CommentSection } from "@/components/interactions/CommentSection";
import { createClient } from "@/utils/supabase/server";
import { VoteButton } from "@/components/interactions/VoteButton";
import { BookmarkButton } from "@/components/interactions/BookmarkButton";

import { deleteResult, getResult } from "@/app/actions/results";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  buildBreadcrumbList,
  buildContentJsonLd,
  CONTENT_SCHEMA,
} from "@/lib/schema";
import { ReportMenu } from "@/components/cards/ReportMenu";
import { Building2, Calendar } from "lucide-react";
import { RichContent } from "@/components/content/RichContent";
import { SafeExternalLink } from "@/components/ui/SafeExternalLink";
import type { Metadata } from "next";
import { buildMetadata, buildNoindexMetadata } from "@/lib/seo";
import RelatedContent from "@/components/content/RelatedContent";
import { getRelatedContent } from "@/lib/semantic/related";
import { getModeratorDeletedContent } from "@/lib/deleted-content";
import { RemovedContentNotice } from "@/components/moderation/RemovedContentNotice";
import {
  resultBadgeLabel,
  resultLinkActions,
} from "@/lib/results/entry-types";
import {
  RESULTS_BASE_PATH,
  resultHref,
  resultEditHref,
} from "@/lib/results/routes";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = await getResult(id).catch(() => null);
  if (!result) {
    return buildNoindexMetadata("Removed content");
  }
  return buildMetadata({
    title: result.title,
    description: result.description.slice(0, 160),
    path: resultHref(result.id),
    type: "article",
  });
}

const ExamOrResultDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const result = await getResult(id, user?.id);

  if (!result) {
    const removed = await getModeratorDeletedContent("result", { id });
    if (!removed) notFound();
    return (
      <RemovedContentNotice
        backHref={RESULTS_BASE_PATH}
        backLabel="Back to Exams & Results"
        entityId={removed.id}
        module="RESULT"
        ownerId={removed.authorId}
        currentUserId={user?.id}
        hasActiveAppeal={removed.hasActiveAppeal}
        noun="exam or result"
      />
    );
  }

  const userVote =
    (result.votes?.[0]?.voteType as "UPVOTE" | "DOWNVOTE" | null) ?? null;
  const links = resultLinkActions(result.kind, {
    notificationLink: result.notificationLink,
    checkOrApplyLink: result.checkOrApplyLink,
  });

  const related = await getRelatedContent("RESULT", result.id);

  return (
    <DetailPageCardShell
      structuredData={
        <JsonLd
          data={[
            buildContentJsonLd({
              type: CONTENT_SCHEMA.result,
              path: resultHref(result.id),
              name: result.title,
              description: result.description,
              author: {
                name: result.author?.name,
                path: result.author?.id ? `/scholars/${result.author.id}` : null,
              },
              datePublished: result.createdAt,
              dateModified: result.editedAt,
              extra: { genre: "Exam notification or academic result" },
            }),
            buildBreadcrumbList([
              { name: "Exams & Results", path: RESULTS_BASE_PATH },
              { name: result.title, path: resultHref(result.id) },
            ]),
          ]}
        />
      }
      relatedContent={
        <RelatedContent title="Related exams and results" items={related} />
      }
      isFrozen={result.isFrozen ?? false}
      frozenEntityId={result.id}
      frozenModule="RESULT"
      frozenEntityType="POST"
      frozenOwnerId={result.author?.id ?? null}
      frozenHasActiveAppeal={result.hasActiveAppeal ?? false}
      backHref={RESULTS_BASE_PATH}
      backLabel="Back to Exams & Results"
      authorHref={`/scholars/${result.author?.id}`}
      authorName={result.author?.name || "Scholar"}
      authorHandle={result.author?.handle || undefined}
      authorAvatarUrl={result.author?.avatarUrl || undefined}
      authorVerified={!!result.author?.institutionVerifiedAt}
      managementControls={
        user?.id === result.author?.id ? (
          <OwnerActionsDropdown
            editHref={resultEditHref(result.id)}
            onDelete={async () => {
              "use server";
              const res = await deleteResult(result.id);
              if (res?.success === false) return res;
              return {
                redirect: RESULTS_BASE_PATH,
                invalidateQueries: [["results"]],
              };
            }}
            isOwner={true}
            editLabel="Edit Exam or Result"
            deleteLabel="Delete"
          />
        ) : null
      }
      authorId={result.author?.id}
      isFollowing={
        (result.author as { followers?: { followerId: string }[] })?.followers
          ?.length
          ? true
          : false
      }
      currentUserId={user?.id}
      createdDate={result.createdAt}
      editedDate={
        result.editedAt && result.editedAt > result.createdAt
          ? result.editedAt
          : undefined
      }
      footerVoteButton={
        <VoteButton
          targetId={result.id}
          module="RESULT"
          initialTotalVotes={result.totalVotes}
          initialUserVote={userVote}
          isOwnContent={user?.id === result.author?.id}
        />
      }
      footerBookmarkButton={
        <BookmarkButton
          frozen={result.isFrozen === true}
          targetId={result.id}
          module="RESULT"
          initialTotalBookmarks={result.totalBookmarks ?? 0}
          initialIsBookmarked={
            Array.isArray(result.bookmarks) && result.bookmarks.length > 0
          }
        />
      }
      footerCommentsHref={`${resultHref(result.id)}#comments`}
      footerCommentsCount={result.totalComments}
      footerReportMenu={
        <ReportMenu
          entityId={result.id}
          entityType="POST"
          module="RESULT"
          ownerId={result.author?.id ?? null}
          currentUserId={user?.id ?? null}
          isFrozen={result.isFrozen}
          hasActiveAppeal={result.hasActiveAppeal}
        />
      }
      discussion={
        <CommentSection
          locked={result.isFrozen ?? false}
          comments={result.comments}
          totalComments={result.totalComments}
          targetId={result.id}
          module="result"
          currentUserId={user?.id || null}
          postAuthorId={result.author?.id}
        />
      }
    >
      <div className="mb-4 flex items-center gap-2">
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
          {resultBadgeLabel(result.kind, result.type)}
        </span>
        {result.category && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {result.category}
          </span>
        )}
      </div>

      <h1 className="mb-1.5 sm:mb-2 min-w-0 max-w-full break-words text-lg sm:text-xl md:text-2xl font-bold text-slate-950 [overflow-wrap:anywhere]">
        {result.title}
      </h1>

      <RichContent
        content={result.description}
        className="text-slate-800 leading-relaxed mb-4 sm:mb-6"
      />

      {(result.conductingBody || result.session) && (
        <div className="mb-4 sm:mb-6 flex flex-col gap-2 rounded-xl border border-slate-100/50 bg-slate-50/50 p-3 sm:p-4 text-xs sm:text-sm font-semibold text-slate-600 dark:bg-[#020617] dark:border-slate-700 dark:text-slate-300">
          {result.conductingBody && (
            <div className="flex min-w-0 items-center gap-2 break-words [overflow-wrap:anywhere]">
              <Building2 className="h-5 w-5 shrink-0" />
              <span className="min-w-0 flex-1">
                Conducting Body: {result.conductingBody}
              </span>
            </div>
          )}
          {result.session && (
            <div className="flex min-w-0 items-center gap-2 break-words [overflow-wrap:anywhere]">
              <Calendar className="h-5 w-5 shrink-0" />
              <span className="min-w-0 flex-1">Session: {result.session}</span>
            </div>
          )}
        </div>
      )}

      {(links.primary || links.secondary) && (
        <div className="flex gap-3 sm:gap-4 mb-6 sm:mb-8">
          {links.primary && (
            <SafeExternalLink
              url={links.primary.href}
              className="flex-1 sb-button-primary"
            >
              {links.primary.label}
            </SafeExternalLink>
          )}
          {links.secondary && (
            <SafeExternalLink
              url={links.secondary.href}
              className="flex-1 sb-button-soft"
            >
              {links.secondary.label}
            </SafeExternalLink>
          )}
        </div>
      )}
    </DetailPageCardShell>
  );
};

export default ExamOrResultDetailPage;
