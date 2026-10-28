import { describe, expect, it } from "vitest";
import { getEntityDisplayTitle } from "@/lib/entityTitle";

/**
 * Admin tables render `getEntityDisplayTitle` directly: any markup that leaks
 * through shows up as literal `<p>` / `<ul><li>` in the dashboard (feed posts
 * and recommendation feedback are both stored as TipTap HTML).
 */
describe("getEntityDisplayTitle", () => {
  it("prefers an explicit title field", () => {
    expect(
      getEntityDisplayTitle({ title: "Estimating first", content: "<p>body</p>" }),
    ).toBe("Estimating first");
  });

  it("strips TipTap markup from feed post content", () => {
    expect(
      getEntityDisplayTitle({
        content: "<p>The practice of estimating first before building</p>",
      }),
    ).toBe("The practice of estimating first before building");
  });

  it("flattens lists and inline formatting into one line", () => {
    expect(
      getEntityDisplayTitle({
        content:
          "<ul><li><p><strong>Pictures are drawings.</strong></p></li></ul>",
      }),
    ).toBe("Pictures are drawings.");
  });

  it("does not truncate long titles", () => {
    const long = "posting without image (edited: added image and a long tail)";
    expect(getEntityDisplayTitle({ content: `<p>${long}</p>` })).toBe(long);
  });

  it("treats markup-only content as empty and falls through", () => {
    expect(
      getEntityDisplayTitle({
        content: "<p></p>",
        feedback: "<p>Useful feedback</p>",
      }),
    ).toBe("Useful feedback");
  });

  it("strips markup from recommendation feedback", () => {
    expect(
      getEntityDisplayTitle({ feedback: "<p>Great mentor &amp; guide</p>" }),
    ).toBe("Great mentor & guide");
  });

  it("falls back to the parent journal title", () => {
    expect(
      getEntityDisplayTitle({ journal: { title: "Nature" }, feedback: "" }),
    ).toBe("Nature");
  });

  it("returns Untitled when nothing usable is present", () => {
    expect(getEntityDisplayTitle({})).toBe("Untitled");
    expect(getEntityDisplayTitle({ content: "<p></p>" })).toBe("Untitled");
  });
});
