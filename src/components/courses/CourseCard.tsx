"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { ReportMenu } from "@/components/cards/ReportMenu";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { VoteButton } from "@/components/interactions/VoteButton";
import { RichContent } from "@/components/content/RichContent";
import { deleteCourse } from "@/app/actions/courses";
import { useToast } from "@/components/ui/Toast";
import type { CourseWithAuthor } from "@/types/cards";

export function CourseCard({
  course,
  currentUserId,
}: {
  course: CourseWithAuthor;
  currentUserId?: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isOwner = currentUserId === course.authorId;
  const isFollowing = (course.author?.followers?.length ?? 0) > 0;
  const userVote =
    ((course.votes || []) as { userId: string; voteType: "UPVOTE" | "DOWNVOTE" }[]).find((v) => v.userId === currentUserId)?.voteType ?? null;
  const details = [
    course.provider,
    course.instructor,
    course.format,
    course.level,
    course.price,
    course.duration,
  ].filter(Boolean);

  const deleteMutation = useMutation({
    mutationFn: deleteCourse,
    onSuccess: (response) => {
      if (!response.success || !response.data) {
        toast("Failed to delete course.", "error");
        return;
      }
      queryClient.setQueriesData(
        { queryKey: ["courses"] },
        (oldData: CourseWithAuthor[] = []) =>
          oldData.filter((c) => c.id !== response.data.deletedId),
      );
      toast("Course deleted successfully.", "success");
    },
    onError: (error) => toast(error.message, "error"),
  });

  return (
    <ListPageCardShell
      authorHref={`/scholars/${course.author?.id}`}
      authorName={course.author?.name || "Scholar"}
      authorId={course.author?.id}
      isFollowing={isFollowing}
      currentUserId={currentUserId}
      authorHandle={course.author?.handle || undefined}
      authorAvatarUrl={course.author?.avatarUrl || undefined}
      detailPageHref={`/learn/${course.id}`}
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={`/learn/${course.id}/edit`}
            onDelete={() => {
              deleteMutation.mutate(course.id);
              return { refresh: false };
            }}
            isOwner={true}
            editLabel="Edit Course"
            deleteLabel="Delete"
          />
        )
      }
      createdDate={course.createdAt}
      editedDate={
        course.editedAt && course.editedAt > course.createdAt ? course.editedAt : undefined
      }
      footerVoteButton={
        <VoteButton
          frozen={course.isFrozen === true}
          targetId={course.id}
          module="COURSE"
          initialTotalVotes={course.totalVotes ?? 0}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/learn/${course.id}`}
      footerCommentsCount={course.totalComments}
      footerReportMenu={
        <ReportMenu entityId={course.id} entityType="POST" module="COURSE" />
      }
      noBodyLink={true}
      bodyBottomContent={
        <a
          href={course.link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 block rounded-lg bg-slate-950 py-2 text-center text-xs font-semibold text-white transition-colors hover:bg-slate-800"
        >
          Open Course
        </a>
      }
    >
      <Link href={`/learn/${course.id}`} className="block group">
        <h2 className="mb-2 text-lg font-semibold leading-tight text-slate-950 transition-colors group-hover:text-blue-700 dark:text-slate-50 dark:group-hover:text-blue-300">
          {course.title}
        </h2>
        {details.length > 0 && (
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
            {details.join(" • ")}
          </p>
        )}
        <RichContent
          content={course.description}
          className="text-sm leading-relaxed text-slate-600 line-clamp-3"
        />
      </Link>
    </ListPageCardShell>
  );
}
