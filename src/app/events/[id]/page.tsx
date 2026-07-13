import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { CommentSection } from "@/components/interactions/CommentSection";
import { createClient } from "@/utils/supabase/server";
import { LikeButton } from "@/components/interactions/LikeButton";
import Link from "next/link";
import Image from "next/image";

const EventDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const event = await prisma.researchEvent.findUnique({
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

  if (!event) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl py-12 px-4 sm:px-6 lg:px-8">
      <Link
        href="/events"
        className="inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700 mb-8"
      >
        ← Back to Events
      </Link>
      <div className="sb-card p-6 md:p-8">
        <div className="flex items-center gap-3 mb-4">
          <Link href={`/scholar/${event.author.id}`} className="shrink-0">
            <div className="w-12 h-12 rounded-full bg-slate-100 border flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-blue-100 transition">
              {event.author.avatarUrl ? (
                <Image
                  src={event.author.avatarUrl}
                  alt="Author"
                  width={48}
                  height={48}
                  unoptimized
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-semibold text-slate-400 text-lg">
                  {event.author.name?.charAt(0).toUpperCase() || "?"}
                </span>
              )}
            </div>
          </Link>
          <div>
            <Link
              href={`/scholar/${event.author.id}`}
              className="font-semibold text-slate-950 hover:text-blue-700 hover:underline transition"
            >
              {event.author.name || "Scholar"}
            </Link>
            <div className="mt-0.5 text-xs font-medium text-slate-500">
              @{event.author.handle}
            </div>
          </div>
        </div>

        <h1 className="text-2xl md:text-3xl font-bold text-slate-950 mb-2">
          {event.title}
        </h1>
        <p className="text-md font-medium text-slate-600 mb-6">
          {event.location}
        </p>

        <p className="text-slate-800 whitespace-pre-wrap leading-relaxed mb-6">
          {event.description}
        </p>

        <div className="mb-6 flex items-center gap-2 rounded-xl border-blue-100/50 bg-blue-50/50 p-3 text-sm font-semibold text-blue-600">
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
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            ></path>
          </svg>
          Event Date: {new Date(event.date).toLocaleDateString("en-US")}
        </div>

        {event.deadline && (
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
            Registration Deadline:{" "}
            {new Date(event.deadline).toLocaleDateString("en-US")}
          </div>
        )}

        <div className="flex gap-4 mb-8">
          {event.notificationLink && (
            <a
              href={event.notificationLink}
              target="_blank"
              rel="noopener noreferrer"
              className="sb-button-accent"
            >
              View Brochure
            </a>
          )}
          {event.applyLink && (
            <a
              href={event.applyLink}
              target="_blank"
              rel="noopener noreferrer"
              className="sb-button-accent"
            >
              Register Now
            </a>
          )}
        </div>

        <div className="border-t border-slate-200 pt-6 flex items-center gap-8">
          <LikeButton
            targetId={event.id}
            type="event"
            initialLikes={event._count.likes}
            initialIsLiked={!!event.likes?.length}
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
            {event._count.comments} Comments
          </div>
        </div>
      </div>

      <div className="mt-12">
        <h2 className="text-2xl font-bold text-slate-950 mb-6">Discussion</h2>
        <CommentSection
          comments={event.comments}
          targetId={event.id}
          type="event"
          currentUserId={user?.id || null}
        />
      </div>
    </main>
  );
};

export default EventDetailPage;
