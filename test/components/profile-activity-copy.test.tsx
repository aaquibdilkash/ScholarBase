/**
 * @vitest-environment jsdom
 *
 * Regression: the profile Activity tab rendered stored activity titles
 * verbatim. A published journal review stores `journalTitle ||| feedback`, so
 * the raw delimiter leaked into the headline, and an article was labelled
 * "article" even though the module is presented as a blog everywhere else.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { ActivityItemCard } from "@/components/profile/ProfileTabs";
import type { ActivityItem } from "@/types/activity";

vi.mock("@/app/actions/profile", () => ({
  getProfileSections: vi.fn(),
  getProfileBookmarkSections: vi.fn(),
  getProfileBookmarkSection: vi.fn(),
  getProfileActivity: vi.fn(),
  getProfileSection: vi.fn(),
}));

vi.mock("@/hooks/useUser", () => ({
  useUser: () => ({ user: null, loading: false }),
}));

const item = (overrides: Partial<ActivityItem>): ActivityItem => ({
  id: "activity-1",
  action: "PUBLISHED",
  moduleType: "JOURNAL_REVIEW",
  entityId: "journal-1/review-1",
  entityTitle: "Testing Journal|||Testing working",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  ...overrides,
});

describe("ActivityItemCard headlines", () => {
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

  const draw = async (activity: ActivityItem) => {
    await act(async () => {
      root.render(<ActivityItemCard item={activity} />);
    });
  };

  it("names the review and its journal instead of leaking the delimiter", async () => {
    await draw(item({}));

    const text = container.textContent ?? "";
    expect(text).toContain("published a journal review");
    expect(text).toContain("“Testing working”");
    expect(text).toContain("in the journal");
    expect(text).toContain("“Testing Journal”");
    expect(text).not.toContain("|||");

    const reviewLink = container.querySelector(
      'a[href="/journals/journal-1/review/review-1"]',
    );
    expect(reviewLink?.textContent).toContain("Testing working");

    const journalLink = container.querySelector('a[href="/journals/journal-1"]');
    expect(journalLink?.textContent).toContain("Testing Journal");
  });

  it("calls published articles blogs, matching the blog module", async () => {
    await draw(
      item({
        moduleType: "ARTICLE",
        entityId: "blog-1",
        entityTitle: "solve the question",
      }),
    );

    const text = container.textContent ?? "";
    expect(text).toContain("published blog");
    expect(text).not.toContain("published article");
  });
});
