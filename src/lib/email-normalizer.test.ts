import { strict as assert } from "node:assert";
import { test } from "node:test";

// Node's built-in type stripping loads the TypeScript module directly.
// @ts-expect-error TypeScript's bundler resolution does not allow the runtime .ts extension.
import { normalizeEmail, validateEmailFormat } from "./email-normalizer.ts";
// @ts-expect-error Node's built-in type stripping loads the TypeScript module directly.
import { isAllowedEmailDomain } from "./email-domain-allowlist.ts";

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

test("enforces the signup domain allowlist", () => {
  assert.equal(isAllowedEmailDomain("researcher@gmail.com"), true);
  assert.equal(isAllowedEmailDomain("faculty@jmi.ac.in"), true);
  assert.equal(isAllowedEmailDomain("faculty@29mayis.edu.tr"), true);
  assert.equal(isAllowedEmailDomain("faculty@othercollege.ac.in"), true);
  assert.equal(isAllowedEmailDomain("faculty@email.evil.ac.in"), true);
  assert.equal(isAllowedEmailDomain("mail@ac.in"), false);
  assert.equal(isAllowedEmailDomain("faculty@unknown.edu"), true);
  assert.equal(isAllowedEmailDomain("researcher@private-research-lab.org"), false);
  assert.equal(isAllowedEmailDomain("person@fake.edu.example.com"), false);
});
