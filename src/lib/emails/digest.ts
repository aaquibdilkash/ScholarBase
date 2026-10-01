// src/lib/emails/digest.ts
// Shared logic for the daily/weekly notification digest cron jobs.
import { createHmac } from "crypto";
import { Resend } from "resend";
import prisma from "@/lib/db";
import { getModuleLabel, getNotificationLink } from "@/lib/notification-links";
import { queueNotification } from "@/lib/qstash";
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
 * One batch of digest emails. 100 is Resend's per-batch maximum, and because a
 * batch is ONE API request this is also what keeps a chunk far inside a
 * serverless timeout — the old code made N sequential round-trips and died at
 * roughly 25 subscribers.
 */
const DIGEST_CHUNK_SIZE = 100;

/** Rows per user in the chunk select, to keep the payload bounded. */
const MAX_NOTIFICATIONS_PER_DIGEST = 50;

export type DigestPreference = "DAILY" | "WEEKLY";

export type DigestChunkResult = {
  success: boolean;
  /** Whether the backlog is drained and no further chunk is needed. */
  exhausted: boolean;
  emailedUsers: number;
  flaggedNotifications: number;
  /** Users Resend rejected, who therefore stay unflagged and retry next run. */
  failedUsers: number;
};

/**
 * Deterministic idempotency key for a chunk.
 *
 * QStash retries 3x, so the same logical chunk can be delivered more than once.
 * The chunk is fully determined by `(preference, afterUserId)`, so the same
 * inputs always produce the same key and Resend collapses the duplicate —
 * rather than those users receiving the digest twice.
 *
 * The cursor advances ONLY after Resend accepts, so retrying a partially
 * completed run recomputes the same key for the same chunk.
 */
export function digestChunkIdempotencyKey(
  preference: string,
  afterUserId?: string,
): string {
  return `digest-${preference}-${afterUserId ?? "start"}`;
}


/**
 * Processes ONE chunk of the digest, then re-enqueues the tail.
 *
 * Split from the cron on purpose: the cron used to handle the whole population
 * in a single invocation, which is precisely what timed out. Each invocation
 * now handles at most `DIGEST_CHUNK_SIZE` users in ONE API call and hands the
 * remainder to QStash, so the work drains across as many invocations as needed.
 */
export async function sendDigestChunk(
  preference: DigestPreference,
  afterUserId?: string,
): Promise<DigestChunkResult> {
  const users = await prisma.user.findMany({
    where: {
      digestPreference: preference,
      isDeleted: false,
      // Resume strictly after the cursor. `id` is a stable total order, so no
      // user is skipped or visited twice across chunk boundaries.
      ...(afterUserId ? { id: { gt: afterUserId } } : {}),
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
        take: MAX_NOTIFICATIONS_PER_DIGEST,
      },
    },
    orderBy: { id: "asc" },
    take: DIGEST_CHUNK_SIZE,
  });

  if (users.length === 0) {
    return {
      success: true,
      exhausted: true,
      emailedUsers: 0,
      flaggedNotifications: 0,
      failedUsers: 0,
    };
  }

  const appUrl = getAppUrl();
  const emails = users.map((user) => ({
    from: "ScholarBase <notifications@scholarbase.app>",
    to: [user.email],
    subject:
      preference === "DAILY"
        ? "Your daily ScholarBase digest"
        : "Your weekly ScholarBase digest",
    html: generateDigestHtml(
      user.name ?? "Scholar",
      groupByModule(user.notificationsReceived),
      {
        siteUrl: appUrl,
        weeklyUrl: `${appUrl}/api/notifications/update-preference?userId=${user.id}&pref=WEEKLY&token=${signPreferenceToken(user.id, "WEEKLY")}`,
        neverUrl: `${appUrl}/api/notifications/update-preference?userId=${user.id}&pref=NEVER&token=${signPreferenceToken(user.id, "NEVER")}`,
      },
    ),
  }));

  const resend = new Resend(
    process.env.RESEND_API_KEY || "re_dummy_key_for_build",
  );

  const { data, error } = await resend.batch.send(emails, {
    // `permissive` is REQUIRED here, not an optimisation. Under the default
    // `strict` validation a single malformed address rejects the WHOLE batch,
    // silently dropping 99 other people's digests. It is also what returns the
    // per-index errors used below to decide who was actually emailed.
    batchValidation: "permissive",
    idempotencyKey: digestChunkIdempotencyKey(preference, afterUserId),
  });

  // A whole-request failure (quota, auth, network) must NOT advance the cursor.
  // Returning `success: false` makes QStash retry the identical chunk, and the
  // idempotency key means that retry cannot double-send.
  if (error) {
    console.error("[digest] batch send failed:", error);
    return {
      success: false,
      exhausted: false,
      emailedUsers: 0,
      flaggedNotifications: 0,
      failedUsers: users.length,
    };
  }

  // Permissive mode reports failures as `errors[].index`; anything not named
  // there was accepted and queued for delivery.
  const failedIndexes = new Set(
    (data?.errors ?? []).map((entry) => entry.index),
  );
  const emailedUsers = users.filter((_, i) => !failedIndexes.has(i));
  const failedUsers = users.filter((_, i) => failedIndexes.has(i));

  // Flag ONLY what was accepted. A rejected user stays unflagged, so their
  // notifications roll into the next run instead of being silently lost.
  const processedIds = emailedUsers.flatMap((user) =>
    user.notificationsReceived.map((n) => n.id),
  );

  // Single bulk write. Never a loop.
  if (processedIds.length > 0) {
    await prisma.notification.updateMany({
      where: { id: { in: processedIds } },
      data: { isEmailed: true },
    });
  }

  // A full chunk means there may be more; a short chunk means the backlog is
  // drained. Enqueueing only on a full chunk avoids a pointless extra message
  // just to discover there is nothing left.
  const exhausted = users.length < DIGEST_CHUNK_SIZE;

  if (!exhausted) {
    const lastId = users[users.length - 1].id;
    void queueNotification({
      mode: "DIGEST",
      preference,
      afterUserId: lastId,
    }).catch((enqueueError) => {
      console.error("[digest] continuation enqueue failed:", enqueueError);
    });
  }

  return {
    success: true,
    exhausted,
    emailedUsers: emailedUsers.length,
    flaggedNotifications: processedIds.length,
    failedUsers: failedUsers.length,
  };
}

/**
 * Kicks off a digest run by enqueueing the FIRST chunk.
 *
 * The cron route calls this instead of doing the work itself. QStash may deliver
 * a kickoff more than once, but `queueNotification` deduplicates DIGEST
 * publishes by chunk, so a repeat delivery is a queue-level no-op rather than a
 * duplicate send.
 */
export async function kickoffDigest(
  preference: DigestPreference,
): Promise<void> {
  await queueNotification({ mode: "DIGEST", preference });
}

/**
 * @deprecated The old whole-population-in-one-invocation path, which is what
 * timed out. Now a single chunk. Prefer {@link kickoffDigest} from a cron route
 * and {@link sendDigestChunk} from the worker.
 */
export async function runDigest(
  preference: DigestPreference,
): Promise<{ emailedUsers: number; flaggedNotifications: number }> {
  const result = await sendDigestChunk(preference);
  return {
    emailedUsers: result.emailedUsers,
    flaggedNotifications: result.flaggedNotifications,
  };
}