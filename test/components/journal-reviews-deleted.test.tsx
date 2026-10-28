/**
 * @vitest-environment jsdom
 *
 * Regression: a deleted journal's detail page still offered "+ Review" in the
 * empty reviews state, but /journals/[id]/review/add filters `isDeleted: false`
 * and 404s. Existing reviews stay visible; the write CTA must not.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { JournalReviewsSection } from "@/components/journals/JournalReviewsSection";

vi.mock("@/app/actions/journalReviews", () => ({
  getJournalReviews: vi.fn(),
}));

// PagedCarousel's subtree reaches useUser, whose module creates a browser
// Supabase client at import time (no env in the unit tier).
vi.mock("@/hooks/useUser", () => ({
  useUser: () => ({ user: null, loading: false }),
}));

vi.mock("@/components/journals/WriteJournalReviewButton", () => ({
  WriteJournalReviewButton: () => (
    <span data-testid="write-review">+ Review</span>
  ),
}));

describe("JournalReviewsSection on a deleted journal", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    queryClient.clear();
  });

  const draw = async (isDeleted: boolean) => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <JournalReviewsSection
            journalId="j-1"
            initialReviews={[]}
            initialCount={0}
            initialRatingSum={0}
            initialDistribution={{}}
            hasUserReview={false}
            isDeleted={isDeleted}
          />
        </QueryClientProvider>,
      );
    });
  };

  const reviewLink = () =>
    container.querySelector('[data-testid="write-review"]');

  it("hides the + Review CTA on a deleted journal", async () => {
    await draw(true);

    expect(container.textContent).toContain("Reviews (0)");
    expect(container.textContent).toContain("No reviews yet.");
    expect(reviewLink()).toBeNull();
  });

  it("keeps the + Review CTA on a live journal", async () => {
    await draw(false);

    expect(container.textContent).toContain(
      "No reviews yet. Be the first to share yours!",
    );
    expect(reviewLink()).not.toBeNull();
  });
});
