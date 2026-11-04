import { describe, expect, it } from "vitest";

import { clampMatchLimit } from "@/lib/semantic/matching";
import {
  clampEmbeddingLimit,
  embeddingRetryDelayMinutes,
  EMBEDDING_MAX_ATTEMPTS,
} from "@/lib/semantic/worker";

describe("embedding worker bounds", () => {
  it("defaults to a small batch and caps explicit limits", () => {
    expect(clampEmbeddingLimit(undefined)).toBe(20);
    expect(clampEmbeddingLimit(0)).toBe(20);
    expect(clampEmbeddingLimit(Number.NaN)).toBe(20);
    expect(clampEmbeddingLimit(1)).toBe(1);
    expect(clampEmbeddingLimit(20.9)).toBe(20);
    expect(clampEmbeddingLimit(10_000)).toBe(100);
  });

  it("backs off exponentially and stops at one hour", () => {
    expect(embeddingRetryDelayMinutes(1)).toBe(5);
    expect(embeddingRetryDelayMinutes(2)).toBe(10);
    expect(embeddingRetryDelayMinutes(3)).toBe(20);
    expect(embeddingRetryDelayMinutes(4)).toBe(40);
    expect(embeddingRetryDelayMinutes(5)).toBe(60);
    expect(embeddingRetryDelayMinutes(20)).toBe(60);
  });

  it("drops a job after a bounded number of attempts", () => {
    expect(EMBEDDING_MAX_ATTEMPTS).toBe(5);
  });
});

describe("semantic match bounds", () => {
  it("defaults to ten matches and caps the caller", () => {
    expect(clampMatchLimit(undefined)).toBe(10);
    expect(clampMatchLimit(0)).toBe(10);
    expect(clampMatchLimit(Number.NaN)).toBe(10);
    expect(clampMatchLimit(3.8)).toBe(3);
    expect(clampMatchLimit(500)).toBe(50);
  });
});
