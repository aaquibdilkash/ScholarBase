import { describe, expect, it } from "vitest";
import {
  deletedDetailNavigation,
  engagedContentWhere,
} from "@/lib/content-tombstone";

describe("deletedDetailNavigation", () => {
  const fallback = { redirect: "/journals", invalidateQueries: [["journals"]] };

  it("stays on the detail page when comments keep the tombstone readable", () => {
    expect(
      deletedDetailNavigation({ totalComments: 2 }, "/journals", [["journals"]]),
    ).toEqual({ refresh: true });
  });

  it("stays on the page when a journal still has reviews", () => {
    expect(
      deletedDetailNavigation(
        { totalComments: 0, reviewCount: 1 },
        "/journals",
        [["journals"]],
      ),
    ).toEqual({ refresh: true });
  });

  it("stays on the page when a survey still has responses", () => {
    expect(
      deletedDetailNavigation(
        { totalComments: 0, totalResponses: 3 },
        "/surveys",
        [["surveys"]],
      ),
    ).toEqual({ refresh: true });
  });

  it("stays on the page when a supervisor profile still has recommendations", () => {
    expect(
      deletedDetailNavigation(
        { totalComments: 0, recommendationCount: 2 },
        "/supervisor",
        [["supervisors"]],
      ),
    ).toEqual({ refresh: true });
  });

  it("falls back to the list when nothing keeps the tombstone readable", () => {
    expect(
      deletedDetailNavigation(
        { totalComments: 0, reviewCount: 0, totalResponses: 0 },
        "/journals",
        [["journals"]],
      ),
    ).toEqual(fallback);
    expect(deletedDetailNavigation(undefined, "/journals", [["journals"]])).toEqual(
      fallback,
    );
    expect(deletedDetailNavigation(null, "/journals", [["journals"]])).toEqual(
      fallback,
    );
  });
});

describe("engagedContentWhere", () => {
  it("keeps live rows and engaged deleted rows visible", () => {
    expect(engagedContentWhere("totalComments")).toEqual({
      OR: [
        { isDeleted: false },
        {
          isDeleted: true,
          OR: [{ totalComments: { gt: 0 } }],
        },
      ],
    });
  });
});
