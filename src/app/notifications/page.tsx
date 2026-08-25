import type { Metadata } from "next";
import { buildNoindexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoindexMetadata("Notifications - ScholarBase");
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { NotificationsList } from "@/components/notifications/NotificationsList";

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
    take: 20,
  });

  const unreadCount = notifications.filter(
    (notification) => !notification.readAt,
  ).length;

  return (
    <main className="mx-auto max-w-4xl py-6">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
            Notifications
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
            Your activity feed
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            See votes, comments, follows, mentions, and other updates that
            matter to you.
          </p>
        </div>
      </div>

      <NotificationsList
        userId={user.id}
        initialNotifications={notifications}
        initialUnreadCount={unreadCount}
      />
    </main>
  );
}
