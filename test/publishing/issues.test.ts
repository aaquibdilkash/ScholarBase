import { describe, expect, it } from "vitest";

import {
  countIssues,
  groupIssueArticles,
  type IssueLike,
} from "@/lib/publishing/issues";

function paper(
  id: string,
  overrides: Partial<IssueLike> = {},
): IssueLike & { id: string } {
  return {
    id,
    volume: 2,
    issue: 1,
    firstPage: null,
    publishedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("groupIssueArticles", () => {
  it("groups by volume and issue", () => {
    const groups = groupIssueArticles([
      paper("a", { volume: 1, issue: 1 }),
      paper("b", { volume: 1, issue: 2 }),
      paper("c", { volume: 2, issue: 1 }),
    ]);

    expect(groups.map((group) => `${group.volume}.${group.issue}`)).toEqual([
      "2.1",
      "1.2",
      "1.1",
    ]);
  });

  it("sorts online-first ahead of volumes", () => {
    const groups = groupIssueArticles([
      paper("a", { volume: 3, issue: 1 }),
      paper("b", { volume: null, issue: null }),
    ]);

    expect(groups[0].volume).toBeNull();
    expect(groups[0].articles.map((item) => item.id)).toEqual(["b"]);
  });

  it("orders an issue by page number, numerically", () => {
    const [group] = groupIssueArticles([
      paper("ten", { firstPage: "10" }),
      paper("nine", { firstPage: "9" }),
      paper("hundred", { firstPage: "100" }),
    ]);

    expect(group.articles.map((item) => item.id)).toEqual([
      "nine",
      "ten",
      "hundred",
    ]);
  });

  it("puts unpaginated items after paginated ones, newest first", () => {
    const [group] = groupIssueArticles([
      paper("editorial-old", {
        firstPage: null,
        publishedAt: new Date("2026-01-01T00:00:00Z"),
      }),
      paper("lead", { firstPage: "1" }),
      paper("editorial-new", {
        firstPage: null,
        publishedAt: new Date("2026-02-01T00:00:00Z"),
      }),
    ]);

    expect(group.articles.map((item) => item.id)).toEqual([
      "lead",
      "editorial-new",
      "editorial-old",
    ]);
  });

  it("tracks the latest publication date in the group", () => {
    const [group] = groupIssueArticles([
      paper("a", { publishedAt: new Date("2026-01-01T00:00:00Z") }),
      paper("b", { publishedAt: new Date("2026-05-01T00:00:00Z") }),
    ]);

    expect(group.latest?.toISOString()).toBe("2026-05-01T00:00:00.000Z");
  });

  it("returns no groups for no articles", () => {
    expect(groupIssueArticles([])).toEqual([]);
  });
});

describe("countIssues", () => {
  it("counts articles, volumes, and numbered issues", () => {
    const groups = groupIssueArticles([
      paper("a", { volume: 1, issue: 1 }),
      paper("b", { volume: 1, issue: 2 }),
      paper("c", { volume: 2, issue: 1 }),
      paper("d", { volume: null, issue: null }),
    ]);

    expect(countIssues(groups)).toEqual({
      articleCount: 4,
      volumeCount: 2,
      issueCount: 3,
    });
  });
});
