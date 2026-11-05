import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  decrementRecommendation,
  getRecommendationAggregates,
  seedRecommendationAggregates,
} from "@/components/supervisor/recommendationCount";
import {
  decrementJournalReview,
  getJournalReviewAggregates,
  seedJournalReviewAggregates,
} from "@/components/journals/journalReviewCount";

/**
 * `count` is the live-only number (heading + average); `slides` is what the
 * carousel can page through. Deleting an engaged review/recommendation turns it
 * into a tombstone, so the live count drops but its slide must remain — using
 * `count` for `hasMore` is what hid the deleted card.
 */

const ID = "parent-1";

describe("recommendation aggregates", () => {
  it("keeps the slide when the deleted row stays as a tombstone", () => {
    const qc = new QueryClient();
    seedRecommendationAggregates(
      qc,
      ID,
      3,
      12,
      { 5: 2, 4: 1 },
      5,
    );

    decrementRecommendation(qc, ID, 4, true);

    const agg = getRecommendationAggregates(qc, ID);
    expect(agg.count).toBe(2);
    expect(agg.slides).toBe(5);
    expect(agg.ratingSum).toBe(8);
    expect(agg.dist[4]).toBe(0);
  });

  it("drops the slide when the row is removed outright", () => {
    const qc = new QueryClient();
    seedRecommendationAggregates(qc, ID, 3, 12, { 5: 2, 4: 1 }, 5);

    decrementRecommendation(qc, ID, 5, false);

    expect(getRecommendationAggregates(qc, ID).slides).toBe(4);
  });

  it("never seeds over an existing aggregate store", () => {
    const qc = new QueryClient();
    seedRecommendationAggregates(qc, ID, 3, 12, { 5: 2, 4: 1 }, 5);

    seedRecommendationAggregates(qc, ID, 99, 99, { 1: 99 }, 99);

    const agg = getRecommendationAggregates(qc, ID);
    expect(agg.count).toBe(3);
    expect(agg.slides).toBe(5);
  });
});

describe("journal review aggregates", () => {
  it("keeps the slide when the deleted row stays as a tombstone", () => {
    const qc = new QueryClient();
    seedJournalReviewAggregates(qc, ID, 3, 12, { 5: 2, 4: 1 }, 5);

    decrementJournalReview(qc, ID, 4, true);

    const agg = getJournalReviewAggregates(qc, ID);
    expect(agg.count).toBe(2);
    expect(agg.slides).toBe(5);
    expect(agg.ratingSum).toBe(8);
    expect(agg.dist[4]).toBe(0);
  });

  it("drops the slide when the row is removed outright", () => {
    const qc = new QueryClient();
    seedJournalReviewAggregates(qc, ID, 3, 12, { 5: 2, 4: 1 }, 5);

    decrementJournalReview(qc, ID, 5, false);

    expect(getJournalReviewAggregates(qc, ID).slides).toBe(4);
  });
});
