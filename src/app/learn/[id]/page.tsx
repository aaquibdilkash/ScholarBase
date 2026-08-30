import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getCourseById, deleteCourse } from "@/app/actions/courses";
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
    const course = await getCourseById(id);
    const bits = [course.provider, course.instructor]
      .filter(Boolean)
      .join(" by ");
    const description = bits
      ? `${course.title}: a research learning course from ${bits}.`
      : `Research learning course: ${course.title}.`;
    return {
      title: course.title,
      description,
      alternates: { canonical: `/learn/${course.id}` },
      openGraph: {
        title: course.title,
        description,
        type: "article",
        url: `/learn/${course.id}`,
      },
    };
  } catch {
    return { title: "Course" };
  }
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const course = await getCourseById(id, user?.id).catch(() => null);

  if (!course) notFound();

  const userVote =
    course.votes?.find((v) => v.userId === user?.id)?.voteType ?? null;
  const details = [
    ["Provider", course.provider],
    ["Instructor", course.instructor],
    ["Format", course.format],
    ["Level", course.level],
    ["Price", course.price],
    ["Duration", course.duration],
  ].filter(([, value]) => Boolean(value));

  async function handleDelete() {
    "use server";
    await deleteCourse(course!.id);
    return { redirect: "/learn" };
  }

  return (
    <DetailPageCardShell
      isFrozen={course.isFrozen ?? false}
      backHref="/learn"
      backLabel="Back to Courses"
      authorHref={`/scholars/${course.author?.id}`}
      authorName={course.author?.name || "Scholar"}
      authorHandle={course.author?.handle || undefined}
      authorAvatarUrl={course.author?.avatarUrl || undefined}
      authorId={course.author?.id}
      isFollowing={!!course.author?.followers?.length}
      currentUserId={user?.id}
      createdDate={course.createdAt}
      editedDate={
        course.updatedAt > course.createdAt ? course.updatedAt : undefined
      }
      managementControls={
        user?.id === course.author?.id ? (
          <OwnerActionsDropdown
            editHref={`/learn/${course.id}/edit`}
            onDelete={handleDelete}
            isOwner={true}
            editLabel="Edit Course"
            deleteLabel="Delete"
          />
        ) : null
      }
      footerVoteButton={
        <VoteButton
          targetId={course.id}
          module="COURSE"
          initialTotalVotes={course.totalVotes}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/learn/${course.id}#comments`}
      footerCommentsCount={course.totalComments}
      footerReportMenu={
        <ReportMenu
          entityId={course.id}
          entityType="POST"
          module="COURSE"
          ownerId={course.author?.id ?? null}
          currentUserId={user?.id ?? null}
          isFrozen={course.isFrozen}
          isDeleted={false}
          hasActiveAppeal={course.hasActiveAppeal}
        />
      }
      discussion={
        <CommentSection
          locked={course.isFrozen ?? false}
          comments={course.comments}
          totalComments={course.totalComments}
          targetId={course.id}
          module="course"
          currentUserId={user?.id || null}
          postAuthorId={course.author?.id}
        />
      }
    >
      <h1 className="mb-3 text-lg font-bold text-slate-950 dark:text-slate-50 sm:text-xl md:text-2xl">
        {course.title}
      </h1>
      {details.length > 0 && (
        <dl className="mb-5 grid gap-3 sm:grid-cols-2">
          {details.map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
            >
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {label}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <RichContent content={course.description} />
      <a
        href={course.link}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 block rounded-lg bg-slate-950 py-2 text-center text-xs font-semibold text-white transition-colors hover:bg-slate-800 sm:text-sm"
      >
        Open Course
      </a>
    </DetailPageCardShell>
  );
}
