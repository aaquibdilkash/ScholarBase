/**
 * @vitest-environment jsdom
 *
 * Regression: the frozen banner promises "reporting ... disabled", but the
 * flag menu still offered "Report Content" to non-owners and the report action
 * accepted it. Reporting is an interaction, so frozen/deleted content must
 * only expose the owner's appeal (when one is available).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { ReportMenu } from "@/components/cards/ReportMenu";

vi.mock("@/components/cards/ReportModal", () => ({
  ReportModal: () => null,
}));
vi.mock("@/components/appeals/AppealButton", () => ({
  AppealButton: () => <button type="button">Appeal Removal</button>,
}));

describe("ReportMenu on frozen/deleted content", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const draw = async (overrides: Record<string, unknown> = {}) => {
    await act(async () => {
      root.render(
        <ReportMenu
          entityId="p-1"
          entityType="POST"
          module="SOCIAL_FEED"
          ownerId="u-owner"
          currentUserId="u-viewer"
          {...overrides}
        />,
      );
    });
  };

  const flag = () =>
    container.querySelector('button[aria-label="Report content"]');

  it("hides the flag for a non-owner on frozen content", async () => {
    await draw({ isFrozen: true });

    expect(flag()).toBeNull();
  });

  it("hides the flag for a non-owner on deleted content", async () => {
    await draw({ isDeleted: true, deletedByType: "AUTHOR" });

    expect(flag()).toBeNull();
  });

  it("keeps the flag for a non-owner on live content", async () => {
    await draw();

    expect(flag()).not.toBeNull();
  });

  it("keeps the owner's appeal reachable on frozen content", async () => {
    await draw({ currentUserId: "u-owner", isFrozen: true });

    const button = flag();
    expect(button).not.toBeNull();

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Appeal Removal");
    expect(container.textContent).not.toContain("Report Content");
  });

  it("hides the flag once the owner's appeal is already active", async () => {
    await draw({
      currentUserId: "u-owner",
      isFrozen: true,
      hasActiveAppeal: true,
    });

    expect(flag()).toBeNull();
  });
});
