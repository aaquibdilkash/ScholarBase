import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { CommentSection } from "@/components/interactions/CommentSection";
import { createClient } from "@/utils/supabase/server";
import { LikeButton } from "@/components/interactions/LikeButton";
import { deleteJobVacancy } from "@/app/actions/opportunities";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";

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

  const vacancy = await prisma.jobVacancy.findUnique({
    where: { id: id },
    include: {
      author: true,
      comments: {
        where: { parentId: null },
        include: {
          author: true,
          likes: user ? { where: { userId: user.id } } : false,
          _count: { select: { likes: true } },
          replies: {
            include: {
              author: true,
              likes: user ? { where: { userId: user.id } } : false,
              _count: { select: { likes: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      likes: user ? { where: { userId: user.id } } : false,
      _count: {
        select: { likes: true, comments: true },
      },
    },
  });

  if (!vacancy) {
    notFound();
  }

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
      footerLikeButton={
        <LikeButton
          targetId={vacancy.id}
          type="vacancy"
          initialLikes={vacancy._count.likes}
          initialIsLiked={!!vacancy.likes?.length}
        />
      }
      footerCommentsHref={`/vacancies/${vacancy.id}#comments`}
      footerCommentsCount={vacancy._count.comments}
      discussion={
        <div className="mt-12" id="comments">
          <h2 className="text-2xl font-bold text-slate-950 mb-6">Discussion</h2>
          <CommentSection
            comments={vacancy.comments}
            targetId={vacancy.id}
            type="vacancy"
            currentUserId={user?.id || null}
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

      <p className="text-slate-800 whitespace-pre-wrap leading-relaxed mb-6">
        {vacancy.description}
      </p>

      <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-100/50 bg-red-50/50 p-3 text-sm font-semibold text-red-600">
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
        Last Date to Apply:{" "}
        {new Date(vacancy.deadline).toLocaleDateString("en-US", {
          dateStyle: "medium",
        })}
      </div>

      <div className="flex gap-4 mb-8">
        {vacancy.notificationLink && (
          <a
            href={vacancy.notificationLink}
            target="_blank"
            rel="noopener noreferrer"
            className="sb-button-accent"
          >
            View Details
          </a>
        )}
        {vacancy.applyLink && (
          <a
            href={vacancy.applyLink}
            target="_blank"
            rel="noopener noreferrer"
            className="sb-button-accent"
          >
            Apply Now
          </a>
        )}
      </div>
    </DetailPageCardShell>
  );
};

export default VacancyDetailPage;
