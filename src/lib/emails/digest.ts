// src/lib/emails/digest.ts
// Shared logic for the daily/weekly notification digest cron jobs.
import { createHmac } from "crypto";
import { Resend } from "resend";
import prisma from "@/lib/db";
import { getModuleLabel, getNotificationLink } from "@/lib/notification-links";
import {
  generateDigestHtml,
  type DigestModuleGroup,
  type DigestNotification,
} from "@/lib/emails/generateDigestHtml";

const MODULE_ICONS: Record<string, string> = {
  Conversations: "💬",
  Publications: "📈",
  Feed: "💬",
  Blog: "🎓",
  Admissions: "🎓",
  Courses: "🎓",
  "Research Grants": "🎓",
};

function iconFor(label: string): string {
  return MODULE_ICONS[label] ?? "🔔";
}

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://scholarbase.app";
}

/**
 * Stateless HMAC token binding userId+pref so the one-click preference
 * links cannot be forged. Uses CRON_SECRET as the signing key — no new env vars.
 */
export function signPreferenceToken(userId: string, pref: string): string {
  return createHmac("sha256", process.env.CRON_SECRET ?? "")
    .update(`${userId}:${pref}`)
    .digest("hex");
}

export function verifyPreferenceToken(
  userId: string,
  pref: string,
  token: string
): boolean {
  const expected = signPreferenceToken(userId, pref);
  return (
    token.length === expected.length &&
    // timing-safe-ish comparison without extra deps
    [...token].every((char, i) => char === expected[i])
  );
}

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  targetType: string | null;
  targetId: string | null;
  actorId: string;
  createdAt: Date;
};

// getNotificationLink only reads type/targetType/targetId/actorId,
// so a structurally-compatible partial row is sufficient here.
function buildNotificationLink(row: NotificationRow): string | null {
  const path = getNotificationLink(row as never);
  return path ? `${getAppUrl()}${path}` : null;
}

function groupByModule(rows: NotificationRow[]): DigestModuleGroup[] {
  const map = new Map<string, NotificationRow[]>();

  for (const row of rows) {
    const label = row.targetType
      ? getModuleLabel(row.targetType)
      : row.type === "follow"
        ? "Scholars"
        : "Conversations";
    const bucket = map.get(label);
    if (bucket) bucket.push(row);
    else map.set(label, [row]);
  }

  return Array.from(map.entries()).map(([moduleLabel, rows]) => ({
    moduleLabel,
    icon: iconFor(moduleLabel),
    notifications: rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      createdAt: row.createdAt,
      link: buildNotificationLink(row),
    } satisfies DigestNotification)),
  }));
}

/**
 * Fetches, emails, and flags digest notifications for every opted-in user.
 * Read path uses a strict select (no include) and the [recipientId, isEmailed]
 * composite index; write path is a single bulk updateMany — never a loop.
 */
export async function runDigest(
  preference: "DAILY" | "WEEKLY"
): Promise<{ emailedUsers: number; flaggedNotifications: number }> {
  const users = await prisma.user.findMany({
    where: {
      digestPreference: preference,
      isDeleted: false,
      notificationsReceived: { some: { isEmailed: false } },
    },
    select: {
      id: true,
      name: true,
      email: true,
      notificationsReceived: {
        where: { isEmailed: false },
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          targetType: true,
          targetId: true,
          actorId: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (users.length === 0) return { emailedUsers: 0, flaggedNotifications: 0 };

  const resend = new Resend(process.env.RESEND_API_KEY);
  const appUrl = getAppUrl();
  const processedIds: string[] = [];
  let sentCount = 0;

  for (const user of users) {
    const groups = groupByModule(user.notificationsReceived);
    const html = generateDigestHtml(user.name ?? "Scholar", groups, {
      siteUrl: appUrl,
      weeklyUrl: `${appUrl}/api/notifications/update-preference?userId=${user.id}&pref=WEEKLY&token=${signPreferenceToken(user.id, "WEEKLY")}`,
      neverUrl: `${appUrl}/api/notifications/update-preference?userId=${user.id}&pref=NEVER&token=${signPreferenceToken(user.id, "NEVER")}`,
    });

    const { error } = await resend.emails.send({
      from: "ScholarBase <notifications@scholarbase.app>",
      to: [user.email],
      subject:
        preference === "DAILY"
          ? "Your daily ScholarBase digest"
          : "Your weekly ScholarBase digest",
      html,
    });

    // Only flag notifications whose email was actually accepted by Resend.
    if (!error) {
      sentCount += 1;
      for (const n of user.notificationsReceived) processedIds.push(n.id);
    }
  }

  // Single bulk write. No per-notification loop updates.
  if (processedIds.length > 0) {
    await prisma.notification.updateMany({
      where: { id: { in: processedIds } },
      data: { isEmailed: true },
    });
  }

  return { emailedUsers: sentCount, flaggedNotifications: processedIds.length };
}
