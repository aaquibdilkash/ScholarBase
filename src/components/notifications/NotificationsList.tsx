"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Notification } from "@prisma/client";
import { getNotifications } from "@/app/actions/notifications";
import { getNotificationLink } from "@/lib/notifications";
import { formatTimeAgo } from "@/utils/time-ago";
import { LoadMoreSentinel } from "@/components/layout/LoadMoreSentinel";
import Image from "next/image";
import Link from "next/link";
import {
  MarkReadButton,
  MarkAllReadButton,
} from "@/components/notifications/MarkReadButton";

type NotificationWithActor = Notification & {
  actor: {
    id: string;
    name: string | null;
    handle: string | null;
    avatarUrl: string | null;
  };
};

function typeLabel(type: string) {
  switch (type) {
    case "article-upvoted":
      return "Article upvote";
    case "post-upvoted":
      return "Post upvote";
    case "vacancy-upvoted":
      return "Vacancy upvote";
    case "admission-upvoted":
      return "Admission upvote";
    case "event-upvoted":
      return "Event upvote";
    case "recommendation-upvoted":
      return "Recommendation upvote";
    case "help-post-upvoted":
      return "Help post upvote";
    case "journal-upvoted":
      return "Journal upvote";
    case "contribution-upvoted":
      return "Contribution upvote";
    case "publication-upvoted":
      return "Publication upvote";
    case "research-tool-upvoted":
      return "Research tool upvote";
    case "research-grant-upvoted":
      return "Research grant upvote";
    case "course-upvoted":
      return "Course upvote";
    case "survey-upvoted":
      return "Survey upvote";
    case "supervisor-upvoted":
      return "Supervisor upvote";
    case "result-upvoted":
      return "Result upvote";
    case "comment-created":
      return "Comment";
    case "reply-created":
      return "Reply";
    case "follow":
      return "Follow";
    case "mention":
      return "Mention";
    case "article-published":
      return "New article";
    case "post-published":
      return "New post";
    case "contribution-approved":
      return "Contribution approved";
    case "contribution-rejected":
      return "Contribution rejected";
    default:
      return "Update";
  }
}

function NotificationCard({
  notification,
}: {
  notification: NotificationWithActor;
}) {
  const link = getNotificationLink(notification);
  const content = (
    <div className="flex items-start gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white dark:bg-slate-800 dark:text-slate-200">
        {notification.actor.avatarUrl ? (
          <Image
            src={notification.actor.avatarUrl}
            alt={notification.actor.name || "Actor"}
            width={48}
            height={48}
            unoptimized
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          notification.actor.name?.charAt(0).toUpperCase() || "@"
        )}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-slate-950 dark:text-slate-100">
            {notification.title}
          </p>
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            {typeLabel(notification.type)}
          </span>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {notification.body}
        </p>
        <p
          suppressHydrationWarning
          className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400"
        >
          {formatTimeAgo(notification.createdAt)}
        </p>
      </div>
    </div>
  );

  const markReadButton = !notification.readAt && (
    <MarkReadButton notificationId={notification.id} />
  );

  return (
    <div
      className={`sb-card flex flex-col gap-4 md:flex-row md:items-start md:justify-between ${
        notification.readAt
          ? "bg-slate-50/20 dark:bg-slate-800/20"
          : "border-blue-200 bg-blue-50/40 dark:border-blue-500/30 dark:bg-blue-500/10"
      }`}
    >
      {link ? (
        <Link href={link} className="flex-1">
          {content}
        </Link>
      ) : (
        <div className="flex-1">{content}</div>
      )}
      {markReadButton}
    </div>
  );
}

export function NotificationsList({
  userId,
  initialNotifications,
  initialUnreadCount,
}: {
  userId: string;
  initialNotifications: NotificationWithActor[];
  initialUnreadCount: number;
}) {
  const [hasMore, setHasMore] = useState(initialNotifications.length === 20);
  const [loadingMore, setLoadingMore] = useState(false);
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["notifications", userId], [userId]);

  const { data: notifications = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const items = await getNotifications(userId, 20);
      return items as NotificationWithActor[];
    },
    initialData: initialNotifications,
    staleTime: 30 * 1000,
  });

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const lastItemId =
        notifications.length > 0
          ? notifications[notifications.length - 1].id
          : undefined;
      const newItems = await getNotifications(userId, 20, lastItemId);

      if (newItems.length === 20) {
        setHasMore(true);
      } else {
        setHasMore(false);
      }

      queryClient.setQueryData<NotificationWithActor[]>(
        queryKey,
        (oldData = []) => [
          ...oldData,
          ...(newItems as NotificationWithActor[]),
        ],
      );
    } catch (error) {
      console.error("Failed to load more notifications:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [notifications, userId, hasMore, loadingMore, queryClient, queryKey]);

  return (
    <div>
      {initialUnreadCount > 0 && (
        <div className="mb-4 flex justify-end">
          <MarkAllReadButton />
        </div>
      )}

      <div className="space-y-4">
        {notifications.map((notification) => (
          <NotificationCard key={notification.id} notification={notification} />
        ))}

        <LoadMoreSentinel disabled={!hasMore || loadingMore} onVisible={loadMore} />

        {loadingMore && (
          <div className="py-4 text-center text-sm text-slate-500">
            Loading more...
          </div>
        )}

        {notifications.length === 0 && (
          <div className="sb-surface-strong p-10 text-center">
            <p className="text-lg font-semibold text-slate-950 dark:text-slate-100">
              No notifications yet
            </p>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Votes, comments, follows, mentions, and activity from people you
              follow will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
