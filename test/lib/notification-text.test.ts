import { describe, expect, it } from "vitest";
import { canonicalizeActorPrefix } from "@/lib/notification-text";

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
});
