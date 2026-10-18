import { describe, expect, it } from "vitest";

import { actionErrorMessage } from "@/lib/utils";

/**
 * The server-message preference used by every add-form failure toast.
 *
 * Frozen / deleted-account refusals come back from `getActiveUser` as
 * `{ success: false, error, message }`, while validation failures (e.g. the
 * vacancy URL check) return only `{ success: false, message }`. The generic
 * "Failed to post ..." fallback must never mask either of them - that is
 * exactly the bug that made vacancy / blog / suggest (and, silently,
 * contributions) tell a frozen author "Failed to add journal." instead of
 * why the action was refused.
 */

describe("actionErrorMessage", () => {
  const FROZEN =
    "Your account is frozen. You are restricted from posting, commenting, voting, and reporting.";

  it("surfaces the frozen refusal (error + message) verbatim", () => {
    const result = { success: false, error: FROZEN, message: FROZEN };
    expect(actionErrorMessage(result, "Failed to post vacancy.")).toBe(FROZEN);
  });

  it("surfaces the deleted-account refusal verbatim", () => {
    const result = {
      success: false,
      error: "This account has been deleted.",
      message: "This account has been deleted.",
    };
    expect(actionErrorMessage(result, "Failed to publish article.")).toBe(
      "This account has been deleted.",
    );
  });

  it("falls back to `message` when only it is present (validation failures)", () => {
    const result = { success: false, message: "Invalid URL." };
    expect(actionErrorMessage(result, "Failed to post vacancy.")).toBe(
      "Invalid URL.",
    );
  });

  it("prefers `error` over `message` when both differ", () => {
    const result = { success: false, error: "primary", message: "secondary" };
    expect(actionErrorMessage(result, "fallback")).toBe("primary");
  });

  it("uses the generic fallback when the payload carries no message", () => {
    expect(actionErrorMessage({ success: false }, "fallback")).toBe("fallback");
    expect(actionErrorMessage(undefined, "fallback")).toBe("fallback");
    expect(actionErrorMessage(null, "fallback")).toBe("fallback");
  });

  it("ignores empty or non-string error/message values", () => {
    expect(actionErrorMessage({ success: false, error: "" }, "fallback")).toBe(
      "fallback",
    );
    expect(
      actionErrorMessage({ success: false, error: 42, message: {} }, "fallback"),
    ).toBe("fallback");
  });

  it("falls through to the fallback when the message itself is empty", () => {
    expect(actionErrorMessage({ success: false, message: "" }, "")).toBe("");
    expect(actionErrorMessage({ success: false, message: "x" }, "")).toBe("x");
  });
});
