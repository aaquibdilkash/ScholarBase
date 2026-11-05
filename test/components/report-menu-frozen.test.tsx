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

const accountState = vi.hoisted(() => ({ frozen: false }));

vi.mock("@/components/cards/ReportModal", () => ({
  ReportModal: () => null,
}));
vi.mock("@/components/appeals/AppealButton", () => ({
  AppealButton: () => <button type="button">Appeal Removal</button>,
}));
vi.mock("@/components/interactions/FrozenUserProvider", () => ({
  useIsFrozen: () => accountState.frozen,
}));

describe("ReportMenu on frozen/deleted content", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    accountState.frozen = false;
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

  it("disables the report flag for a frozen account on live content", async () => {
    accountState.frozen = true;
    await draw();

    const button = flag() as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    expect(button?.disabled).toBe(true);
    expect(button?.className).toContain("cursor-not-allowed");
    expect(button?.getAttribute("title")).toMatch(/frozen/i);
  });

  it("keeps the owner's appeal reachable for a frozen account", async () => {
    accountState.frozen = true;
    await draw({ currentUserId: "u-owner", isFrozen: true });

    const button = flag() as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    expect(button?.disabled).toBe(false);

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Appeal Removal");
    expect(container.textContent).not.toContain("Report Content");
  });

  it("hides the report flag for the owner of anonymous content", async () => {
    // The author link is hidden for anonymous content, but ownership still
    // exists: the owner must not see "Report Content" on their own row.
    await draw({
      currentUserId: "u-owner",
      ownerId: "u-owner",
    });

    expect(flag()).toBeNull();
  });
});
