import { describe, expect, it } from "vitest";

import {
  getQuestionPosition,
  moveQuestion,
  moveQuestionToSection,
  moveSection,
  normalizeSurveyStructure,
  placeQuestion,
} from "./structure";
import type { BlockInput, Question } from "@/types/survey";

function q(id: string, blockId: string | null = null): Question {
  return {
    id,
    type: "SHORT_TEXT",
    title: id,
    required: false,
    order: 0,
    blockId,
    options: [],
  };
}

function block(id: string, order: number): BlockInput {
  return { id, title: id.toUpperCase(), order, randomizeOrder: false };
}

/** Readable snapshot of ordering + section membership. */
function layout(questions: Question[]): string[] {
  return questions.map(
    (question) =>
      `${question.id}@${question.blockId ?? "general"}`,
  );
}

describe("normalizeSurveyStructure", () => {
  it("puts General first and sections in block order, with dense order values", () => {
    const result = normalizeSurveyStructure(
      [q("a", "s2"), q("b"), q("c", "s1")],
      [block("s2", 1), block("s1", 0)],
    );

    expect(layout(result.questions)).toEqual([
      "b@general",
      "c@s1",
      "a@s2",
    ]);
    expect(result.questions.map((x) => x.order)).toEqual([0, 1, 2]);
    expect(result.blocks.map((x) => x.id)).toEqual(["s1", "s2"]);
    expect(result.blocks.map((x) => x.order)).toEqual([0, 1]);
  });

  it("re-lays out interleaved sections into contiguous runs", () => {
    const result = normalizeSurveyStructure(
      [q("a", "s1"), q("b", "s2"), q("c", "s1"), q("d", "s2")],
      [block("s1", 0), block("s2", 1)],
    );

    expect(layout(result.questions)).toEqual([
      "a@s1",
      "c@s1",
      "b@s2",
      "d@s2",
    ]);
  });

  it("clears block references that no longer exist", () => {
    const result = normalizeSurveyStructure(
      [q("a", "ghost"), q("b", "s1")],
      [block("s1", 0)],
    );

    expect(layout(result.questions)).toEqual(["a@general", "b@s1"]);
  });

  it("never drops questions", () => {
    const result = normalizeSurveyStructure(
      [q("a"), q("b", "s1"), q("c")],
      [block("s1", 0)],
    );

    expect(result.questions).toHaveLength(3);
  });
});

describe("moveQuestion (arrows)", () => {
  it("swaps within the same section", () => {
    const result = moveQuestion(
      [q("a", "s1"), q("b", "s1")],
      [block("s1", 0)],
      "a",
      "down",
    );

    expect(result.moved).toBe(true);
    expect(layout(result.questions)).toEqual(["b@s1", "a@s1"]);
  });

  it("drops the last question of a section into the next section", () => {
    const result = moveQuestion(
      [q("a", "s1"), q("b", "s1"), q("c", "s2"), q("d", "s2")],
      [block("s1", 0), block("s2", 1)],
      "b",
      "down",
    );

    expect(result.moved).toBe(true);
    expect(layout(result.questions)).toEqual([
      "a@s1",
      "c@s2",
      "b@s2",
      "d@s2",
    ]);
  });

  it("lifts the first question of a section into the previous section", () => {
    const result = moveQuestion(
      [q("a", "s1"), q("b", "s1"), q("c", "s2")],
      [block("s1", 0), block("s2", 1)],
      "c",
      "up",
    );

    expect(result.moved).toBe(true);
    expect(layout(result.questions)).toEqual([
      "a@s1",
      "c@s1",
      "b@s1",
    ]);
  });

  it("refuses to move past the start or end of the survey", () => {
    expect(moveQuestion([q("a"), q("b")], [], "a", "up").moved).toBe(false);
    expect(moveQuestion([q("a"), q("b")], [], "b", "down").moved).toBe(false);
  });

  it("moves a General question into the first section", () => {
    const result = moveQuestion(
      [q("a"), q("b", "s1")],
      [block("s1", 0)],
      "a",
      "down",
    );

    expect(layout(result.questions)).toEqual(["b@s1", "a@s1"]);
  });

  it("moves a section question back into General", () => {
    const result = moveQuestion(
      [q("a"), q("b", "s1")],
      [block("s1", 0)],
      "b",
      "up",
    );

    expect(result.moved).toBe(true);
    expect(layout(result.questions)).toEqual(["b@general", "a@general"]);
  });
});

describe("moveSection", () => {
  it("carries the whole run of questions when a section moves", () => {
    const result = moveSection(
      [q("a", "s1"), q("b", "s1"), q("c", "s2")],
      [block("s1", 0), block("s2", 1)],
      "s2",
      "up",
    );

    expect(result.moved).toBe(true);
    expect(result.blocks.map((x) => x.id)).toEqual(["s2", "s1"]);
    expect(layout(result.questions)).toEqual([
      "c@s2",
      "a@s1",
      "b@s1",
    ]);
  });

  it("refuses to move a section past either boundary", () => {
    const questions = [q("a", "s1"), q("b", "s2")];
    const blocks = [block("s1", 0), block("s2", 1)];

    expect(moveSection(questions, blocks, "s1", "up").moved).toBe(false);
    expect(moveSection(questions, blocks, "s2", "down").moved).toBe(false);
  });
});

describe("moveQuestionToSection", () => {
  it("appends the question to the end of the target section", () => {
    const result = moveQuestionToSection(
      [q("a", "s1"), q("b", "s2")],
      [block("s1", 0), block("s2", 1)],
      "a",
      "s2",
    );

    expect(result.moved).toBe(true);
    expect(layout(result.questions)).toEqual(["b@s2", "a@s2"]);
  });

  it("keeps sections contiguous when pulling a question from the middle", () => {
    const result = moveQuestionToSection(
      [q("a", "s1"), q("b", "s1"), q("c", "s1"), q("d", "s2")],
      [block("s1", 0), block("s2", 1)],
      "b",
      "s2",
    );

    expect(layout(result.questions)).toEqual([
      "a@s1",
      "c@s1",
      "d@s2",
      "b@s2",
    ]);
  });

  it("places a question into a section that has no questions yet", () => {
    const result = moveQuestionToSection(
      [q("a", "s1"), q("b", "s1")],
      [block("s1", 0), block("s2", 1)],
      "a",
      "s2",
    );

    expect(result.moved).toBe(true);
    expect(layout(result.questions)).toEqual(["b@s1", "a@s2"]);
  });

  it("moves a question back to General", () => {
    const result = moveQuestionToSection(
      [q("a", "s1"), q("b", "s1")],
      [block("s1", 0)],
      "b",
      null,
    );

    expect(layout(result.questions)).toEqual(["b@general", "a@s1"]);
  });
});

describe("placeQuestion (drag and drop)", () => {
  it("inserts at the requested index inside the target section", () => {
    const result = placeQuestion(
      [q("a", "s1"), q("b", "s1"), q("c", "s2")],
      [block("s1", 0), block("s2", 1)],
      "c",
      "s1",
      0,
    );

    expect(result.moved).toBe(true);
    expect(layout(result.questions)).toEqual([
      "c@s1",
      "a@s1",
      "b@s1",
    ]);
  });

  it("reports no movement for a no-op drop", () => {
    const result = placeQuestion(
      [q("a", "s1"), q("b", "s1")],
      [block("s1", 0)],
      "a",
      "s1",
      0,
    );

    expect(result.moved).toBe(false);
  });
});

describe("getQuestionPosition", () => {
  it("flags section boundaries", () => {
    const questions = [q("a", "s1"), q("b", "s1"), q("c", "s2")];

    expect(getQuestionPosition(questions, "a")).toMatchObject({
      isFirst: true,
      isFirstInSection: true,
      isLastInSection: false,
    });
    expect(getQuestionPosition(questions, "b")).toMatchObject({
      isFirst: false,
      isFirstInSection: false,
      isLast: false,
      isLastInSection: true,
    });
    expect(getQuestionPosition(questions, "c")).toMatchObject({
      isFirstInSection: true,
      isLast: true,
      isLastInSection: true,
    });
    expect(getQuestionPosition(questions, "missing")).toBeNull();
  });
});
