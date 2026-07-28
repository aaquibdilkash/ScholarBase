import { notFound } from "next/navigation";
import { CommentSection } from "@/components/interactions/CommentSection";
import { createClient } from "@/utils/supabase/server";
import { VoteButton } from "@/components/interactions/VoteButton";
import { deleteJobVacancy, getVacancyById } from "@/app/actions/vacancies";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { RichContent } from "@/components/content/RichContent";

const VacancyDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const vacancy = await getVacancyById(id);

  if (!vacancy) {
    notFound();
  }

  const upvotes =
    vacancy.votes?.filter((v: any) => v.voteType === "UPVOTE").length ?? 0;
  const downvotes =
    vacancy.votes?.filter((v: any) => v.voteType === "DOWNVOTE").length ?? 0;
  const userVote =
    (vacancy.votes?.find((v: any) => v.userId === user?.id)?.voteType as
      | "UPVOTE"
      | "DOWNVOTE"
      | null) ?? null;

  async function handleDelete() {
    "use server";
    await deleteJobVacancy(vacancy!.id);
  }

  return (
    <DetailPageCardShell
      backHref="/vacancies"
      backLabel="Back to Academic Vacancies"
      authorHref={`/scholar/${vacancy.author.id}`}
      authorName={vacancy.author.name || "Scholar"}
      authorHandle={vacancy.author.handle || undefined}
      authorAvatarUrl={vacancy.author.avatarUrl || undefined}
      authorId={vacancy.author.id}
      isFollowing={(vacancy.author as any)?.followers?.length ? true : false}
      createdDate={vacancy.createdAt}
      managementControls={
        user?.id === vacancy.author.id ? (
          <OwnerActionsDropdown
            editHref={`/vacancies/${vacancy.id}/edit`}
            onDelete={handleDelete}
            isOwner={true}
            editLabel="Edit Vacancy"
            deleteLabel="Delete"
          />
        ) : null
      }
      footerVoteButton={
        <VoteButton
          targetId={vacancy.id}
          type="vacancy"
          initialUpvotes={upvotes}
          initialDownvotes={downvotes}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/vacancies/${vacancy.id}#comments`}
      footerCommentsCount={vacancy._count.comments}
      discussion={
        <div
          className="mt-8 sb-surface-strong p-8 md:p-12 rounded-xl"
          id="comments"
        >
          <h2 className="text-2xl font-bold text-slate-950 mb-6">Discussion</h2>
          <CommentSection
            comments={vacancy.comments}
            targetId={vacancy.id}
            type="vacancy"
            currentUserId={user?.id || null}
            postAuthorId={vacancy.author.id}
          />
        </div>
      }
    >
      <h1 className="text-2xl md:text-3xl font-bold text-slate-950 mb-2">
        {vacancy.title}
      </h1>
      <p className="text-md font-medium text-slate-600 mb-6">
        {vacancy.institution}
      </p>

      <RichContent
        content={vacancy.description}
        className="text-slate-800 leading-relaxed mb-6"
      />

      <div className="mb-6 space-y-3">
        <div className="flex items-center gap-2 text-red-600 font-semibold rounded-xl border border-red-100/50 bg-red-50/50 p-3">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>Last Date to Apply:</span>
          <span>
            {new Date(vacancy.deadline).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
      </div>

      <div className="flex gap-4 mb-8">
        {vacancy.notificationLink && (
          <a
            href={vacancy.notificationLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-lg bg-slate-100 py-2.5 text-center text-sm font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-200"
          >
            View Details
          </a>
        )}
        {vacancy.applyLink && (
          <a
            href={vacancy.applyLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-lg bg-slate-950 py-2.5 text-center text-sm font-semibold text-white transition-colors duration-200 hover:bg-slate-800"
          >
            Apply Now
          </a>
        )}
      </div>
    </DetailPageCardShell>
  );
};

export default VacancyDetailPage;
