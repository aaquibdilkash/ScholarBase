/**
 * P0-2 — the digest chunk worker.
 *
 * Before this, `runDigest` fetched EVERY opted-in subscriber and emailed them one
 * at a time inside a single invocation. That is the thing that breaks: N
 * sequential Resend round-trips against a ~10s serverless timeout, so it died at
 * roughly 25 subscribers and silently dropped everyone after the cut-off while
 * leaving their notifications unflagged.
 *
 * Pinned here:
 *   1. ONE batched API call per chunk, not N sends.
 *   2. The cursor resumes strictly after the last id — nobody skipped, nobody
 *      emailed twice.
 *   3. `permissive` validation, so one bad address does not cost 99 other
 *      people their digest (strict mode rejects the whole batch).
 *   4. A whole-request failure does NOT advance the cursor, and the retry
 *      carries the SAME idempotency key.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";
import {
  digestChunkIdempotencyKey,
  sendDigestChunk,
} from "@/lib/emails/digest";
import { seedReplacing, userRow } from "../helpers/action-harness";

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

const queueNotification =
  vi.fn(async (_payload: Record<string, unknown>) => {});
vi.mock("@/lib/qstash", () => ({
  queueNotification: (payload: Record<string, unknown>) =>
    queueNotification(payload),
}));

const batchSend = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    batch = { send: (...args: unknown[]) => batchSend(...(args as [])) };
  },
}));
vi.mock("@/lib/emails/generateDigestHtml", () => ({
  generateDigestHtml: () => "<html>digest</html>",
}));
vi.mock("@/lib/notification-links", () => ({
  getModuleLabel: () => "Feed",
  getNotificationLink: () => "/feed",
}));

const NOTIFICATION = {
  type: "NEW_COMMENT",
  title: "Someone commented",
  body: "Nice work",
  targetType: "post",
  targetId: "p1",
  actorId: "u-other",
};

/**
 * Seeds `count` subscribers, each with one unflagged notification.
 *
 * The notification is embedded ON the user row as well as stored in the
 * notification model. The fake does not resolve relations by foreign key, so the
 * digest's selection predicate (`notificationsReceived: { some: … }`) and its
 * nested `select` both read the array off the user.
 */
const seedSubscribers = (count: number, pref = "DAILY", prefix = "u") => {
  for (let i = 0; i < count; i += 1) {
    // The prefix matters: `seedReplacing` drops any existing row with the same
    // id, so two cadences seeded from the same counter would overwrite each
    // other and the "only this cadence" assertion would read zero.
    const id = `${prefix}${String(i).padStart(3, "0")}`;
    const notification = {
      id: `n-${id}-1`,
      recipientId: id,
      isEmailed: false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      ...NOTIFICATION,
    };
    seedReplacing(
      "user",
      userRow(id, {
        digestPreference: pref,
        email: `${id}@uni.edu`,
        notificationsReceived: [notification],
      }),
    );
    fakeDb.seed("notification", notification);
  }
};

const flagState = (id: string) =>
  fakeDb.rows("notification").find((n) => n.id === id);

const recipientsOfCall = (index: number) =>
  (batchSend.mock.calls[index][0] as { to: string[] }[]).map((e) => e.to[0]);

beforeEach(() => {
  resetFakeDb();
  queueNotification.mockClear();
  batchSend.mockReset();
  batchSend.mockResolvedValue({ data: { data: [] }, error: null });
});

describe("digestChunkIdempotencyKey", () => {
  it("is stable for the same (preference, cursor)", () => {
    expect(digestChunkIdempotencyKey("DAILY", "u010")).toBe(
      digestChunkIdempotencyKey("DAILY", "u010"),
    );
  });

  it("differs across preferences and cursors", () => {
    // Otherwise a retried DAILY chunk would dedupe against an unrelated WEEKLY
    // one, silently dropping a week's digest.
    expect(digestChunkIdempotencyKey("DAILY", "u010")).not.toBe(
      digestChunkIdempotencyKey("WEEKLY", "u010"),
    );
    expect(digestChunkIdempotencyKey("DAILY", "u010")).not.toBe(
      digestChunkIdempotencyKey("DAILY", "u020"),
    );
  });

  it("names the first chunk explicitly", () => {
    expect(digestChunkIdempotencyKey("DAILY")).toBe("digest-DAILY-start");
  });
});

describe("sendDigestChunk", () => {
  it("sends ONE batched call for many users", async () => {
    seedSubscribers(5);
    await sendDigestChunk("DAILY");
    // The regression this change exists for: five users used to be five
    // sequential `emails.send` round-trips.
    expect(batchSend).toHaveBeenCalledTimes(1);
    expect(batchSend.mock.calls[0][0]).toHaveLength(5);
  });

  it("always requests permissive validation and an idempotency key", async () => {
    seedSubscribers(3);
    await sendDigestChunk("DAILY", "u000");
    const options = batchSend.mock.calls[0][1] as Record<string, unknown>;
    expect(options.batchValidation).toBe("permissive");
    expect(options.idempotencyKey).toBe("digest-DAILY-u000");
  });

  it("does nothing, and sends nothing, when there is no backlog", async () => {
    const result = await sendDigestChunk("DAILY");
    expect(result).toMatchObject({ success: true, exhausted: true, emailedUsers: 0 });
    expect(batchSend).not.toHaveBeenCalled();
  });

  it("only selects users on the requested cadence", async () => {
    seedSubscribers(2, "DAILY", "d");
    seedSubscribers(3, "WEEKLY", "w");
    const result = await sendDigestChunk("DAILY");
    expect(result.emailedUsers).toBe(2);
  });

  it("flags the notifications of users it emailed", async () => {
    seedSubscribers(3);
    await sendDigestChunk("DAILY");
    for (const id of ["u000", "u001", "u002"]) {
      expect(flagState(`n-${id}-1`)?.isEmailed).toBe(true);
    }
  });

  it("leaves a rejected user unflagged so their digest rolls into the next run", async () => {
    seedSubscribers(3);
    batchSend.mockResolvedValue({
      data: {
        data: [{ id: "1" }, { id: "2" }],
        errors: [{ index: 1, message: "invalid address" }],
      },
      error: null,
    });

    const result = await sendDigestChunk("DAILY");

    expect(result.emailedUsers).toBe(2);
    expect(result.failedUsers).toBe(1);
    // If the failed user's notification were flagged, their unread activity
    // would be dropped forever.
    expect(flagState("n-u001-1")?.isEmailed).toBe(false);
    expect(flagState("n-u000-1")?.isEmailed).toBe(true);
    expect(flagState("n-u002-1")?.isEmailed).toBe(true);
  });

  it("does NOT advance the cursor when the whole request fails", async () => {
    seedSubscribers(2);
    batchSend.mockResolvedValue({ data: null, error: { message: "quota" } });

    const result = await sendDigestChunk("DAILY");

    // Quota/auth/network failure must be retryable and must not mark these
    // notifications delivered.
    expect(result.success).toBe(false);
    expect(result.flaggedNotifications).toBe(0);
    expect(flagState("n-u000-1")?.isEmailed).toBe(false);
    expect(queueNotification).not.toHaveBeenCalled();
  });

  it("enqueues a continuation carrying the LAST id when the chunk is full", async () => {
    // A full chunk is the only evidence that more may remain.
    seedSubscribers(100);
    const result = await sendDigestChunk("DAILY");
    expect(result.exhausted).toBe(false);
    expect(queueNotification).toHaveBeenCalledWith({
      mode: "DIGEST",
      preference: "DAILY",
      afterUserId: "u099",
    });
  });

  it("does NOT enqueue a pointless continuation for a short chunk", async () => {
    seedSubscribers(3);
    const result = await sendDigestChunk("DAILY");
    expect(result.exhausted).toBe(true);
    // Otherwise every run spends a message discovering there is nothing left.
    expect(queueNotification).not.toHaveBeenCalled();
  });

  it("resumes strictly after the cursor", async () => {
    seedSubscribers(5);
    await sendDigestChunk("DAILY", "u002");
    // u000..u002 are behind the cursor; only u003 and u004 remain.
    expect(recipientsOfCall(0)).toEqual(["u003@uni.edu", "u004@uni.edu"]);
  });

  it("covers every subscriber exactly once across a full drain", async () => {
    seedSubscribers(150);
    const emailed = new Set<string>();
    let cursor: string | undefined;

    for (let i = 0; i < 5; i += 1) {
      batchSend.mockResolvedValue({ data: { data: [] }, error: null });
      const result = await sendDigestChunk("DAILY", cursor);
      for (const address of recipientsOfCall(batchSend.mock.calls.length - 1)) {
        expect(emailed.has(address), `${address} emailed twice`).toBe(false);
        emailed.add(address);
      }
      if (result.exhausted) break;
      const last = queueNotification.mock.calls.at(-1)![0];
      cursor = last.afterUserId as string;
    }

    expect(emailed.size).toBe(150);
  });
});
