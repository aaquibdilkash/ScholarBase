import { notFound } from "next/navigation";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import { ReportMenu } from "@/components/cards/ReportMenu";
import { CommentSection } from "@/components/interactions/CommentSection";
import { VoteButton } from "@/components/interactions/VoteButton";
import { BookmarkButton } from "@/components/interactions/BookmarkButton";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { createClient } from "@/utils/supabase/server";
import { getPublicationById } from "../../actions/publications";
import { deletePublication } from "@/app/actions/publications";
import { RichContent } from "@/components/content/RichContent";
import { SafeExternalLink } from "@/components/ui/SafeExternalLink";
import Link from "next/link";

const PUBLICATION_TYPE_LABELS: Record<string, string> = {
  RESEARCH_PAPER: "Research Paper",
  CONFERENCE_PROCEEDING: "Conference Proceeding",
  PREPRINT: "Preprint",
  BOOK: "Book",
  BOOK_CHAPTER: "Book Chapter",
  THESIS: "Thesis",
  TECHNICAL_REPORT: "Technical Report",
  OTHER: "Other",
};

import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { SEO_PAGES } from "@/constants/seo";
import { deletedDetailNavigation } from "@/lib/content-tombstone";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const p = await getPublicationById(id).catch(() => null);
  if (!p) {
    return buildMetadata({
      title: SEO_PAGES.publications.title,
      description: SEO_PAGES.publications.description,
      path: SEO_PAGES.publications.path,
      type: "website",
      section: SEO_PAGES.publications.section,
    });
  }
  return buildMetadata({
    title: p.title,
    description: (p.abstract || p.title).replace(/<[^>]*>/g, " "),
    path: `/publications/${p.id}`,
    type: "article",
    author: p.author?.name || undefined,
    keywords: p.keywords
      ? p.keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean)
      : undefined,
    publishedTime: p.createdAt,
    modifiedTime: p.editedAt,
    section: p.publicationType || "Publications",
  });
}

const PublicationDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const publication = await getPublicationById(id, user?.id);

  if (!publication) notFound();

  const p = publication;
  const userVote =
    (p.votes?.[0]?.voteType as "UPVOTE" | "DOWNVOTE" | null) ?? null;

  async function handleDelete() {
    "use server";
    const res = await deletePublication(p.id);
    if (res?.success === false) return res;
    // Engaged deleted content stays readable (tombstone); stay on the page.
    return deletedDetailNavigation(res?.data, "/publications", [["publications"]]);
  }

  return (
    <DetailPageCardShell
      isDeleted={p.isDeleted}
      deletedByType={p.deletedByType}
      deletedNoun="publication"
      isFrozen={p.isFrozen ?? false}
      frozenEntityId={p.id}
      frozenModule="PUBLICATION"
      frozenEntityType="POST"
      frozenOwnerId={p.author?.id ?? null}
      frozenHasActiveAppeal={p.hasActiveAppeal ?? false}
      backHref="/publications"
      backLabel="Back to Publications"
      authorHref={`/scholars/${p.author?.id}`}
      authorName={p.author?.name || "Scholar"}
      authorHandle={p.author?.handle || undefined}
      authorAvatarUrl={p.author?.avatarUrl || undefined}
      authorVerified={!!p.author?.institutionVerifiedAt}
      authorId={p.author?.id}
      isFollowing={!!p.author?.followers?.length}
      currentUserId={user?.id}
      createdDate={p.createdAt}
      editedDate={
        p.editedAt && p.editedAt > p.createdAt ? p.editedAt : undefined
      }
      managementControls={
        user?.id === p.author?.id ? (
          <OwnerActionsDropdown
            editHref={`/publications/${p.id}/edit`}
            onDelete={handleDelete}
            isOwner={true}
            editLabel="Edit Publication"
            deleteLabel="Delete"
          />
        ) : null
      }
      footerVoteButton={
        <VoteButton
          targetId={p.id}
          module="PUBLICATION"
          initialTotalVotes={p.totalVotes}
          initialUserVote={userVote}
          isOwnContent={user?.id === p.author?.id}
        />
      }
      footerBookmarkButton={
        <BookmarkButton
          frozen={p.isFrozen === true}
          targetId={p.id}
          module="PUBLICATION"
          initialTotalBookmarks={p.totalBookmarks ?? 0}
          initialIsBookmarked={
            Array.isArray(p.bookmarks) && p.bookmarks.length > 0
          }
        />
      }
      footerCommentsHref={`/publications/${p.id}#comments`}
      footerCommentsCount={p.totalComments}
      footerReportMenu={
        <ReportMenu
          entityId={p.id}
          entityType="POST"
          module="PUBLICATION"
          ownerId={p.author?.id ?? null}
          currentUserId={user?.id ?? null}
          isFrozen={p.isFrozen}
          isDeleted={false}
          hasActiveAppeal={p.hasActiveAppeal}
        />
      }
      discussion={
        <CommentSection
          locked={p.isFrozen ?? false}
          deleted={p.isDeleted}
          comments={p.comments}
          totalComments={p.totalComments}
          targetId={p.id}
          module="publication"
          currentUserId={user?.id ?? null}
          postAuthorId={p.author?.id}
        />
      }
    >
      <div className="flex items-start gap-2 sm:gap-3 mb-3 sm:mb-4">
        <h1 className="min-w-0 [overflow-wrap:anywhere] text-lg sm:text-xl md:text-2xl font-bold text-slate-950 flex-1">
          {p.title}
        </h1>
        <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 sm:px-3 sm:py-1 text-xs sm:text-sm font-semibold text-blue-700">
          {PUBLICATION_TYPE_LABELS[p.publicationType] || p.publicationType}
        </span>
      </div>

      <p className="text-sm sm:text-base text-slate-600 mb-3 sm:mb-4">
        <span className="font-semibold text-slate-800">Authors:</span>{" "}
        {p.publicationAuthors?.length
          ? p.publicationAuthors.map((pa, index) => {
              const name = pa.user?.name || `@${pa.user?.handle}`;
              return (
                <span key={pa.userId}>
                  {index > 0 && ", "}
                  <Link
                    href={`/scholars/${pa.userId}`}
                    prefetch={false}
                    className="font-semibold text-blue-600 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    {name}
                  </Link>
                </span>
              );
            })
          : p.authors}
      </p>

      <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-4 sm:mb-6">
        {(p.journal || p.journalOrConference) && (
          <div className="metric-card min-w-0 overflow-hidden bg-indigo-50 dark:bg-indigo-900/20">
            <p className="text-xs text-indigo-500 dark:text-indigo-400 font-medium uppercase tracking-wider">
              Journal / Conference
            </p>
            <p className="mt-1 break-words text-sm font-semibold text-indigo-800 dark:text-indigo-200 [overflow-wrap:anywhere]">
              {p.journal ? (
                <Link
                  href={`/journals/${p.journal.id}`}
                  prefetch={false}
                  className="hover:underline"
                >
                  {p.journal.title || p.journalOrConference}
                </Link>
              ) : (
                p.journalOrConference
              )}
            </p>
          </div>
        )}
        {p.publisher && (
          <div className="metric-card min-w-0 overflow-hidden bg-cyan-50 dark:bg-cyan-900/20">
            <p className="text-xs text-cyan-500 dark:text-cyan-400 font-medium uppercase tracking-wider">
              Publisher
            </p>
            <p className="mt-1 break-words text-sm font-semibold text-cyan-800 dark:text-cyan-200 [overflow-wrap:anywhere]">
              {p.publisher}
            </p>
          </div>
        )}
        {p.year && (
          <div className="metric-card min-w-0 overflow-hidden bg-rose-50 dark:bg-rose-900/20">
            <p className="text-xs text-rose-500 dark:text-rose-400 font-medium uppercase tracking-wider">
              Year
            </p>
            <p className="mt-1 break-words text-sm font-semibold text-rose-800 dark:text-rose-200 [overflow-wrap:anywhere]">{p.year}</p>
          </div>
        )}
        {p.domain && (
          <div className="metric-card min-w-0 overflow-hidden bg-emerald-50 dark:bg-emerald-900/20">
            <p className="text-xs text-emerald-500 dark:text-emerald-400 font-medium uppercase tracking-wider">
              Domain
            </p>
            <p className="mt-1 break-words text-sm font-semibold text-emerald-800 dark:text-emerald-200 [overflow-wrap:anywhere]">
              {p.domain}
            </p>
          </div>
        )}
        {p.volume && (
          <div className="metric-card min-w-0 overflow-hidden bg-blue-50 dark:bg-blue-900/20">
            <p className="text-xs text-blue-500 dark:text-blue-400 font-medium uppercase tracking-wider">
              Volume
            </p>
            <p className="mt-1 break-words text-sm font-semibold text-blue-800 dark:text-blue-200 [overflow-wrap:anywhere]">
              {p.volume}
            </p>
          </div>
        )}
        {p.issue && (
          <div className="metric-card min-w-0 overflow-hidden bg-sky-50 dark:bg-sky-900/20">
            <p className="text-xs text-sky-500 dark:text-sky-400 font-medium uppercase tracking-wider">
              Issue
            </p>
            <p className="mt-1 break-words text-sm font-semibold text-sky-800 dark:text-sky-200 [overflow-wrap:anywhere]">{p.issue}</p>
          </div>
        )}
        {p.pages && (
          <div className="metric-card min-w-0 overflow-hidden bg-teal-50 dark:bg-teal-900/20">
            <p className="text-xs text-teal-500 dark:text-teal-400 font-medium uppercase tracking-wider">
              Pages
            </p>
            <p className="mt-1 break-words text-sm font-semibold text-teal-800 dark:text-teal-200 [overflow-wrap:anywhere]">
              {p.pages}
            </p>
          </div>
        )}
        {p.isUserAuthor && (
          <div className="metric-card min-w-0 overflow-hidden bg-amber-50 dark:bg-amber-900/20">
            <p className="text-xs text-rose-500 dark:text-rose-400 font-medium uppercase tracking-wider">
              Author Status
            </p>
            <p className="mt-1 break-words text-sm font-semibold text-rose-800 dark:text-rose-200 [overflow-wrap:anywhere]">
              Co-author
            </p>
          </div>
        )}
      </div>

      {p.doi && (
        <div className="mb-2 min-w-0">
          <span className="text-sm font-medium text-slate-500">DOI: </span>
          <SafeExternalLink
            url={`https://doi.org/${p.doi}`}
            className="break-all text-sm text-blue-600 underline [overflow-wrap:anywhere] hover:text-blue-800"
          >
            {p.doi}
          </SafeExternalLink>
        </div>
      )}

      {p.isbn && (
        <div className="mb-2 min-w-0">
          <span className="text-sm font-medium text-slate-500">ISBN: </span>
          <span className="break-all text-sm text-slate-700 [overflow-wrap:anywhere]">{p.isbn}</span>
        </div>
      )}

      {p.keywords && (
        <div className="mb-3 sm:mb-4 flex flex-wrap gap-1.5 sm:gap-2">
          {p.keywords
            .split(",")
            .map((kw) => kw.trim())
            .filter(Boolean)
            .map((kw) => (
              <span
                key={kw.toLowerCase()}
                className="max-w-full break-words rounded-full border border-purple-200 bg-purple-100 px-2 py-0.5 sm:px-3 sm:py-1 text-[11px] sm:text-xs font-medium text-purple-800 [overflow-wrap:anywhere] dark:border-purple-800/30 dark:bg-purple-900/20 dark:text-purple-300"
              >
                {kw}
              </span>
            ))}
        </div>
      )}

      {p.abstract && (
        <div className="mt-4 sm:mt-6">
          <h3 className="text-base sm:text-lg font-semibold text-slate-950 mb-1.5 sm:mb-2">
            Abstract
          </h3>
          <RichContent content={p.abstract} />
        </div>
      )}

      {p.url && (
        <div className="flex gap-3 sm:gap-4 mb-6 sm:mb-8 mt-4 sm:mt-6">
          <SafeExternalLink
            url={p.url}
            className="flex-1 rounded-lg bg-slate-950 py-2 sm:py-2.5 text-center text-xs sm:text-sm font-semibold text-white transition-colors duration-200 hover:bg-slate-800"
          >
            View Publication
          </SafeExternalLink>
        </div>
      )}
    </DetailPageCardShell>
  );
};

export default PublicationDetailPage;
