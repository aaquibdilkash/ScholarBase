import { notFound } from "next/navigation";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import { CommentSection } from "@/components/interactions/CommentSection";
import { LikeButton } from "@/components/interactions/LikeButton";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { createClient } from "@/utils/supabase/server";
import { getJournalById } from "../../actions/journals";
import { deleteJournal } from "@/app/actions/journals";
import { RichContent } from "@/components/content/RichContent";

import Image from "next/image";

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
      footerLikeButton={
        <LikeButton
          targetId={j.id}
          type="journal"
          initialLikes={j._count.likes}
          initialIsLiked={!!j.likes?.length}
        />
      }
      footerCommentsHref={`/journals/${j.id}#comments`}
      footerCommentsCount={j._count.comments}
      discussion={
        <div className="mt-12" id="comments">
          <h2 className="text-2xl font-bold text-slate-950 mb-6">Discussion</h2>
          <CommentSection
            comments={j.comments}
            targetId={j.id}
            type="journal"
            currentUserId={user?.id ?? null}
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

      <div className="mt-3 flex items-center gap-4">
        {j.website && (
          <a
            href={j.website}
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

export default JournalDetailPage;
