import { notFound } from "next/navigation";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import { ReportMenu } from "@/components/cards/ReportMenu";
import { CommentSection } from "@/components/interactions/CommentSection";
import { VoteButton } from "@/components/interactions/VoteButton";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { createClient } from "@/utils/supabase/server";
import { getPublicationById } from "../../actions/publications";
import { deletePublication } from "@/app/actions/publications";
import { RichContent } from "@/components/content/RichContent";

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

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = await getPublicationById(id).catch(() => null);
  if (!p) return { title: "Publication" };
  return buildMetadata({
    title: p.title,
    description: (p.abstract || p.title).replace(/<[^>]*>/g, " "),
    path: `/publications/${p.id}`,
    type: "article",
    author: p.author?.name || undefined,
    keywords: p.keywords ? p.keywords.split(",").map((k) => k.trim()).filter(Boolean) : undefined,
    publishedTime: p.createdAt,
    modifiedTime: p.updatedAt,
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
    (p.votes?.find((v) => v.userId === user?.id)?.voteType as
      | "UPVOTE"
      | "DOWNVOTE"
      | null) ?? null;

  async function handleDelete() {
    "use server";
        await deletePublication(p.id);
    return { redirect: "/publications" };
  }

  return (
    <DetailPageCardShell
      isFrozen={p.isFrozen ?? false}
      backHref="/publications"
      backLabel="Back to Publications"
      authorHref={`/scholars/${p.author?.id}`}
      authorName={p.author?.name || "Scholar"}
      authorHandle={p.author?.handle || undefined}
      authorAvatarUrl={p.author?.avatarUrl || undefined}
      authorId={p.author?.id}
      isFollowing={!!p.author?.followers?.length}
      currentUserId={user?.id}
      createdDate={p.createdAt}
      editedDate={p.updatedAt > p.createdAt ? p.updatedAt : undefined}
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
        />
      }
      footerCommentsHref={`/publications/${p.id}#comments`}
      footerCommentsCount={p.totalComments}
      footerReportMenu={
        <ReportMenu entityId={p.id} entityType="POST" module="PUBLICATION" />
      }
      discussion={
             <CommentSection
               locked={p.isFrozen ?? false}
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
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-950 flex-1">
          {p.title}
        </h1>
        <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 sm:px-3 sm:py-1 text-xs sm:text-sm font-semibold text-blue-700">
          {PUBLICATION_TYPE_LABELS[p.publicationType] || p.publicationType}
        </span>
      </div>

      <p className="text-sm sm:text-base text-slate-600 mb-3 sm:mb-4">
        <span className="font-semibold text-slate-800">Authors:</span>{" "}
        {p.authors}
      </p>

      <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-4 sm:mb-6">
        {p.journalOrConference && (
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
              Journal / Conference
            </p>
            <p className="text-sm font-semibold text-slate-800 mt-1">
              {p.journalOrConference}
            </p>
          </div>
        )}
        {p.publisher && (
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
              Publisher
            </p>
            <p className="text-sm font-semibold text-slate-800 mt-1">
              {p.publisher}
            </p>
          </div>
        )}
        {p.year && (
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
              Year
            </p>
            <p className="text-sm font-semibold text-slate-800 mt-1">
              {p.year}
            </p>
          </div>
        )}
        {p.domain && (
          <div className="rounded-xl bg-emerald-50 p-3">
            <p className="text-xs text-emerald-500 font-medium uppercase tracking-wider">
              Domain
            </p>
            <p className="text-sm font-semibold text-emerald-800 mt-1">
              {p.domain}
            </p>
          </div>
        )}
        {p.volume && (
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
              Volume
            </p>
            <p className="text-sm font-semibold text-slate-800 mt-1">
              {p.volume}
            </p>
          </div>
        )}
        {p.issue && (
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
              Issue
            </p>
            <p className="text-sm font-semibold text-slate-800 mt-1">
              {p.issue}
            </p>
          </div>
        )}
        {p.pages && (
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
              Pages
            </p>
            <p className="text-sm font-semibold text-slate-800 mt-1">
              {p.pages}
            </p>
          </div>
        )}
        {p.isUserAuthor && (
          <div className="rounded-xl bg-amber-50 p-3">
            <p className="text-xs text-amber-500 font-medium uppercase tracking-wider">
              Author Status
            </p>
            <p className="text-sm font-semibold text-amber-800 mt-1">
              Co-author
            </p>
          </div>
        )}
      </div>

      {p.doi && (
        <div className="mb-2">
          <span className="text-sm font-medium text-slate-500">DOI: </span>
          <a
            href={`https://doi.org/${p.doi}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            {p.doi}
          </a>
        </div>
      )}

      {p.isbn && (
        <div className="mb-2">
          <span className="text-sm font-medium text-slate-500">ISBN: </span>
          <span className="text-sm text-slate-700">{p.isbn}</span>
        </div>
      )}

      {p.keywords && (
        <div className="mb-3 sm:mb-4 flex flex-wrap gap-1.5 sm:gap-2">
          {p.keywords.split(",").map((kw, i) => (
            <span
              key={i}
              className="rounded-full bg-purple-50 px-2 py-0.5 sm:px-3 sm:py-1 text-[11px] sm:text-xs font-medium text-purple-700"
            >
              {kw.trim()}
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
          <a
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-lg bg-slate-950 py-2 sm:py-2.5 text-center text-xs sm:text-sm font-semibold text-white transition-colors duration-200 hover:bg-slate-800"
          >
            View Publication
          </a>
        </div>
      )}
    </DetailPageCardShell>
  );
};

export default PublicationDetailPage;
