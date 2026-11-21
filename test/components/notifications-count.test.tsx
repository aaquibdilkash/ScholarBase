/**
 * @vitest-environment jsdom
 *
 * Regression coverage: an aggregated notification row (e.g. multiple survey
 * respondents) must say "and N others" in its copy. The old UI showed a
 * separate "+N" chip next to the type badge, which read like a counter and
 * duplicated what the sentence already says.
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
  title: "ada participated in a survey",
  body: 'ada posted a response to "Research survey".',
  count: 1,
  readAt: null,
  isEmailed: false,
  createdAt: new Date("2026-11-16T10:00:00.000Z"),
  updatedAt: new Date("2026-11-16T10:00:00.000Z"),
  actor,
  ...overrides,
});

describe("NotificationCard clustered copy", () => {
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

  it("never renders a separate count chip", () => {
    draw(makeNotification({ count: 3 }));
    expect(container.textContent).not.toMatch(/×\s*3/);
    expect(container.querySelector('span[aria-label="3 interactions"]')).toBeNull();
  });

  it("keeps the \"and N others\" copy in a clustered title", () => {
    draw(
      makeNotification({
        count: 3,
        title: "ada and 2 others participated in a survey",
        body: 'ada and 2 others posted responses to "Research survey".',
      }),
    );

    expect(container.textContent).toContain("ada and 2 others participated in a survey");
    expect(container.textContent).toContain("ada and 2 others posted responses to");
  });

  it("keeps the cluster suffix while resolving the actor prefix to the current profile", () => {
    draw(
      makeNotification({
        count: 2,
        title: "old_handle and 1 other participated in a survey",
      }),
    );

    expect(container.textContent).toContain("ada and 1 other participated in a survey");
  });
});
