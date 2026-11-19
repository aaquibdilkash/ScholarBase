import { describe, expect, it } from "vitest";

import {
  RESULT_KIND_LABELS,
  RESULT_OUTCOME_LABELS,
  isExamNotification,
  parseResultKind,
  parseResultOutcomeType,
  resultBadgeLabel,
  resultLinkActions,
} from "@/lib/results/entry-types";

describe("result kind vocabulary", () => {
  it("parses kinds case-insensitively and rejects unknown values", () => {
    expect(parseResultKind("exam_notification")).toBe("EXAM_NOTIFICATION");
    expect(parseResultKind("  RESULT_NOTIFICATION ")).toBe(
      "RESULT_NOTIFICATION",
    );
    expect(parseResultKind("RESULT")).toBeNull();
    expect(parseResultKind(null)).toBeNull();
    expect(parseResultKind(undefined)).toBeNull();
  });

  it("parses outcome types case-insensitively and rejects unknown values", () => {
    expect(parseResultOutcomeType("admission")).toBe("ADMISSION");
    expect(parseResultOutcomeType(" exam ")).toBe("EXAM");
    expect(parseResultOutcomeType("")).toBeNull();
    expect(parseResultOutcomeType("MERIT_LIST")).toBeNull();
  });

  it("detects an exam notification from any spelling of the kind", () => {
    expect(isExamNotification("EXAM_NOTIFICATION")).toBe(true);
    expect(isExamNotification("exam_notification")).toBe(true);
    expect(isExamNotification("RESULT_NOTIFICATION")).toBe(false);
    expect(isExamNotification(null)).toBe(false);
  });
});

describe("resultBadgeLabel", () => {
  it("labels an exam notification by its kind, ignoring the stored type", () => {
    expect(resultBadgeLabel("EXAM_NOTIFICATION", "EXAM")).toBe(
      RESULT_KIND_LABELS.EXAM_NOTIFICATION,
    );
    expect(resultBadgeLabel("exam_notification", "ADMISSION")).toBe(
      "Exam Notification",
    );
  });

  it("labels a result by its outcome type", () => {
    expect(resultBadgeLabel("RESULT_NOTIFICATION", "ADMISSION")).toBe(
      RESULT_OUTCOME_LABELS.ADMISSION,
    );
    expect(resultBadgeLabel("RESULT_NOTIFICATION", "EXAM")).toBe("Exam Result");
  });

  it("falls back to the generic result label for a legacy unknown type", () => {
    expect(resultBadgeLabel("RESULT_NOTIFICATION", "MERIT_LIST")).toBe("Result");
    expect(resultBadgeLabel(null, null)).toBe("Result");
  });
});

describe("resultLinkActions", () => {
  const notificationLink = "https://example.org/notification";
  const checkOrApplyLink = "https://example.org/check";

  it("leads an exam notification with the official notice", () => {
    const { primary, secondary } = resultLinkActions("EXAM_NOTIFICATION", {
      notificationLink,
      checkOrApplyLink,
    });
    expect(primary).toEqual({
      href: notificationLink,
      label: "View official notification",
    });
    expect(secondary).toEqual({
      href: checkOrApplyLink,
      label: "Apply / check details",
    });
  });

  it("leads a result with the outcome page", () => {
    const { primary, secondary } = resultLinkActions("RESULT_NOTIFICATION", {
      notificationLink,
      checkOrApplyLink,
    });
    expect(primary).toEqual({ href: checkOrApplyLink, label: "Check result" });
    expect(secondary).toEqual({
      href: notificationLink,
      label: "View official notification",
    });
  });

  it("promotes the only available link and omits a missing one", () => {
    const onlyNotification = resultLinkActions("RESULT_NOTIFICATION", {
      notificationLink,
    });
    expect(onlyNotification.primary).toEqual({
      href: notificationLink,
      label: "View official notification",
    });
    expect(onlyNotification.secondary).toBeNull();

    const onlyCheck = resultLinkActions("EXAM_NOTIFICATION", {
      checkOrApplyLink,
    });
    expect(onlyCheck.primary).toEqual({
      href: checkOrApplyLink,
      label: "Apply / check details",
    });
    expect(onlyCheck.secondary).toBeNull();
  });

  it("returns no actions when both links are absent", () => {
    expect(resultLinkActions("RESULT_NOTIFICATION", {})).toEqual({
      primary: null,
      secondary: null,
    });
  });
});
