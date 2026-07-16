import { notFound } from "next/navigation";
import { CommentSection } from "@/components/interactions/CommentSection";
import { createClient } from "@/utils/supabase/server";
import { LikeButton } from "@/components/interactions/LikeButton";
import Link from "next/link";
import Image from "next/image";
import { getResearchToolById } from "../../actions/researchTools";
import { RichContent } from "@/components/content/RichContent";
import { deleteResearchTool } from "@/app/actions/researchTools";

const ResearchToolDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const tool = await getResearchToolById(id, user?.id);

  if (!tool) {
    notFound();
  }

  // Define the delete action outside of the JSX
  async function handleDelete() {
    "use server";
    await deleteResearchTool(tool!.id);
  }

  return (
    <main className="mx-auto max-w-3xl py-12 px-4 sm:px-6 lg:px-8">
      <Link
        href="/research-tools"
        className="inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700 mb-8"
      >
        ← Back to Research Tools
      </Link>

      <div className="sb-card p-6 md:p-8">
        {/* Simplified Management Controls */}
        {user?.id === tool.author.id && (
          <div className="flex justify-end items-center gap-4 mb-6 border-b border-slate-100 pb-4">
            <Link
              href={`/research-tools/${tool.id}/edit`}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors bg-blue-50 px-3 py-1.5 rounded-md"
            >
              Edit Tool
            </Link>
            <form action={handleDelete}>
              <button
                type="submit"
                className="text-xs font-bold text-red-600 hover:text-red-700 transition-colors bg-red-50 px-3 py-1.5 rounded-md"
              >
                Delete
              </button>
            </form>
          </div>
        )}

        <div className="flex items-center gap-3 mb-4">
          <Link href={`/scholar/${tool.author.id}`} className="shrink-0">
            <div className="w-12 h-12 rounded-full bg-slate-100 border flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-blue-100 transition">
              {tool.author.avatarUrl ? (
                <Image
                  src={tool.author.avatarUrl}
                  alt="Author"
                  width={48}
                  height={48}
                  unoptimized
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-semibold text-slate-400 text-lg">
                  {tool.author.name?.charAt(0).toUpperCase() || "?"}
                </span>
              )}
            </div>
          </Link>
          <div>
            <Link
              href={`/scholar/${tool.author.id}`}
              className="font-semibold text-slate-950 hover:text-blue-700 hover:underline transition"
            >
              {tool.author.name || "Scholar"}
            </Link>
            <div className="mt-0.5 text-xs font-medium text-slate-500">
              @{tool.author.handle}
            </div>
          </div>
        </div>

        <h1 className="text-2xl md:text-3xl font-bold text-slate-950 mb-2">
          {tool.name}
        </h1>

        <RichContent content={tool.description} />

        <div className="mt-3 flex items-center gap-4">
          {tool.website && (
            <a
              href={tool.website}
              target="_blank"
              rel="noopener noreferrer"
              className="sb-button-accent"
            >
              View Website
            </a>
          )}
        </div>

        <div className="border-t border-slate-200 pt-6 flex items-center gap-8 mt-8">
          <LikeButton
            targetId={tool.id}
            type="researchTool"
            initialLikes={tool._count.likes}
            initialIsLiked={!!tool.likes?.length}
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
            {tool._count.comments} Comments
          </div>
        </div>
      </div>

      <div className="mt-12">
        <h2 className="text-2xl font-bold text-slate-950 mb-6">Discussion</h2>
        <CommentSection
          comments={tool.comments}
          targetId={tool.id}
          type="researchTool"
          currentUserId={user?.id || null}
        />
      </div>
    </main>
  );
};

export default ResearchToolDetailPage;
