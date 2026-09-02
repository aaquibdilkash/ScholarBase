import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import {
  getResearchGrantById,
  deleteResearchGrant,
} from "@/app/actions/grants";
import { CommentSection } from "@/components/interactions/CommentSection";
import { VoteButton } from "@/components/interactions/VoteButton";
import { RichContent } from "@/components/content/RichContent";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import { ReportMenu } from "@/components/cards/ReportMenu";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const grant = await getResearchGrantById(id);
    const description = grant.amount
      ? `${grant.title} funding opportunity: ${grant.amount}.`
      : `Research grant opportunity: ${grant.title}.`;
    return {
      title: grant.title,
      description,
      alternates: { canonical: `/grants/${grant.id}` },
      openGraph: {
        title: grant.title,
        description,
        type: "article",
        url: `/grants/${grant.id}`,
      },
    };
  } catch {
    return { title: "Research Grant" };
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

  if (!grant) notFound();

  const userVote =
    grant.votes?.find((v) => v.userId === user?.id)?.voteType ?? null;

  async function handleDelete() {
    "use server";
    await deleteResearchGrant(grant!.id);
    return { redirect: "/grants", invalidateQueries: [["grants"]] };
  }

  return (
    <DetailPageCardShell
      isFrozen={grant.isFrozen ?? false}
      backHref="/grants"
      backLabel="Back to Research Grants"
      authorHref={`/scholars/${grant.author?.id}`}
      authorName={grant.author?.name || "Scholar"}
      authorHandle={grant.author?.handle || undefined}
      authorAvatarUrl={grant.author?.avatarUrl || undefined}
      authorId={grant.author?.id}
      isFollowing={!!grant.author?.followers?.length}
      currentUserId={user?.id}
      createdDate={grant.createdAt}
      editedDate={
        grant.updatedAt > grant.createdAt ? grant.updatedAt : undefined
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
          isDeleted={false}
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
      <h1 className="mb-2 text-lg font-bold text-slate-950 dark:text-slate-50 sm:text-xl md:text-2xl">
        {grant.title}
      </h1>
      {grant.amount && (
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-300 sm:text-base">
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            Amount:
          </span>{" "}
          {grant.amount}
        </p>
      )}
      <RichContent content={grant.description} />
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        {grant.applyLink && (
          <a
            href={grant.applyLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-lg bg-slate-950 py-2 text-center text-xs font-semibold text-white transition-colors hover:bg-slate-800 sm:text-sm"
          >
            Apply
          </a>
        )}
        {grant.infoLink && (
          <a
            href={grant.infoLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-lg border border-slate-200 py-2 text-center text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900 sm:text-sm"
          >
            More Info
          </a>
        )}
      </div>
    </DetailPageCardShell>
  );
}
