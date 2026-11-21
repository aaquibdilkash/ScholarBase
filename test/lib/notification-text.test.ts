import { describe, expect, it } from "vitest";
import { canonicalizeActorPrefix, formatRollupTitle } from "@/lib/notification-text";

describe("canonicalizeActorPrefix", () => {
  it("keeps the actor prefix when none of the rollup markers are present", () => {
    expect(canonicalizeActorPrefix("Hello world", "Ada")).toBe("Hello world");
  });

  it("replaces the leading placeholder with the actor at the first marker", () => {
    expect(
      canonicalizeActorPrefix("Someone added you as a publication author", "kd_msc"),
    ).toBe("kd_msc added you as a publication author");
  });

  it("resolves the rollup message starting at the earliest marker", () => {
    expect(
      canonicalizeActorPrefix("Someone published a new blog", "Ada"),
    ).toBe("Ada published a new blog");
  });

  it("does not break titles that lack a leading placeholder", () => {
    expect(
      canonicalizeActorPrefix("kd_msc added a new journal", "kd_msc"),
    ).toBe("kd_msc added a new journal");
  });

  it("rewrites the survey-participation placeholder to the respondent", () => {
    expect(
      canonicalizeActorPrefix("Someone participated in a survey", "kd_msc"),
    ).toBe("kd_msc participated in a survey");
  });

  it("keeps a clustered title's \"and N others\" suffix", () => {
    expect(
      canonicalizeActorPrefix("Someone and 2 others participated in a survey", "kd_msc"),
    ).toBe("kd_msc and 2 others participated in a survey");
    expect(
      canonicalizeActorPrefix("old_handle and 1 other commented on your post", "new_handle"),
    ).toBe("new_handle and 1 other commented on your post");
  });
});

describe("formatRollupTitle", () => {
  it("adds \"and 1 other\" for a two-actor cluster", () => {
    expect(
      formatRollupTitle("Someone participated in a survey", "ada", 1),
    ).toBe("ada and 1 other participated in a survey");
  });

  it("adds \"and N others\" for larger clusters", () => {
    expect(
      formatRollupTitle("Someone commented on your post", "ada", 2),
    ).toBe("ada and 2 others commented on your post");
  });

  it("replaces a previous cluster suffix instead of stacking it", () => {
    expect(
      formatRollupTitle("bob and 1 other replied to your comment", "ada", 3),
    ).toBe("ada and 3 others replied to your comment");
  });

  it("leaves titles without an actor prefix alone", () => {
    expect(formatRollupTitle("New Upvote", "ada", 2)).toBe("New Upvote");
  });
});
