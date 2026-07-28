import { notFound } from "next/navigation";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import { CommentSection } from "@/components/interactions/CommentSection";
import { VoteButton } from "@/components/interactions/VoteButton";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { createClient } from "@/utils/supabase/server";
import { getJournalById } from "../../actions/journals";
import { deleteJournal } from "@/app/actions/journals";
import { RichContent } from "@/components/content/RichContent";

const JournalDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const journal = await getJournalById(id, user?.id);

  if (!journal) notFound();

  const j = journal;
  const upvotes =
    j.votes?.filter((v: any) => v.voteType === "UPVOTE").length ?? 0;
  const downvotes =
    j.votes?.filter((v: any) => v.voteType === "DOWNVOTE").length ?? 0;
  const userVote =
    (j.votes?.find((v: any) => v.userId === user?.id)?.voteType as
      | "UPVOTE"
      | "DOWNVOTE"
      | null) ?? null;

  async function handleDelete() {
    "use server";
    await deleteJournal(j.id);
  }

  return (
    <DetailPageCardShell
      backHref="/journals"
      backLabel="Back to Journals"
      authorHref={`/scholar/${j.author.id}`}
      authorName={j.author.name || "Scholar"}
      authorHandle={j.author.handle || undefined}
      authorAvatarUrl={j.author.avatarUrl || undefined}
      authorId={j.author.id}
      isFollowing={!!j.author.followers?.length}
      createdDate={j.createdAt}
      editedDate={j.updatedAt > j.createdAt ? j.updatedAt : undefined}
      managementControls={
        user?.id === j.author.id ? (
          <OwnerActionsDropdown
            editHref={`/journals/${j.id}/edit`}
            onDelete={handleDelete}
            isOwner={true}
            editLabel="Edit Journal"
            deleteLabel="Delete"
          />
        ) : null
      }
      footerVoteButton={
        <VoteButton
          targetId={j.id}
          type="journal"
          initialUpvotes={upvotes}
          initialDownvotes={downvotes}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/journals/${j.id}#comments`}
      footerCommentsCount={j._count.comments}
      discussion={
        <div
          className="mt-8 sb-surface-strong p-8 md:p-12 rounded-xl"
          id="comments"
        >
          <h2 className="text-2xl font-bold text-slate-950 mb-6">Discussion</h2>
          <CommentSection
            comments={j.comments}
            targetId={j.id}
            type="journal"
            currentUserId={user?.id ?? null}
            postAuthorId={j.author.id}
          />
        </div>
      }
    >
      <h1 className="text-2xl md:text-3xl font-bold text-slate-950 mb-2">
        {j.title}
      </h1>

      <div className="mb-6">
        {j.issn && <p className="text-sm text-slate-500">ISSN: {j.issn}</p>}
      </div>

      <RichContent content={j.about} />

      <div className="flex gap-4 mb-8">
        {j.website && (
          <a
            href={j.website}
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

export default JournalDetailPage;
