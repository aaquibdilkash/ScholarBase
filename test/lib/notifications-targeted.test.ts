/**
 * Targeted notification enqueue must be awaited.
 *
 * The journal-review and supervisor-recommendation author notices are the last
 * statement before the Server Action returns. With a fire-and-forget publish,
 * the serverless function freezes as soon as the response is sent and the
 * in-flight QStash request is dropped, so the recipient never sees the
 * notification. These tests pin the "enqueue has settled before the helper
 * resolves" contract (and that a failed enqueue stays non-fatal).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { enqueue } = vi.hoisted(() => ({ enqueue: vi.fn() }));

vi.mock("@/lib/qstash", () => ({
  queueNotification: (payload: unknown) => enqueue(payload),
}));

import { notifyUserById } from "@/lib/notifications";

const params = {
  recipientId: "u-journal-author",
  actorId: "u-reviewer",
  type: "journal-review-created",
  targetType: "JournalReview",
  targetId: "journal-1/review-1",
  title: "Reviewer added a review to your journal",
  body: "Nature — 5/5",
};

beforeEach(() => {
  enqueue.mockReset();
  enqueue.mockResolvedValue(undefined);
});

describe("notifyUserById", () => {
  it("resolves only after the enqueue promise settles", async () => {
    let release!: () => void;
    enqueue.mockImplementationOnce(
      () => new Promise<void>((resolve) => { release = resolve; }),
    );

    let settled = false;
    const pending = notifyUserById(params).then(() => { settled = true; });

    // Let the enqueue call start, but not finish.
    await Promise.resolve();
    await Promise.resolve();
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(settled).toBe(false);

    release();
    await pending;
    expect(settled).toBe(true);
  });

  it("still resolves when the enqueue rejects, so the write is not rolled back", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    enqueue.mockRejectedValueOnce(new Error("QStash down"));

    await expect(notifyUserById(params)).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("skips the enqueue entirely for a self-notification", async () => {
    await notifyUserById({ ...params, recipientId: params.actorId });
    expect(enqueue).not.toHaveBeenCalled();
  });
});
