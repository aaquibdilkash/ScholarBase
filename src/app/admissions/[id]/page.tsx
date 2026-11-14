import { notFound } from "next/navigation";
import { CommentSection } from "@/components/interactions/CommentSection";
import { createClient } from "@/utils/supabase/server";
import { VoteButton } from "@/components/interactions/VoteButton";
import { BookmarkButton } from "@/components/interactions/BookmarkButton";
import { deleteAdmission, getAdmission } from "@/app/actions/admissions";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  buildBreadcrumbList,
  buildContentJsonLd,
  CONTENT_SCHEMA,
} from "@/lib/schema";
import { ReportMenu } from "@/components/cards/ReportMenu";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { RichContent } from "@/components/content/RichContent";
import { FeedImage } from "@/components/feed/FeedImage";
import { isValidImageUrl } from "@/lib/image-constants";
import { Clock } from "lucide-react";
import { SmartExternalLink } from "@/components/ui/SmartExternalLink";

import { buildMetadata, buildNoindexMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import RelatedContent from "@/components/content/RelatedContent";
import { getRelatedContent } from "@/lib/semantic/related";
import { getModeratorDeletedContent } from "@/lib/deleted-content";
import { RemovedContentNotice } from "@/components/moderation/RemovedContentNotice";
import { getAdmissionLevelLabel } from "@/lib/admissions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const admission = await getAdmission(id).catch(() => null);
  if (!admission) {
    return buildNoindexMetadata("Removed content");
  }
  const levelLabel = getAdmissionLevelLabel(admission.level);
  return buildMetadata({
    title: `${admission.university} - ${admission.department} ${levelLabel} Admission`,
    description: `Apply for ${levelLabel} admission at ${admission.university} (${admission.department}). Deadline: ${new Date(admission.deadline).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.`,
    path: `/admissions/${admission.id}`,
    type: "article",
    publishedTime: admission.createdAt,
    section: "Admissions",
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
    const removed = await getModeratorDeletedContent("admission", { id });
    if (!removed) notFound();
    return (
      <RemovedContentNotice
        backHref="/admissions"
        backLabel="Back to Admissions"
        entityId={removed.id}
        module="ADMISSION"
        ownerId={removed.authorId}
        currentUserId={user?.id}
        hasActiveAppeal={removed.hasActiveAppeal}
        noun="admission"
      />
    );
  }

  const userVote =
    (admission.votes?.[0]?.voteType as "UPVOTE" | "DOWNVOTE" | null) ?? null;

  const related = await getRelatedContent("ADMISSION", admission.id);

  async function handleDelete() {
    "use server";
    const res = await deleteAdmission(admission!.id);
    if (res?.success === false) return res;
    return { redirect: "/admissions", invalidateQueries: [["admissions"]] };
  }

  return (
    <DetailPageCardShell
      structuredData={
        <JsonLd
          data={[
            buildContentJsonLd({
              type: CONTENT_SCHEMA.admission,
              path: `/admissions/${admission.id}`,
              name: `${admission.level} admission — ${admission.university}`,
              description: admission.description,
              author: {
                name: admission.author?.name,
                path: admission.author?.id
                  ? `/scholars/${admission.author.id}`
                  : null,
              },
              datePublished: admission.createdAt,
              extra: {
                // schema.org has no "admission notice" type, so the honest
                // generic keeps the page machine-readable without inventing one.
                genre: "Admission notice",
                ...(admission.university
                  ? {
                      about: {
                        "@type": "CollegeOrUniversity",
                        name: admission.university,
                      },
                    }
                  : {}),
                ...(admission.deadline
                  ? {
                      expires: new Date(admission.deadline).toISOString(),
                    }
                  : {}),
              },
            }),
            buildBreadcrumbList([
              { name: "Admissions", path: "/admissions" },
              {
                name: `${admission.level} admission — ${admission.university}`,
                path: `/admissions/${admission.id}`,
              },
            ]),
          ]}
        />
      }
      relatedContent={
        <RelatedContent title="Related admissions" items={related} />
      }
      isFrozen={admission.isFrozen ?? false}
      frozenEntityId={admission.id}
      frozenModule="ADMISSION"
      frozenEntityType="POST"
      frozenOwnerId={admission.author?.id ?? null}
      frozenHasActiveAppeal={admission.hasActiveAppeal ?? false}
      backHref="/admissions"
      backLabel="Back to Admissions"
      authorHref={`/scholars/${admission.author?.id}`}
      authorName={admission.author?.name || "Scholar"}
      authorHandle={admission.author?.handle || undefined}
      authorAvatarUrl={admission.author?.avatarUrl || undefined}
      authorVerified={!!admission.author?.institutionVerifiedAt}
      managementControls={
        user?.id === admission.author?.id ? (
          <OwnerActionsDropdown
            editHref={`/admissions/${admission.id}/edit`}
            onDelete={handleDelete}
            isOwner={true}
            editLabel="Edit Post"
            deleteLabel="Delete"
          />
        ) : null
      }
      authorId={admission.author?.id}
      isFollowing={
        (admission.author as { followers?: { followerId: string }[] })
          ?.followers?.length
          ? true
          : false
      }
      currentUserId={user?.id}
      createdDate={admission.createdAt}
      footerVoteButton={
        <VoteButton
          targetId={admission.id}
          module="ADMISSION"
          initialTotalVotes={admission.totalVotes}
          initialUserVote={userVote}
          isOwnContent={user?.id === admission.author?.id}
        />
      }
      footerBookmarkButton={
        <BookmarkButton
          frozen={admission.isFrozen === true}
          targetId={admission.id}
          module="ADMISSION"
          initialTotalBookmarks={admission.totalBookmarks ?? 0}
          initialIsBookmarked={
            Array.isArray(admission.bookmarks) && admission.bookmarks.length > 0
          }
        />
      }
      footerCommentsHref={`/admissions/${admission.id}#comments`}
      footerCommentsCount={admission.totalComments}
      footerReportMenu={
        <ReportMenu
          entityId={admission.id}
          entityType="POST"
          module="ADMISSION"
          ownerId={admission.author?.id ?? null}
          currentUserId={user?.id ?? null}
          isFrozen={admission.isFrozen}
          hasActiveAppeal={admission.hasActiveAppeal}
        />
      }
      bodyBottomContent={
        <div className="flex gap-3 sm:gap-4 mt-3 sm:mt-4">
          <SmartExternalLink
            url={admission.notificationLink}
            className="flex-1 sb-button-soft"
            urlLabel="View Circular"
          />
          <SmartExternalLink
            url={admission.applyLink}
            className="flex-1 sb-button-primary"
            urlLabel="Go to Portal"
            emailLabel="Email to Apply"
          />
        </div>
      }
      discussion={
        <CommentSection
          locked={admission.isFrozen ?? false}
          comments={admission.comments}
          totalComments={admission.totalComments}
          targetId={admission.id}
          module="admission"
          currentUserId={user?.id || null}
          postAuthorId={admission.author?.id}
        />
      }
    >
      <h1 className="mb-1.5 sm:mb-2 min-w-0 max-w-full break-words text-lg sm:text-xl md:text-2xl font-bold text-slate-950 [overflow-wrap:anywhere]">
        {admission.university}
      </h1>
      <p className="mb-2 min-w-0 max-w-full break-words text-sm sm:text-base font-medium text-slate-950 [overflow-wrap:anywhere]">
        {admission.department}
      </p>
      <div className="mb-3 sm:mb-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
          {getAdmissionLevelLabel(admission.level)}
        </span>
      </div>

      <div className="mb-3 sm:mb-4 flex min-w-0 items-center gap-2 text-xs sm:text-sm text-slate-600">
        <Clock className="h-5 w-5 shrink-0 text-slate-400" />
        Closing Date:{" "}
        <span className="min-w-0 flex-1 break-words font-medium [overflow-wrap:anywhere]">
          {new Date(admission.deadline).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>
      {isValidImageUrl(admission.imageUrl) && (
        <div className="mb-6">
          <FeedImage
            src={admission.imageUrl}
            alt={`${admission.university} — ${admission.department}`}
          />
        </div>
      )}

      <RichContent
        content={admission.description}
        className="text-slate-800 leading-relaxed"
      />
    </DetailPageCardShell>
  );
};

export default AdmissionDetailPage;
