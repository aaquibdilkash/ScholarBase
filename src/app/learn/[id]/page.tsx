import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getCourseById, deleteCourse } from "@/app/actions/courses";
import { buildMetadata, buildNoindexMetadata } from "@/lib/seo";
import { SEO_PAGES } from "@/constants/seo";
import { CommentSection } from "@/components/interactions/CommentSection";
import { VoteButton } from "@/components/interactions/VoteButton";
import { BookmarkButton } from "@/components/interactions/BookmarkButton";
import { RichContent } from "@/components/content/RichContent";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  buildBreadcrumbList,
  buildContentJsonLd,
  CONTENT_SCHEMA,
} from "@/lib/schema";
import { ReportMenu } from "@/components/cards/ReportMenu";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { SafeExternalLink } from "@/components/ui/SafeExternalLink";
import RelatedContent from "@/components/content/RelatedContent";
import { getRelatedContent } from "@/lib/semantic/related";
import { formatCoursePrice } from "@/lib/course-currency";
import { formatCourseDuration } from "@/lib/course-duration";
import { getModeratorDeletedContent } from "@/lib/deleted-content";
import { RemovedContentNotice } from "@/components/moderation/RemovedContentNotice";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const course = await getCourseById(id);
    if (!course) throw new Error("not found");
    const bits = [course.provider, course.instructor]
      .filter(Boolean)
      .join(" by ");
    const description = bits
      ? `${course.title}: a research learning course from ${bits}.`
      : `Research learning course: ${course.title}.`;

    return buildMetadata({
      title: course.title || SEO_PAGES.learn.title,
      description,
      path: `/learn/${course.id}`,
      type: "article",
      section: SEO_PAGES.learn.section,
    });
  } catch {
    return buildNoindexMetadata("Removed content");
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

  if (!course) {
    const removed = await getModeratorDeletedContent("course", { id });
    if (!removed) notFound();
    return (
      <RemovedContentNotice
        backHref="/learn"
        backLabel="Back to Learning Zone"
        entityId={removed.id}
        module="COURSE"
        ownerId={removed.authorId}
        currentUserId={user?.id}
        hasActiveAppeal={removed.hasActiveAppeal}
        noun="course"
      />
    );
  }

  const userVote = course.votes?.[0]?.voteType ?? null;

  const related = await getRelatedContent("COURSE", course.id);
  const priceLabel = formatCoursePrice(course.price, course.currency);
  const details = [
    ["Provider", course.provider],
    ["Instructor", course.instructor],
    ["Format", course.format],
    ["Level", course.level],
    ["Price", priceLabel],
    ["Duration", formatCourseDuration(course.durationValue, course.durationUnit)],
  ].filter(([, value]) => Boolean(value));

  async function handleDelete() {
    "use server";
    const res = await deleteCourse(course!.id);
    if (res?.success === false) return res;
    return { redirect: "/learn", invalidateQueries: [["courses"]] };
  }

  return (
    <DetailPageCardShell
      structuredData={
        <JsonLd
          data={[
            buildContentJsonLd({
              type: CONTENT_SCHEMA.course,
              path: `/learn/${course.id}`,
              name: course.title,
              description: course.description,
              author: {
                name: course.author?.name,
                path: course.author?.id
                  ? `/scholars/${course.author.id}`
                  : null,
              },
              datePublished: course.createdAt,
              dateModified: course.editedAt,
              extra: {
                ...(course.provider
                  ? {
                      provider: {
                        "@type": "Organization",
                        name: course.provider,
                      },
                    }
                  : {}),
                ...(typeof course.price === "number" && course.price > 0
                  ? {
                      offers: {
                        "@type": "Offer",
                        price: course.price,
                        priceCurrency: course.currency,
                      },
                    }
                  : {}),
              },
            }),
            buildBreadcrumbList([
              { name: "Learning Zone", path: "/learn" },
              { name: course.title, path: `/learn/${course.id}` },
            ]),
          ]}
        />
      }
      relatedContent={<RelatedContent title="Related courses" items={related} />}
      isFrozen={course.isFrozen ?? false}
      frozenEntityId={course.id}
      frozenModule="COURSE"
      frozenEntityType="POST"
      frozenOwnerId={course.author?.id ?? null}
      frozenHasActiveAppeal={course.hasActiveAppeal ?? false}
      backHref="/learn"
      backLabel="Back to Learning Zone"
      authorHref={`/scholars/${course.author?.id}`}
      authorName={course.author?.name || "Scholar"}
      authorHandle={course.author?.handle || undefined}
      authorAvatarUrl={course.author?.avatarUrl || undefined}
      authorVerified={!!course.author?.institutionVerifiedAt}
      authorId={course.author?.id}
      isFollowing={!!course.author?.followers?.length}
      currentUserId={user?.id}
      createdDate={course.createdAt}
      editedDate={
        course.editedAt && course.editedAt > course.createdAt
          ? course.editedAt
          : undefined
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
          isOwnContent={user?.id === course.author?.id}
        />
      }
      footerBookmarkButton={
        <BookmarkButton
          frozen={course.isFrozen === true}
          targetId={course.id}
          module="COURSE"
          initialTotalBookmarks={course.totalBookmarks ?? 0}
          initialIsBookmarked={
            Array.isArray(course.bookmarks) && course.bookmarks.length > 0
          }
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
      <h1 className="mb-3 min-w-0 max-w-full break-words text-lg font-bold text-slate-950 dark:text-slate-50 sm:text-xl md:text-2xl [overflow-wrap:anywhere]">
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
              <dd className="mt-1 break-words text-sm font-semibold text-slate-800 dark:text-slate-100">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <RichContent content={course.description} />
      <SafeExternalLink
        url={course.link}
        className="mt-4 block rounded-lg bg-slate-950 py-2 text-center text-xs font-semibold text-white transition-colors hover:bg-slate-800 sm:text-sm"
      >
        Open Course
      </SafeExternalLink>
    </DetailPageCardShell>
  );
}
