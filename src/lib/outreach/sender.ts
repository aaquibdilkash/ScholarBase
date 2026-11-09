import { randomBytes } from "node:crypto";
import { Redis } from "@upstash/redis";

import prisma from "@/lib/db";
import { sendScholarOutreachEmail } from "@/lib/email";
import {
  SCHOLAR_OUTREACH_VARIANTS,
  type OutreachVariant,
} from "@/lib/emails/scholarInvite";
import { normalizeEmail } from "@/lib/email-normalizer";
import { checkRateLimit, RATE_LIMIT_ERROR } from "@/lib/rate-limit";

/**
 * Shared outreach delivery.
 *
 * The admin actions and the scheduled worker both reach this module, so the
 * "may this contact be emailed" rules, the template plumbing, and the
 * rate-limit accounting can never drift apart.
 */

export type OutreachSendCandidate = {
  id: string;
  name: string;
  email: string;
  status: string;
  sendCount: number;
  userId?: string | null;
};

export type OutreachDeliveryResult =
  | {
      success: true;
      data: { id: string; status: string; emailSentAt: Date | null };
    }
  | { success: false; error: string };

/**
 * Why this contact must not receive an email right now, or null when it can.
 *
 * Precedence: an opt-out always wins, then a contact that is already a member
 * of the platform, then the resend rule. "Already a member" matters because a
 * contact who signed up should get product email, not cold outreach.
 */
export function outreachSkipReason(
  contact: OutreachSendCandidate,
  options: { resend: boolean; optedOut: boolean; member?: boolean },
): string | null {
  if (contact.status === "UNSUBSCRIBED" || options.optedOut) {
    return "This email has opted out of outreach emails.";
  }

  if (options.member) {
    return "This email already belongs to a ScholarBase member.";
  }

  if (contact.status === "OUTREACHED" && !options.resend) {
    return "This contact has already been emailed.";
  }

  return null;
}

/** Send one prepared template and record the send on the contact. */
export async function deliverOutreachEmail(
  contact: OutreachSendCandidate,
  variant: OutreachVariant,
): Promise<OutreachDeliveryResult> {
  const result = await sendScholarOutreachEmail({
    recipientEmail: contact.email,
    scholarName: contact.name,
    subject: variant.subject,
    // `greeting` is prepended to the recipient name by the template, and the
    // signature is rendered separately — never repeat either in the body.
    greeting: variant.greeting,
    headline: variant.headline,
    body: variant.body,
    ctaLabel: variant.ctaLabel,
    inviteUrl: `${(process.env.NEXT_PUBLIC_SITE_URL || "https://scholarbase.app").replace(/\/+$/, "")}`,
    // Outreach goes out as the team, never as the signed-in admin.
    senderName: "Outreach Team",
    senderRole: "ScholarBase",
    footerText: variant.footerText,
  });

  if (!result.success) {
    return { success: false, error: result.error || "Failed to send email." };
  }

  // Mark the contact as outreached.
  const now = new Date();
  const updated = await prisma.outreach.update({
    where: { id: contact.id },
    data: {
      status: "OUTREACHED",
      outreachedAt: now,
      emailSentAt: now,
      sendCount: { increment: 1 },
    },
    select: {
      id: true,
      status: true,
      emailSentAt: true,
    },
  });

  return {
    success: true,
    data: {
      id: updated.id,
      status: updated.status,
      emailSentAt: updated.emailSentAt,
    },
  };
}

/**
 * Each email costs one slot in the hourly window. A batch must not silently
 * spend a single request against a 30/hour limit, so the sender claims a slot
 * per delivery.
 */
export async function claimOutreachSendSlot(
  adminId: string,
): Promise<{ allowed: true } | { allowed: false; error: string }> {
  const rateLimit = await checkRateLimit({
    namespace: "admin:outreach:send",
    key: adminId,
    limit: 30,
    window: "1 h",
    onDegraded: "closed",
  });

  if (rateLimit.degraded) {
    return {
      allowed: false,
      error: "Request protection is temporarily unavailable. Please try again later.",
    };
  }

  if (!rateLimit.allowed) {
    return { allowed: false, error: RATE_LIMIT_ERROR };
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Scheduled worker
// ---------------------------------------------------------------------------

const LOCK_KEY = "cron:outreach:lock";
const LOCK_TTL_MS = 120_000;
const MAX_CANDIDATES = 50;
const COUNTER_TTL_SECONDS = 2 * 24 * 60 * 60;
const DOMAIN_TTL_SECONDS = 24 * 60 * 60;

/**
 * Sending policy.
 *
 * These are code constants on purpose: they are not secrets, they are the same
 * in every deployment, and they change at most a few times a year. Keeping them
 * out of the environment removes a whole class of misconfiguration (a typo in a
 * dashboard silently disabling the caps). Change the value here and redeploy
 * when the policy changes.
 *
 * The defaults are deliberately conservative: ~17 sends/day expected at a 0.4
 * probability over a 14-hour window, hard-capped at 20.
 */
const DAILY_LIMIT = 20;
const SEND_PROBABILITY = 0.4;
const WINDOW_START_UTC = 7;
const WINDOW_END_UTC = 21;
const MIN_AGE_HOURS = 24;
const DOMAIN_DAILY_LIMIT = 1;

/**
 * The subset of Upstash Redis this worker uses. Declaring it locally keeps the
 * worker injectable in the unit tier — a real `Redis` instance satisfies it.
 */
export interface OutreachRedis {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    options?: { nx?: boolean; px?: number; ex?: number },
  ): Promise<"OK" | null>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  del(key: string): Promise<number>;
}

export type OutreachCronConfig = {
  windowStartUtc: number;
  windowEndUtc: number;
  probability: number;
  dailyLimit: number;
  domainDailyLimit: number;
  minAgeHours: number;
  maxCandidates: number;
};

export type OutreachCronReason =
  | "outside_window"
  | "probability_skip"
  | "redis_unavailable"
  | "locked"
  | "daily_limit_reached"
  | "no_candidates"
  | "no_eligible_contact"
  | "domain_capped"
  | "would_send"
  | "send_failed"
  | "error";

export type OutreachCronResult = {
  success: boolean;
  sent: number;
  dryRun: boolean;
  pending: number;
  dailySent: number;
  reason?: OutreachCronReason;
  contactId?: string;
  template?: string;
  error?: string;
};

export type OutreachCronOptions = {
  now?: Date;
  random?: () => number;
  dryRun?: boolean;
  /** How many emails this invocation may deliver. The route caps it at 3. */
  limit?: number;
  /** Injected in tests; production uses `Redis.fromEnv()`. */
  redis?: OutreachRedis | null;
  config?: Partial<OutreachCronConfig>;
};

/**
 * The worker's effective policy. `overrides` exists so tests can shrink the
 * guards; production always uses the module constants above.
 */
export function readOutreachCronConfig(
  overrides: Partial<OutreachCronConfig> = {},
): OutreachCronConfig {
  return {
    windowStartUtc: WINDOW_START_UTC,
    windowEndUtc: WINDOW_END_UTC,
    probability: SEND_PROBABILITY,
    dailyLimit: DAILY_LIMIT,
    domainDailyLimit: DOMAIN_DAILY_LIMIT,
    minAgeHours: MIN_AGE_HOURS,
    maxCandidates: MAX_CANDIDATES,
    ...overrides,
  };
}

function isWithinWindow(hour: number, start: number, end: number): boolean {
  const startHour = ((start % 24) + 24) % 24;
  const endHour = ((end % 24) + 24) % 24;

  if (startHour === endHour) return true;
  if (startHour < endHour) return hour >= startHour && hour < endHour;
  // A window that crosses midnight (e.g. 21 -> 5).
  return hour >= startHour || hour < endHour;
}

function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function emailDomain(email: string): string | null {
  const normalized = normalizeEmail(email);
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === normalized.length - 1) return null;

  return normalized.slice(atIndex + 1);
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap]!, copy[index]!];
  }

  return copy;
}

async function releaseLock(redis: OutreachRedis, token: string): Promise<void> {
  try {
    const current = await redis.get(LOCK_KEY);
    if (current === token) {
      await redis.del(LOCK_KEY);
    }
  } catch (error) {
    // The lock expires on its own; a failed release must not fail the run.
    console.warn("[outreach] could not release cron lock:", error);
  }
}

/**
 * Reserve one slot for a recipient domain for the current day. This is what
 * stops a batch of addresses from the same university looking like a blast.
 */
async function claimDomainSlot(
  redis: OutreachRedis,
  key: string,
  limit: number,
  dryRun: boolean,
): Promise<boolean> {
  // A limit of 0 or less disables the cap; the daily counter still applies.
  if (limit <= 0) return true;

  const current = Number((await redis.get(key)) ?? 0);
  if (current >= limit) return false;
  if (dryRun) return true;

  const next = await redis.incr(key);
  if (next === 1) {
    await redis.expire(key, DOMAIN_TTL_SECONDS);
  }

  return next <= limit;
}

/**
 * The scheduled outreach send.
 *
 * Timing is randomized by the *caller's schedule plus a probability roll*, not
 * by a long-running `sleep`: the task runs every 20 minutes, and each run sends
 * at most `limit` emails (normally 1) only when the roll passes. That produces
 * a human-looking gap distribution without pinning a container awake.
 *
 * Guards, in order:
 *  1. UTC sending window.
 *  2. Probability roll (skipped for a dry run).
 *  3. Redis lock so two overlapping runs cannot double-send.
 *  4. Daily cap.
 *  5. PENDING-only, never-contacted, non-member, non-opted-out candidates,
 *     at least `MIN_AGE_HOURS` old.
 *  6. One email per recipient domain per day.
 *  7. Template rotation so consecutive sends never repeat copy.
 */
export async function runOutreachCron(
  options: OutreachCronOptions = {},
): Promise<OutreachCronResult> {
  const now = options.now ?? new Date();
  const random = options.random ?? Math.random;
  const dryRun = options.dryRun ?? false;
  const config = readOutreachCronConfig(options.config);
  const limit = Math.max(
    1,
    Math.min(config.maxCandidates, Math.trunc(options.limit ?? 1)),
  );

  const base = { dryRun, pending: 0, dailySent: 0 } as const;

  if (!isWithinWindow(now.getUTCHours(), config.windowStartUtc, config.windowEndUtc)) {
    return { ...base, success: true, sent: 0, reason: "outside_window" };
  }

  // A dry run deliberately skips the roll so the selection can be verified.
  if (!dryRun && random() >= config.probability) {
    return { ...base, success: true, sent: 0, reason: "probability_skip" };
  }

  let redis: OutreachRedis | null;
  try {
    redis =
      options.redis === null
        ? null
        : (options.redis ?? (Redis.fromEnv() as unknown as OutreachRedis));
  } catch (error) {
    console.warn("[outreach] Redis unavailable, skipping run:", error);
    return { ...base, success: true, sent: 0, reason: "redis_unavailable" };
  }

  if (!redis) {
    return { ...base, success: true, sent: 0, reason: "redis_unavailable" };
  }

  const day = dayKey(now);
  const sentKey = `cron:outreach:sent:${day}`;
  const rotationKey = `cron:outreach:rotation:${day}`;

  let sent = 0;
  let dailySent = 0;
  let lockToken: string | null = null;
  let pending = 0;

  try {
    dailySent = Number((await redis.get(sentKey)) ?? 0);
    if (dailySent >= config.dailyLimit) {
      return {
        ...base,
        success: true,
        sent: 0,
        dailySent,
        reason: "daily_limit_reached",
      };
    }

    if (!dryRun) {
      lockToken = randomBytes(16).toString("hex");
      const acquired = await redis.set(LOCK_KEY, lockToken, {
        nx: true,
        px: LOCK_TTL_MS,
      });

      if (acquired !== "OK") {
        return { ...base, success: true, sent: 0, dailySent, reason: "locked" };
      }
    }

    // Never send past today's cap, even when the caller asks for more.
    const sendTarget = Math.max(0, Math.min(limit, config.dailyLimit - dailySent));
    if (sendTarget === 0) {
      return {
        ...base,
        success: true,
        sent: 0,
        dailySent,
        reason: "daily_limit_reached",
      };
    }

    const cutoff = new Date(
      now.getTime() - Math.max(0, config.minAgeHours) * 60 * 60 * 1000,
    );

    // Oldest first, which the `[status, createdAt]` index covers. Never
    // `ORDER BY random()` — that sorts the whole table on every run.
    const candidates = await prisma.outreach.findMany({
      where: {
        status: "PENDING",
        sendCount: 0,
        userId: null,
        createdAt: { lte: cutoff },
      },
      orderBy: { createdAt: "asc" },
      take: config.maxCandidates,
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        sendCount: true,
        userId: true,
      },
    });

    pending = candidates.length;
    if (pending === 0) {
      return { ...base, success: true, sent: 0, dailySent, reason: "no_candidates" };
    }

    const emails = candidates.map((candidate) => normalizeEmail(candidate.email));

    const [unsubscribedRows, memberRows] = await Promise.all([
      prisma.outreachEmailUnsubscribe.findMany({
        where: { email: { in: emails } },
        select: { email: true },
      }),
      prisma.user.findMany({
        where: { email: { in: emails }, isDeleted: false },
        select: { email: true },
      }),
    ]);

    const optedOut = new Set(unsubscribedRows.map((row) => row.email));
    const members = new Set(memberRows.map((row) => row.email));

    let domainCapped = 0;
    let lastContactId: string | undefined;
    let lastTemplate: string | undefined;

    for (const candidate of shuffle(candidates, random)) {
      if (sent >= sendTarget) break;

      const email = normalizeEmail(candidate.email);
      if (optedOut.has(email)) continue;
      if (candidate.userId || members.has(email)) continue;

      const domain = emailDomain(candidate.email);
      if (!domain) continue;

      const domainKey = `cron:outreach:domain:${domain}:${day}`;
      const domainAllowed = await claimDomainSlot(
        redis,
        domainKey,
        config.domainDailyLimit,
        dryRun,
      );

      if (!domainAllowed) {
        domainCapped += 1;
        continue;
      }

      // Rotate the shared library so consecutive sends always differ.
      const rotation = dryRun
        ? Number((await redis.get(rotationKey)) ?? 0) + 1
        : await redis.incr(rotationKey);

      if (!dryRun && rotation === 1) {
        await redis.expire(rotationKey, COUNTER_TTL_SECONDS);
      }

      const variant =
        SCHOLAR_OUTREACH_VARIANTS[
          (rotation - 1) % SCHOLAR_OUTREACH_VARIANTS.length
        ] ?? SCHOLAR_OUTREACH_VARIANTS[0]!;

      lastContactId = candidate.id;
      lastTemplate = variant.subject;

      if (dryRun) {
        return {
          ...base,
          success: true,
          sent: 0,
          pending,
          dailySent,
          reason: "would_send",
          contactId: candidate.id,
          template: variant.subject,
        };
      }

      const delivery = await deliverOutreachEmail(candidate, variant);

      if (!delivery.success) {
        // Free the domain slot so a later run can retry this address.
        if (config.domainDailyLimit <= 1) {
          await redis.del(domainKey).catch(() => undefined);
        }

        return {
          ...base,
          success: false,
          sent,
          pending,
          dailySent,
          reason: "send_failed",
          contactId: candidate.id,
          error: delivery.error,
        };
      }

      sent += 1;
      dailySent = await redis.incr(sentKey);
      if (dailySent === 1) {
        await redis.expire(sentKey, COUNTER_TTL_SECONDS);
      }
    }

    return {
      ...base,
      success: true,
      sent,
      pending,
      dailySent,
      contactId: sent > 0 ? lastContactId : undefined,
      template: sent > 0 ? lastTemplate : undefined,
      reason:
        sent > 0
          ? undefined
          : domainCapped > 0
            ? "domain_capped"
            : "no_eligible_contact",
    };
  } catch (error) {
    console.error("[outreach] scheduled run failed:", error);
    return {
      ...base,
      success: false,
      sent,
      pending,
      dailySent,
      reason: "error",
      error: "Outreach run failed.",
    };
  } finally {
    if (lockToken) {
      await releaseLock(redis, lockToken);
    }
  }
}
