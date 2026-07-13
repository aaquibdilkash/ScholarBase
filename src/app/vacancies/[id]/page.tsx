import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { CommentSection } from "@/components/interactions/CommentSection";
import { createClient } from "@/utils/supabase/server";
import { LikeButton } from "@/components/interactions/LikeButton";
import Link from "next/link";
import Image from "next/image";

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

  return (
    <main className="mx-auto max-w-3xl py-12 px-4 sm:px-6 lg:px-8">
      <Link
        href="/vacancies"
        className="inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700 mb-8"
      >
        ← Back to Academic Vacancies
      </Link>
      <div className="sb-card p-6 md:p-8">
        <div className="flex items-center gap-3 mb-4">
          <Link href={`/scholar/${vacancy.author.id}`} className="shrink-0">
            <div className="w-12 h-12 rounded-full bg-slate-100 border flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-blue-100 transition">
              {vacancy.author.avatarUrl ? (
                <Image
                  src={vacancy.author.avatarUrl}
                  alt="Author"
                  width={48}
                  height={48}
                  unoptimized
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-semibold text-slate-400 text-lg">
                  {vacancy.author.name?.charAt(0).toUpperCase() || "?"}
                </span>
              )}
            </div>
          </Link>
          <div>
            <Link
              href={`/scholar/${vacancy.author.id}`}
              className="font-semibold text-slate-950 hover:text-blue-700 hover:underline transition"
            >
              {vacancy.author.name || "Scholar"}
            </Link>
            <div className="mt-0.5 text-xs font-medium text-slate-500">
              @{vacancy.author.handle}
            </div>
          </div>
        </div>

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
            ></path>
          </svg>
          Last Date to Apply: Last Date to Apply:{" "}
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

        <div className="border-t border-slate-200 pt-6 flex items-center gap-8">
          <LikeButton
            targetId={vacancy.id}
            type="vacancy"
            initialLikes={vacancy._count.likes}
            initialIsLiked={!!vacancy.likes?.length}
          />
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
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
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            {vacancy._count.comments} Comments
          </div>
        </div>
      </div>

      <div className="mt-12">
        <h2 className="text-2xl font-bold text-slate-950 mb-6">Discussion</h2>
        <CommentSection
          comments={vacancy.comments}
          targetId={vacancy.id}
          type="vacancy"
          currentUserId={user?.id || null}
        />
      </div>
    </main>
  );
};

export default VacancyDetailPage;
