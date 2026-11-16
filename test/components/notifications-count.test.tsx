/**
 * @vitest-environment jsdom
 *
 * Regression coverage: an aggregated notification row (e.g. multiple survey
 * respondents) shows its `count` so earlier respondents don't appear to vanish.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

vi.mock("@/lib/notification-links", () => ({
  getNotificationLink: () => null,
}));

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/app/actions/notifications", () => ({
  markNotificationRead: vi.fn(async () => {}),
}));

import { NotificationCard } from "@/components/notifications/NotificationsList";

type NotificationWithActor = {
  id: string;
  recipientId: string;
  actorId: string;
  type: string;
  targetType: string | null;
  targetId: string | null;
  title: string;
  body: string;
  count: number;
  readAt: Date | null;
  isEmailed: boolean;
  createdAt: Date;
  updatedAt: Date;
  actor: {
    id: string;
    name: string | null;
    handle: string | null;
    avatarUrl: string | null;
  };
};

const actor = { id: "u-1", name: "Ada Lovelace", handle: "ada", avatarUrl: null };

const makeNotification = (
  overrides: Partial<NotificationWithActor> = {},
): NotificationWithActor => ({
  id: "n-1",
  recipientId: "u-recip",
  actorId: "u-1",
  type: "survey-response",
  targetType: "survey",
  targetId: "survey-1",
  title: "New response to your survey",
  body: "Someone posted a response to \"Research survey\".",
  count: 1,
  readAt: null,
  isEmailed: false,
  createdAt: new Date("2026-11-16T10:00:00.000Z"),
  updatedAt: new Date("2026-11-16T10:00:00.000Z"),
  actor,
  ...overrides,
});

describe("NotificationCard count badge", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const draw = (notification: NotificationWithActor) => {
    act(() => {
      root.render(<NotificationCard notification={notification} />);
    });
  };

  it("hides the badge when count is 1", () => {
    draw(makeNotification());
    expect(container.textContent).not.toMatch(/×/);
  });

  it("shows the count badge when count is 3", () => {
    draw(makeNotification({ count: 3 }));
    expect(container.textContent).toContain("×3");
    const badge = container.querySelector('span[aria-label="3 interactions"]');
    expect(badge).not.toBeNull();
  });

  it("shows the badge for any aggregated rollup type", () => {
    draw(makeNotification({ type: "NEW_VOTE", count: 4 }));
    expect(container.textContent).toContain("×4");
  });
});
