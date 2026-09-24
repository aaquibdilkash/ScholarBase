import { describe, expect, it } from "vitest";

import { buildSurveyPages } from "./pages";

function q(id: string, blockId: string | null = null) {
  return { id, blockId };
}

function block(id: string, order: number, title = id.toUpperCase()) {
  return { id, title, order };
}

function snapshot(pages: ReturnType<typeof buildSurveyPages>) {
  return pages.map((page) => ({
    title: page.title,
    sectionIndex: page.sectionIndex,
    sectionCount: page.sectionCount,
    questions: page.questions.map((question) => question.id),
  }));
}

describe("buildSurveyPages", () => {
  it("chunks section-free questions three per page when no sections exist", () => {
    const questions = [q("a"), q("b"), q("c"), q("d")];

    expect(snapshot(buildSurveyPages(questions, []))).toEqual([
      { title: null, sectionIndex: null, sectionCount: 0, questions: ["a", "b", "c"] },
      { title: null, sectionIndex: null, sectionCount: 0, questions: ["d"] },
    ]);
  });

  it("gives a whole page to each section, even a long one", () => {
    const questions = [q("a", "s1"), q("b", "s1"), q("c", "s1"), q("d", "s2")];
    const blocks = [block("s1", 0), block("s2", 1)];

    expect(snapshot(buildSurveyPages(questions, blocks))).toEqual([
      { title: "S1", sectionIndex: 1, sectionCount: 2, questions: ["a", "b", "c"] },
      { title: "S2", sectionIndex: 2, sectionCount: 2, questions: ["d"] },
    ]);
  });

  it("keeps General questions ahead of the first section page", () => {
    const questions = [q("a"), q("b"), q("c", "s1")];
    const blocks = [block("s1", 0)];

    expect(snapshot(buildSurveyPages(questions, blocks))).toEqual([
      { title: "General questions", sectionIndex: null, sectionCount: 1, questions: ["a", "b"] },
      { title: "S1", sectionIndex: 1, sectionCount: 1, questions: ["c"] },
    ]);
  });

  it("restarts a General page after a section instead of growing the old one", () => {
    const questions = [q("a"), q("b", "s1"), q("c")];
    const blocks = [block("s1", 0)];

    expect(snapshot(buildSurveyPages(questions, blocks))).toEqual([
      { title: "General questions", sectionIndex: null, sectionCount: 1, questions: ["a"] },
      { title: "S1", sectionIndex: 1, sectionCount: 1, questions: ["b"] },
      { title: "General questions", sectionIndex: null, sectionCount: 1, questions: ["c"] },
    ]);
  });

  it("starts a new section page when the same title belongs to another section", () => {
    const questions = [q("a", "s1"), q("b", "s2")];
    const blocks = [block("s1", 0, "Same"), block("s2", 1, "Same")];

    expect(snapshot(buildSurveyPages(questions, blocks))).toEqual([
      { title: "Same", sectionIndex: 1, sectionCount: 2, questions: ["a"] },
      { title: "Same", sectionIndex: 2, sectionCount: 2, questions: ["b"] },
    ]);
  });

  it("never drops questions or invents pages for an empty survey", () => {
    expect(buildSurveyPages([], [block("s1", 0)])).toEqual([]);
  });
});
