import { describe, expect, it } from "vitest";
import {
  MODEL_MAP,
  COMMENT_MODEL_MAP,
  COMMENT_TOP_LEVEL,
  AUTHOR_COUNT_FIELD,
  CONTENT_TARGET_TYPE,
  ANONYMOUS_CONTENT_TYPES,
} from "@/lib/moderation-config";
import { SECTION_CONTENT_TYPES } from "@/lib/adminConfig";
import { MODULE_TO_CONTENT_TYPE } from "@/lib/constants";

/**
 * Cross-map consistency guard.
 *
 * The admin DELETE/RECOVER branches used to gate the reputation reversal on
 * `AUTHOR_COUNT_FIELD`, so a content type missing from that map silently lost
 * BOTH the reputation reversal and the counter change. Courses and research
 * grants were missing until 2026-09-30: deleting one kept the author's
 * reputation, and recovering one (after a normal delete) never re-granted it.
 *
 * There are now four registries that must agree — the moderation registry
 * (`MODEL_MAP`), the counter map, the admin UI's `SECTION_CONTENT_TYPES`, and
 * the report-module normaliser `MODULE_TO_CONTENT_TYPE`. This file turns their
 * agreement into a CI check instead of a memory test.
 */

const KNOWN_CONTENT_TYPES = new Set([
  ...Object.keys(MODEL_MAP),
  ...Object.keys(COMMENT_MODEL_MAP),
]);

describe("admin moderation registry: key sets stay in lockstep", () => {
  it("every moderatable content type has an author count field", () => {
    const missing = Object.keys(MODEL_MAP).filter(
      (key) => !(key in AUTHOR_COUNT_FIELD),
    );
    expect(
      missing,
      "a missing AUTHOR_COUNT_FIELD key silently skipped the reputation " +
        "reversal AND the counter change on admin delete/recover",
    ).toEqual([]);
  });

  it("AUTHOR_COUNT_FIELD has no orphaned keys", () => {
    const orphans = Object.keys(AUTHOR_COUNT_FIELD).filter(
      (key) => !(key in MODEL_MAP),
    );
    expect(orphans, "counted a content type moderation cannot act on").toEqual([]);
  });

  it("SCHOLAR_PROFILE is the only null count field", () => {
    expect(AUTHOR_COUNT_FIELD.SCHOLAR_PROFILE).toBeNull();
    const nulls = Object.entries(AUTHOR_COUNT_FIELD)
      .filter(([, value]) => value === null)
      .map(([key]) => key);
    expect(nulls).toEqual(["SCHOLAR_PROFILE"]);
  });

  it("every comment type declares its top-level parent", () => {
    const missing = Object.keys(COMMENT_MODEL_MAP).filter(
      (key) => !(key in COMMENT_TOP_LEVEL),
    );
    expect(
      missing,
      "without a parent the recover path cannot restore totalComments/totalReplies",
    ).toEqual([]);
  });

  it("comment parents resolve to real content models", () => {
    const contentModels = new Set(Object.values(MODEL_MAP).map((m) => m.model));
    const bogus = Object.entries(COMMENT_TOP_LEVEL)
      .filter(([, cfg]) => !contentModels.has(cfg.model))
      .map(([key]) => key);
    expect(bogus).toEqual([]);
  });

  it("every content type has a notification target type", () => {
    const missing = [...KNOWN_CONTENT_TYPES].filter(
      (key) => !(key in CONTENT_TARGET_TYPE),
    );
    expect(
      missing,
      "a missing CONTENT_TARGET_TYPE makes the moderation notification unlinkable",
    ).toEqual([]);
  });

  it("every admin UI section resolves to a known content type", () => {
    const unknown = Object.entries(SECTION_CONTENT_TYPES)
      .filter(([, value]) => !KNOWN_CONTENT_TYPES.has(value))
      .map(([section, value]) => `${section} -> ${value}`);
    expect(
      unknown,
      "the admin panel would throw 'Invalid content type' on these sections",
    ).toEqual([]);
  });

  it("every report/appeal module normalises to a known content type", () => {
    const unknown = Object.entries(MODULE_TO_CONTENT_TYPE)
      .filter(([, value]) => !KNOWN_CONTENT_TYPES.has(value))
      .map(([module, value]) => `${module} -> ${value}`);
    expect(
      unknown,
      "appeals carry a report module; an unknown value throws in moderateContent",
    ).toEqual([]);
  });

  it("anonymous content types are real content types with a counter", () => {
    for (const type of ANONYMOUS_CONTENT_TYPES) {
      expect(MODEL_MAP[type], type).toBeDefined();
      expect(AUTHOR_COUNT_FIELD[type], type).toBeDefined();
    }
  });

  it("THE REGRESSION: courses, grants and journal reviews are moderatable", () => {
    expect(MODEL_MAP.course).toEqual({ model: "course" });
    expect(AUTHOR_COUNT_FIELD.course).toBe("courseCount");
    expect(MODEL_MAP.researchGrant).toEqual({ model: "researchGrant" });
    expect(AUTHOR_COUNT_FIELD.researchGrant).toBe("researchGrantCount");
    expect(MODEL_MAP.journalReview).toEqual({ model: "journalReview" });
    expect(AUTHOR_COUNT_FIELD.journalReview).toBe("journalReviewCount");
    expect(MODEL_MAP.journalReviewComment).toBeUndefined();
    expect(COMMENT_MODEL_MAP.journalReviewComment).toEqual({
      model: "journalReviewComment",
    });
    expect(COMMENT_TOP_LEVEL.journalReviewComment).toEqual({
      model: "journalReview",
      fk: "journalReviewId",
    });
  });
});
