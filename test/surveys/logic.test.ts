/**
 * Skip logic and option randomization — the two pieces of survey logic that
 * decide what a respondent actually sees, and what the researcher gets back.
 *
 * This module had no tests at all, which is a specific kind of risk: both
 * halves are silent. A broken skip rule does not error, it just quietly drops
 * questions from the form AND mis-codes the affected answers on export. A
 * broken shuffle does not error either, it just quietly destroys the
 * order-bias control while still claiming in the codebook that options were
 * randomized.
 *
 * The properties pinned here, in order of blast radius:
 *
 *  1. `ruleMatches` reads every stored answer SHAPE. Answers arrive as a raw
 *     string, a JSON-encoded array (checkboxes), or a real array (once Prisma
 *     has parsed it). An operator that only understood one of those would make
 *     skip logic fire inconsistently depending on how the value was stored.
 *  2. `computeSkippedQuestionIds` must hide the half-open range
 *     (trigger.order, skipToOrder) — never the trigger itself, and never past
 *     the destination. An off-by-one here either re-shows a question the
 *     author meant to hide, or hides one they meant to keep.
 *  3. `seededShuffle` must be a PERMUTATION and must be REPRODUCIBLE. It is
 *     seeded from a value stored on the response row specifically so the exact
 *     order a respondent saw can be reconstructed at analysis time; that promise
 *     is void the moment the algorithm changes, which is why the golden
 *     permutations below are asserted verbatim.
 */
import { describe, expect, it } from "vitest";

import {
  computeSkippedQuestionIds,
  hashString,
  parseColumnLabels,
  parseSkipLogic,
  ruleMatches,
  seededShuffle,
  SKIP_OPERATORS,
} from "@/lib/surveys/logic";
import type { SkipRule } from "@/types/survey";

const rule = (over: Partial<SkipRule> = {}): SkipRule => ({
  operator: "equals",
  value: "cs",
  skipToOrder: 5,
  ...over,
});

describe("SKIP_OPERATORS", () => {
  it("is exactly the three operators the UI offers", () => {
    expect([...SKIP_OPERATORS]).toEqual(["equals", "not_equals", "includes"]);
  });
});

describe("parseSkipLogic", () => {
  it("returns an empty list for anything that is not an array", () => {
    // Persisted JSON can be null (no rules), or malformed. Neither may throw:
    // `computeSkippedQuestionIds` runs on every submission.
    expect(parseSkipLogic(null)).toEqual([]);
    expect(parseSkipLogic(undefined)).toEqual([]);
    expect(parseSkipLogic("nope")).toEqual([]);
    expect(parseSkipLogic(42)).toEqual([]);
    expect(parseSkipLogic({ operator: "equals" })).toEqual([]);
  });

  it("keeps well-formed rules", () => {
    const rules = [rule(), rule({ operator: "not_equals", value: "bio", skipToOrder: 7 })];
    expect(parseSkipLogic(rules)).toEqual(rules);
  });

  it("drops rules with an unknown operator", () => {
    // An unknown operator must not be trusted with a default: silently treating
    // it as `equals` would hide the wrong questions.
    expect(parseSkipLogic([rule({ operator: "regex" as never })])).toEqual([]);
  });

  it("drops rules with a non-string value", () => {
    expect(parseSkipLogic([rule({ value: 7 as never })])).toEqual([]);
  });

  it("drops rules whose skipToOrder is not an integer", () => {
    expect(parseSkipLogic([rule({ skipToOrder: 2.5 })])).toEqual([]);
    expect(parseSkipLogic([rule({ skipToOrder: NaN })])).toEqual([]);
    expect(parseSkipLogic([rule({ skipToOrder: "3" as never })])).toEqual([]);
  });

  it("drops non-object entries instead of throwing on them", () => {
    expect(parseSkipLogic([null, "x", 5, rule()])).toEqual([rule()]);
  });

  it("does not mutate the rules it is given", () => {
    const input = [rule()];
    parseSkipLogic(input);
    expect(input).toEqual([rule()]);
  });
});

describe("parseColumnLabels", () => {
  it("keeps only strings", () => {
    expect(parseColumnLabels(["Poor", "Fair", 3, null, "Good"])).toEqual([
      "Poor",
      "Fair",
      "Good",
    ]);
  });

  it("returns an empty array for a non-array", () => {
    expect(parseColumnLabels(null)).toEqual([]);
    expect(parseColumnLabels("Poor")).toEqual([]);
  });
});

describe("ruleMatches — every stored answer shape", () => {
  it("matches a plain string answer", () => {
    expect(ruleMatches(rule(), "cs")).toBe(true);
    expect(ruleMatches(rule(), "bio")).toBe(false);
  });

  it("matches a JSON-encoded array answer (checkboxes as stored)", () => {
    // The server stores a multi-select as a JSON string until Prisma parses it.
    expect(ruleMatches(rule(), JSON.stringify(["cs", "bio"]))).toBe(true);
    expect(ruleMatches(rule(), JSON.stringify(["math"]))).toBe(false);
  });

  it("matches a real array answer (already parsed by Prisma)", () => {
    expect(ruleMatches(rule(), ["cs", "bio"])).toBe(true);
    expect(ruleMatches(rule(), ["math"])).toBe(false);
  });

  it("matches an empty selection as no match", () => {
    // A checkbox group with nothing ticked must not satisfy `equals`.
    expect(ruleMatches(rule(), "[]")).toBe(false);
    expect(ruleMatches(rule(), [])).toBe(false);
  });

  it("compares by substring for `includes`, not equality", () => {
    expect(ruleMatches(rule({ operator: "includes", value: "cs" }), "csc")).toBe(true);
    expect(ruleMatches(rule({ operator: "includes", value: "cs" }), "biology")).toBe(false);
    expect(
      ruleMatches(rule({ operator: "includes", value: "cs" }), JSON.stringify(["x", "cs"])),
    ).toBe(true);
  });

  it("inverts correctly for `not_equals`", () => {
    expect(ruleMatches(rule({ operator: "not_equals", value: "cs" }), "bio")).toBe(true);
    expect(ruleMatches(rule({ operator: "not_equals", value: "cs" }), "cs")).toBe(false);
  });

  it("never matches an unanswered question, whatever the operator", () => {
    // This is the important one. `not_equals` on a MISSING answer must not fire:
    // a question the respondent skipped is not a statement of "not cs", and
    // treating it as one would hide follow-ups nobody opted into.
    for (const operator of SKIP_OPERATORS) {
      expect(ruleMatches(rule({ operator }), undefined), operator).toBe(false);
      expect(ruleMatches(rule({ operator }), null), operator).toBe(false);
    }
  });

  it("never matches a numeric answer", () => {
    // RATING and LINEAR_SCALE answers can arrive as numbers; only string-shaped
    // values are comparable against an option value.
    expect(ruleMatches(rule(), 3)).toBe(false);
    expect(ruleMatches(rule({ operator: "not_equals" }), 3)).toBe(false);
  });

  it("treats a numeric-looking string as its own text, not as a JSON number", () => {
    // A SHORT_TEXT answer of `123` is stored as the STRING "123". `JSON.parse`
    // succeeds on it and yields a number, so the code must fall back to the
    // original string rather than compare against 123 — otherwise a numeric-text
    // question could never match a skip rule keyed on its own text.
    expect(ruleMatches(rule({ value: "123" }), "123")).toBe(true);
    expect(ruleMatches(rule({ value: "123" }), '"123"')).toBe(false);
  });

  it("treats a JSON-quoted string as its literal text", () => {
    // `"cs"` (with quotes) parses to the string "cs", so it is NOT an array and
    // the original quoted text is what gets compared.
    expect(ruleMatches(rule(), '"cs"')).toBe(false);
  });

  it("stringifies non-string array members", () => {
    expect(ruleMatches(rule({ value: "3" }), [3])).toBe(true);
  });
});

describe("computeSkippedQuestionIds", () => {
  /** q1..q5 at orders 0..4. */
  const questions = [0, 1, 2, 3, 4].map((order) => ({
    id: `q${order + 1}`,
    order,
    skipLogic: null as unknown,
  }));

  const byId = (values: Record<string, unknown>) => (id: string) => values[id];

  it("returns nothing when no question declares a rule", () => {
    const skipped = computeSkippedQuestionIds(questions, () => undefined);
    expect([...skipped]).toEqual([]);
  });

  it("hides the questions strictly between the trigger and the destination", () => {
    // q1 (order 0) skips to order 4, so orders 1, 2 and 3 are hidden.
    const withRule = [{ ...questions[0], skipLogic: [rule({ skipToOrder: 4 })] }, ...questions.slice(1)];
    const skipped = computeSkippedQuestionIds(withRule, byId({ q1: "cs" }));

    expect([...skipped].sort()).toEqual(["q2", "q3", "q4"]);
  });

  it("never hides the trigger question itself", () => {
    const withRule = [{ ...questions[0], skipLogic: [rule({ skipToOrder: 4 })] }, ...questions.slice(1)];
    expect(computeSkippedQuestionIds(withRule, byId({ q1: "cs" })).has("q1")).toBe(false);
  });

  it("never hides the destination question", () => {
    // Order 4 IS the destination, so the half-open range excludes it.
    const withRule = [{ ...questions[0], skipLogic: [rule({ skipToOrder: 4 })] }, ...questions.slice(1)];
    expect(computeSkippedQuestionIds(withRule, byId({ q1: "cs" })).has("q5")).toBe(false);
  });

  it("hides nothing when the destination immediately follows the trigger", () => {
    // The empty range (order 0 -> 1) is a legitimate no-op rule.
    const withRule = [{ ...questions[0], skipLogic: [rule({ skipToOrder: 1 })] }, ...questions.slice(1)];
    expect([...computeSkippedQuestionIds(withRule, byId({ q1: "cs" }))]).toEqual([]);
  });

  it("hides nothing when the rule does not match", () => {
    const withRule = [{ ...questions[0], skipLogic: [rule({ skipToOrder: 4 })] }, ...questions.slice(1)];
    expect([...computeSkippedQuestionIds(withRule, byId({ q1: "bio" }))]).toEqual([]);
  });

  it("hides nothing when the trigger is unanswered", () => {
    const withRule = [{ ...questions[0], skipLogic: [rule({ skipToOrder: 4 })] }, ...questions.slice(1)];
    expect([...computeSkippedQuestionIds(withRule, () => undefined)]).toEqual([]);
  });

  it("unions the ranges of several matching triggers", () => {
    const withRules = [
      { ...questions[0], skipLogic: [rule({ skipToOrder: 2 })] },
      { ...questions[1], skipLogic: [rule({ value: "bio", skipToOrder: 4 })] },
      ...questions.slice(2),
    ];
    // q1 -> order 2 hides order 1; q2 -> order 4 hides orders 2 and 3.
    const skipped = computeSkippedQuestionIds(withRules, byId({ q1: "cs", q2: "bio" }));
    expect([...skipped].sort()).toEqual(["q2", "q3", "q4"]);
  });

  it("ignores a malformed rule rather than hiding anything", () => {
    const withRule = [
      { ...questions[0], skipLogic: [{ operator: "regex", value: "cs", skipToOrder: 4 }] },
      ...questions.slice(1),
    ];
    expect([...computeSkippedQuestionIds(withRule, byId({ q1: "cs" }))]).toEqual([]);
  });

  it("stays consistent with what submitSurveyResponse prunes", () => {
    // The server prunes answers to hidden questions, and the export codes those
    // cells NA_SKIPPED. Both read the same helper, so the client-side hidden set
    // and the server-side pruned set are identical by construction — this asserts
    // the boundary that the two must agree on.
    const withRule = [{ ...questions[0], skipLogic: [rule({ skipToOrder: 3 })] }, ...questions.slice(1)];
    const hidden = computeSkippedQuestionIds(withRule, byId({ q1: "cs" }));
    const answered = { q1: "cs", q2: "x", q3: "y", q4: "z" };
    const surviving = Object.keys(answered).filter((id) => !hidden.has(id));

    expect(surviving.sort()).toEqual(["q1", "q4"]);
  });
});

describe("hashString", () => {
  // FNV-1a. These are GOLDEN values: the algorithm feeds the seed stored on each
  // response, so changing it would make the option order of every already
  // collected response unreconstructible. Any edit here is a data-integrity
  // change, not a refactor.
  it("produces the documented FNV-1a values", () => {
    expect(hashString("")).toBe(2166136261);
    expect(hashString("a")).toBe(3826002220);
    expect(hashString("abc")).toBe(440920331);
  });

  it("always returns an unsigned 32-bit integer", () => {
    for (const input of ["", "a", "response-id-12345", "é", "🎓", "x".repeat(500)]) {
      const hash = hashString(input);
      expect(Number.isInteger(hash), input).toBe(true);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it("is deterministic", () => {
    expect(hashString("resp1")).toBe(hashString("resp1"));
  });

  it("separates different inputs", () => {
    expect(hashString("resp1")).not.toBe(hashString("resp2"));
  });
});

describe("seededShuffle", () => {
  const items = ["a", "b", "c", "d", "e"];

  it("reproduces the exact recorded order for a given seed", () => {
    // The reconstruction promise: a researcher handed this seed must see the
    // same order the respondent saw. These permutations are golden.
    expect(seededShuffle(items, 12345)).toEqual(["a", "c", "d", "b", "e"]);
    expect(seededShuffle(items, 999)).toEqual(["d", "b", "a", "c", "e"]);
  });

  it("is stable across repeated calls with the same seed", () => {
    expect(seededShuffle(items, 12345)).toEqual(seededShuffle(items, 12345));
  });

  it("derives the seed from a response id via hashString", () => {
    // The production path: seed = hashString(something stable about the response).
    expect(seededShuffle(items, hashString("resp1"))).toEqual(
      seededShuffle(items, hashString("resp1")),
    );
  });

  it("is a permutation — nothing lost, nothing duplicated", () => {
    for (const seed of [1, 7, 12345, 999, 2 ** 31 - 1]) {
      const shuffled = seededShuffle(items, seed);
      expect(shuffled, `seed ${seed}`).toHaveLength(items.length);
      expect([...shuffled].sort(), `seed ${seed}`).toEqual([...items].sort());
    }
  });

  it("never mutates the input array", () => {
    const original = [...items];
    seededShuffle(items, 12345);
    expect(items).toEqual(original);
  });

  it("actually reorders for at least some seeds", () => {
    // A shuffle that silently returned the input would satisfy every other
    // assertion here while destroying the order-bias control entirely.
    const reordered = [1, 2, 3, 4, 5, 6, 7, 8].some(
      (seed) => seededShuffle(items, seed).join() !== items.join(),
    );
    expect(reordered).toBe(true);
  });

  it("handles degenerate inputs", () => {
    expect(seededShuffle([], 42)).toEqual([]);
    expect(seededShuffle(["only"], 42)).toEqual(["only"]);
  });

  it("spreads different seeds across different orders", () => {
    const orders = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((seed) =>
        seededShuffle(items, seed).join(),
      ),
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it("shuffles values, not positions, so duplicates survive intact", () => {
    // Two identical options must not be collapsed: the respondent still saw two
    // rows, and the count of answers must match the count of options.
    expect(seededShuffle(["x", "x", "y"], 7)).toHaveLength(3);
  });
});
