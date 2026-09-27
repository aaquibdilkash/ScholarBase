import { describe, expect, it } from "vitest";
import type { Notification } from "@prisma/client";
import {
  getModuleLabel,
  getModuleNoun,
  getNotificationLink,
} from "@/lib/notification-links";

/**
 * The notification target registry.
 *
 * This is the one place that knows where a target lives, what it is called and
 * what to call it in copy. It is a single registry precisely because it used to
 * be three parallel maps keyed on the same strings, which is how a journal
 * review's vote came to be announced as a vote on a post. These tests pin the
 * two facts that regressed, plus the deliberate fallbacks.
 */

function notification(partial: Partial<Notification>): Notification {
  return {
    recipientId: "u-recipient",
    actorId: "u-actor",
    type: "NEW_VOTE",
    targetType: null,
    targetId: null,
    ...partial,
  } as Notification;
}

describe("target links", () => {
  it("routes a journal review to the review, not the journal", () => {
    expect(
      getNotificationLink(
        notification({
          targetType: "journalReview",
          targetId: "journal-1/review-1",
        }),
      ),
    ).toBe("/journals/journal-1/review/review-1");
  });

  it("routes a recommendation through its supervisor", () => {
    expect(
      getNotificationLink(
        notification({
          targetType: "recommendation",
          targetId: "supervisor-1/rec-1",
        }),
      ),
    ).toBe("/supervisor/supervisor-1/recommendation/rec-1");
  });

  it("returns null for a nested target with no parent id, rather than a dead link", () => {
    // A bare review id cannot name a journal, so there is no route to build.
    expect(
      getNotificationLink(
        notification({ targetType: "journalReview", targetId: "review-1" }),
      ),
    ).toBeNull();
  });

  it("accepts any spelling of a target type", () => {
    for (const targetType of ["journalReview", "journalreview", "JOURNALREVIEW"]) {
      expect(
        getNotificationLink(
          notification({ targetType, targetId: "journal-1/review-1" }),
        ),
      ).toBe("/journals/journal-1/review/review-1");
    }
  });

  it("anchors comment-bearing notification types to the discussion", () => {
    for (const type of ["mention", "NEW_COMMENT", "NEW_REPLY"]) {
      expect(
        getNotificationLink(
          notification({ type, targetType: "journalReview", targetId: "j1/r1" }),
        ),
      ).toBe("/journals/j1/review/r1#comments");
    }
  });

  it("sends follows to the follower and messages to the thread", () => {
    // `targetId` is required by the payload schema (notificationPayloadSchema),
    // so every stored row has one — including follows, where it is the rollup
    // key rather than a route.
    expect(
      getNotificationLink(
        notification({
          type: "NEW_FOLLOWER",
          targetType: "profile",
          targetId: "u-recipient",
        }),
      ),
    ).toBe("/scholars/u-actor");
    // No action currently emits a "message-received" row (messages arrive over
    // Supabase realtime, not the notification table), but the branch is here for
    // when that changes, so it is pinned with a schema-valid row.
    expect(
      getNotificationLink(
        notification({
          type: "message-received",
          targetType: "profile",
          targetId: "conversation-1",
        }),
      ),
    ).toBe("/messages/conversation-1");
  });

  it("returns null when there is nothing to link to", () => {
    expect(getNotificationLink(notification({ targetId: "a-1" }))).toBeNull();
    expect(
      getNotificationLink(notification({ targetType: "journalReview" })),
    ).toBeNull();
  });
});

describe("module copy", () => {
  it("names the target in copy, not the thing it belongs to", () => {
    // The bug this registry was built for: a review vote must not read as a
    // vote on the journal, and must not fall back to the generic "post".
    expect(getModuleNoun("journalReview")).toBe("journal review");
    expect(getModuleLabel("journalReview")).toBe("Journal review");

    // The journal's own entry is still there and still says "journal".
    expect(getModuleNoun("journal")).toBe("journal");
  });

  it("uses singular nouns for every target that has one", () => {
    expect(getModuleNoun("post")).toBe("post");
    expect(getModuleNoun("socialPost")).toBe("post");
    expect(getModuleNoun("recommendation")).toBe("recommendation");
    expect(getModuleNoun("researchTool")).toBe("research tool");
    expect(getModuleNoun("researchsurvey")).toBe("survey");
  });

  it("falls back to post for an unknown or missing target", () => {
    expect(getModuleNoun("somethingNew")).toBe("post");
    expect(getModuleNoun(undefined)).toBe("post");
    expect(getModuleNoun(null)).toBe("post");
  });

  it("resolves labels through the registry, verbatim otherwise", () => {
    expect(getModuleLabel("journal")).toBe("Journals");
    expect(getModuleLabel("supervisor")).toBe("Supervisor");
    // The admin reports table passes a report's coarse contentType, which has
    // no entry and must keep rendering as-is instead of resolving to a section.
    expect(getModuleLabel("POST")).toBe("POST");
  });
});
