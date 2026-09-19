import { Redis } from "@upstash/redis";
import { ACTIVITY_STALE_MS } from "@/lib/push-constants";

/**
 * ⚡ ZERO-COMPUTE PUSH GATING (Rule 2)
 *
 * Tracks whether a user currently has a ScholarBase tab *visible* anywhere in
 * the app. Message pushes are suppressed for active users so the OS
 * notification only fires when the recipient actually stepped away (switched
 * tab, minimised the window, or closed the browser).
 *
 * Storage: a single Redis hash per user — `{ [tabId]: lastHeartbeatMs }`.
 *  - heartbeat / tab becomes visible ....... HSET      (1 command)
 *  - tab hidden or closed (sendBeacon) ..... HDEL      (1 command)
 *  - gate check before each push ........... HGETALL   (1 command)
 *
 * Per-tab fields (rather than a single flag) keep multi-tab sessions correct:
 * hiding tab A cannot clear the presence of tab B, and a tab that dies without
 * firing its beacon simply ages out of the staleness window and is pruned on
 * the next read.
 *
 * The gate FAILS OPEN: any Redis error means "not active", so a degraded cache
 * can never silently swallow a message notification.
 */

const ACTIVITY_KEY_PREFIX = "sb:push:active:";

function activityKey(userId: string): string {
  return `${ACTIVITY_KEY_PREFIX}${userId}`;
}

let cachedRedis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (cachedRedis !== undefined) return cachedRedis;

  try {
    cachedRedis = Redis.fromEnv();
  } catch (error) {
    console.warn(
      "[PushActivity] Redis unavailable — push gating disabled (fail-open).",
      error,
    );
    cachedRedis = null;
  }

  return cachedRedis;
}

/** Records that `tabId` is open and visible for this user. */
export async function markTabActive(userId: string, tabId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    const key = activityKey(userId);
    await redis.hset(key, { [tabId]: Date.now() });
    // Safety net: even if a tab dies without a pagehide beacon, the whole key
    // self-destructs once every field has gone stale.
    await redis.expire(key, Math.ceil((ACTIVITY_STALE_MS * 2) / 1000));
  } catch (error) {
    console.warn("[PushActivity] markTabActive failed.", error);
  }
}

/** Clears presence for a single tab (hidden / closed). */
export async function clearTabActive(userId: string, tabId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.hdel(activityKey(userId), tabId);
  } catch (error) {
    console.warn("[PushActivity] clearTabActive failed.", error);
  }
}

/**
 * True when the user has at least one tab whose heartbeat is still fresh.
 * Returns `false` on any failure so the push is still delivered.
 */
export async function isUserActive(userId: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;

  try {
    const key = activityKey(userId);
    const entries = await redis.hgetall<Record<string, string>>(key);
    if (!entries) return false;

    const cutoff = Date.now() - ACTIVITY_STALE_MS;
    const staleTabs: string[] = [];
    let active = false;

    for (const [tabId, rawTimestamp] of Object.entries(entries)) {
      const timestamp = Number(rawTimestamp);
      if (!Number.isFinite(timestamp) || timestamp < cutoff) {
        staleTabs.push(tabId);
      } else {
        active = true;
      }
    }

    if (staleTabs.length > 0) {
      await redis.hdel(key, ...staleTabs).catch(() => {});
    }

    return active;
  } catch (error) {
    console.warn(
      "[PushActivity] isUserActive failed, treating user as inactive (fail-open).",
      error,
    );
    return false;
  }
}