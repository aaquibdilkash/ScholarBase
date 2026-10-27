/**
 * Realtime UPDATE folding for the message thread.
 *
 * Realtime delivers the edited/tombstoned row, but a reply carries a COPY of
 * the quoted body. Updating only the source row left every quote stale until
 * a refresh — the reported "edited message updates, but the tagged message
 * does not". `applyMessageUpdate` now reconciles both.
 */
import { describe, expect, it } from "vitest";

import { applyMessageUpdate } from "@/components/messages/thread-update";
import type { SentMessage } from "@/components/messages/MessageInputForm";

const sender = { id: "u-1", name: "Author", handle: "author", avatarUrl: null };

const base = (id: string, body: string): SentMessage => ({
  id,
  body,
  conversationId: "c-1",
  senderId: sender.id,
  createdAt: new Date("2026-01-02T03:04:05.000Z"),
  status: "sent",
  sender,
});

const original = (): SentMessage => base("m-1", "Original body");

const reply = (): SentMessage => ({
  ...base("m-2", "Replying to that"),
  replyToId: "m-1",
  replyTo: {
    id: "m-1",
    body: "Original body",
    isDeleted: false,
    sender: { id: sender.id, name: sender.name, handle: sender.handle },
  },
});

const unrelated = (): SentMessage => base("m-3", "Something else");

describe("applyMessageUpdate", () => {
  it("refreshes the quote body when the quoted message is edited", () => {
    const editedAt = new Date("2026-01-02T04:00:00.000Z");
    const updated = applyMessageUpdate(
      [original(), reply(), unrelated()],
      { id: "m-1", body: "Edited body", editedAt, isDeleted: false },
    );

    expect(updated[0].body).toBe("Edited body");
    expect(updated[0].editedAt).toBe(editedAt);
    // THE REGRESSION: this used to stay "Original body" until a full reload.
    expect(updated[1].replyTo?.body).toBe("Edited body");
    expect(updated[1].replyTo?.isDeleted).toBe(false);
    // The reply keeps its own id/body; only the quote preview changes.
    expect(updated[1].body).toBe("Replying to that");
    expect(updated[1].replyTo?.id).toBe("m-1");
  });

  it("blanks every quote when the quoted message is deleted", () => {
    const updated = applyMessageUpdate(
      [original(), reply()],
      { id: "m-1", body: "", isDeleted: true },
    );

    expect(updated[0].isDeleted).toBe(true);
    expect(updated[0].body).toBe("");
    expect(updated[1].replyTo?.body).toBe("");
    expect(updated[1].replyTo?.isDeleted).toBe(true);
  });

  it("does not touch messages that neither are nor quote the updated row", () => {
    const sibling = unrelated();
    const updated = applyMessageUpdate(
      [original(), reply(), sibling],
      { id: "m-1", body: "Edited body", isDeleted: false },
    );

    expect(updated[2]).toBe(sibling);
  });
});
