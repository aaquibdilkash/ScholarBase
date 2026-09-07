import type { SkipRule } from "@/types/survey";

/**
 * Shared survey evaluation logic. Imported by BOTH the client response form
 * (rendering-time visibility) and the server action (submit-time validation)
 * so the two implementations can never drift apart.
 */

export const SKIP_OPERATORS = ["equals", "not_equals", "includes"] as const;

export function parseSkipLogic(raw: unknown): SkipRule[] {
  if (!Array.isArray(raw)) return [];
  const rules: SkipRule[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === "object" &&
      SKIP_OPERATORS.includes((item as SkipRule).operator) &&
      typeof (item as SkipRule).value === "string" &&
      Number.isInteger((item as SkipRule).skipToOrder)
    ) {
      rules.push(item as SkipRule);
    }
  }
  return rules;
}

/** Parse persisted JSON column labels into a clean string array (client-safe). */
export function parseColumnLabels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

/** Evaluate a single skip rule against a stored answer value. */
export function ruleMatches(rule: SkipRule, answerValue: unknown): boolean {
  // Answers are stored either as a plain string or a JSON array (checkboxes).
  let values: string[];
  if (Array.isArray(answerValue)) {
    values = answerValue.map(String);
  } else if (typeof answerValue === "string") {
    try {
      const parsed = JSON.parse(answerValue);
      values = Array.isArray(parsed) ? parsed.map(String) : [answerValue];
    } catch {
      values = [answerValue];
    }
  } else {
    return false;
  }

  switch (rule.operator) {
    case "equals":
      return values.includes(rule.value);
    case "not_equals":
      return !values.includes(rule.value);
    case "includes":
      return values.some((v) => v.includes(rule.value));
  }
}

/**
 * Compute the set of question ids hidden by skip logic.
 * A rule lives on its trigger question; when it matches, every question
 * whose order is strictly between the trigger and rule.skipToOrder is
 * skipped (analyst-facing value: "not applicable", never "missing").
 */
export function computeSkippedQuestionIds(
  questions: Array<{ id: string; order: number; skipLogic?: unknown }>,
  getAnswerValue: (questionId: string) => unknown,
): Set<string> {
  const skipped = new Set<string>();
  for (const question of questions) {
    for (const rule of parseSkipLogic(question.skipLogic)) {
      if (ruleMatches(rule, getAnswerValue(question.id))) {
        for (const other of questions) {
          if (
            other.order > question.order &&
            other.order < rule.skipToOrder
          ) {
            skipped.add(other.id);
          }
        }
      }
    }
  }
  return skipped;
}

/** Deterministic PRNG (mulberry32) + Fisher-Yates shuffle. The seed is stored
 * on the response so the exact option order a respondent saw is
 * reconstructible at analysis time.
 */
export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let a = seed >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
