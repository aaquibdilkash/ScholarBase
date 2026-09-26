import { describe, expect, it } from "vitest";

import { normalizeEmail, validateEmailFormat } from "@/lib/email-normalizer";
import { isAllowedEmailDomain } from "@/lib/email-domain-allowlist";

describe("normalizeEmail", () => {
  it("normalizes provider aliases and preserves non-Gmail dots", () => {
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
      expect(normalizeEmail(input)).toBe(expected);
      expect(validateEmailFormat(normalizeEmail(input))).toBe(true);
    }
  });
});

describe("validateEmailFormat", () => {
  it("rejects malformed email addresses", () => {
    const invalidEmails = [
      "",
      "student",
      "student@",
      "@university.edu",
      "student@@university.edu",
      "student university.edu",
    ];

    for (const email of invalidEmails) {
      expect(validateEmailFormat(normalizeEmail(email))).toBe(false);
    }
  });
});

describe("isAllowedEmailDomain", () => {
  it("enforces the signup domain allowlist", () => {
    expect(isAllowedEmailDomain("researcher@gmail.com")).toBe(true);
    expect(isAllowedEmailDomain("faculty@jmi.ac.in")).toBe(true);
    expect(isAllowedEmailDomain("faculty@29mayis.edu.tr")).toBe(true);
    expect(isAllowedEmailDomain("faculty@othercollege.ac.in")).toBe(true);
    expect(isAllowedEmailDomain("faculty@email.evil.ac.in")).toBe(true);
    expect(isAllowedEmailDomain("mail@ac.in")).toBe(false);
    expect(isAllowedEmailDomain("faculty@unknown.edu")).toBe(true);
    expect(isAllowedEmailDomain("researcher@private-research-lab.org")).toBe(false);
    expect(isAllowedEmailDomain("person@fake.edu.example.com")).toBe(false);
  });
});
