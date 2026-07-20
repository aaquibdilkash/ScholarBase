import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/actions/notifications";
import Image from "next/image";
import Link from "next/link";
import { getNotificationLink } from "@/lib/notifications";

function typeLabel(type: string) {
  switch (type) {
    case "article-liked":
      return "Article like";
    case "post-liked":
      return "Post like";
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
    default:
      return "Update";
  }
}

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const notifications = await prisma.notification.findMany({
    where: { recipientId: user.id },
    include: { actor: true },
    orderBy: { createdAt: "desc" },
  });

  const unreadCount = notifications.filter(
    (notification) => !notification.readAt,
  ).length;

  return (
    <main className="mx-auto max-w-4xl py-6">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">
            Notifications
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Your activity feed
          </h1>
          <p className="mt-2 text-slate-600">
            See likes, comments, follows, mentions, and other updates that
            matter to you.
          </p>
        </div>

        {unreadCount > 0 && (
          <form action={markAllNotificationsRead}>
            <button type="submit" className="sb-button-soft whitespace-nowrap">
              Mark all read
            </button>
          </form>
        )}
      </div>

      <div className="space-y-4">
        {notifications.map((notification) => {
          const link = getNotificationLink(notification);
          const content = (
            <div
              key={notification.id}
              className={`sb-card flex flex-col gap-4 md:flex-row md:items-start md:justify-between ${
                notification.readAt ? "" : "border-blue-200 bg-blue-50/40"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
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
                    <p className="font-semibold text-slate-950">
                      {notification.title}
                    </p>
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {typeLabel(notification.type)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    {notification.body}
                  </p>
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    {new Date(notification.createdAt).toLocaleString("en-US")}
                  </p>
                </div>
              </div>

              {!notification.readAt && (
                <form action={markNotificationRead.bind(null, notification.id)}>
                  <button
                    type="submit"
                    className="sb-button-soft whitespace-nowrap px-4 py-2"
                  >
                    Mark read
                  </button>
                </form>
              )}
            </div>
          );

          if (link) {
            return <Link key={notification.id} href={link}>{content}</Link>;
          }

          return content;
        })}

        {notifications.length === 0 && (
          <div className="sb-surface-strong p-10 text-center">
            <p className="text-lg font-semibold text-slate-950">
              No notifications yet
            </p>
            <p className="mt-2 text-slate-600">
              Likes, comments, follows, mentions, and activity from people you
              follow will appear here.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
