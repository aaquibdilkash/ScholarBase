import { strict as assert } from "node:assert";
import { test } from "node:test";

// Node's built-in type stripping loads the TypeScript module directly.
// @ts-expect-error TypeScript's bundler resolution does not allow the runtime .ts extension.
import { normalizeEmail, validateEmailFormat } from "./email-normalizer.ts";

test("normalizes provider aliases and preserves non-Gmail dots", () => {
  const cases = [
    ["John.Doe@Gmail.com", "johndoe@gmail.com"],
    ["j.o.h.n.d.o.e@gmail.com", "johndoe@gmail.com"],
    ["john.doe+scholarbase@gmail.com", "johndoe@gmail.com"],
    ["researcher+alert@googlemail.com", "researcher@gmail.com"],
    ["scholar.name+test@outlook.com", "scholar.name@outlook.com"],
    ["faculty+lab@university.edu", "faculty@university.edu"],
    [" student@jmi.ac.in ", "student@jmi.ac.in"],
  ] as const;

  for (const [input, expected] of cases) {
    assert.equal(normalizeEmail(input), expected);
    assert.equal(validateEmailFormat(normalizeEmail(input)), true);
  }
});

test("rejects malformed email addresses", () => {
  const invalidEmails = [
    "",
    "student",
    "student@",
    "@university.edu",
    "student@@university.edu",
    "student university.edu",
  ];

  for (const email of invalidEmails) {
    assert.equal(validateEmailFormat(normalizeEmail(email)), false);
  }
});
