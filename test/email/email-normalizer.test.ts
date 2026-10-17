import { describe, expect, it } from "vitest";

import {
  normalizeEmail,
  stripMailtoPrefix,
  validateEmailFormat,
} from "@/lib/email-normalizer";
import { validateExternalUrl } from "@/lib/external-url";
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

describe("stripMailtoPrefix", () => {
  it("strips chained / mixed-case mailto: prefixes idempotently", () => {
    expect(stripMailtoPrefix("hr@inst.edu")).toBe("hr@inst.edu");
    expect(stripMailtoPrefix("mailto:hr@inst.edu")).toBe("hr@inst.edu");
    expect(stripMailtoPrefix("mailto:mailto:hr@inst.edu")).toBe("hr@inst.edu");
    expect(stripMailtoPrefix("mailto:mailto:mailto:hr@inst.edu")).toBe(
      "hr@inst.edu",
    );
    expect(stripMailtoPrefix("MAILTO:mailto: hr@inst.edu ")).toBe(
      "hr@inst.edu",
    );
    // Idempotent: stripping twice === stripping once (no chaining possible).
    const once = stripMailtoPrefix("mailto:hr@inst.edu");
    expect(stripMailtoPrefix(once)).toBe(once);
  });
});

describe("validateExternalUrl with allowEmail (vacancy apply link)", () => {
  it("stores the bare email — never a mailto: prefix", () => {
    expect(validateExternalUrl("hr@inst.edu", "Apply link", undefined, true)).toBe(
      "hr@inst.edu",
    );
  });

  it("self-heals legacy / pasted mailto: values without chaining", () => {
    expect(
      validateExternalUrl("mailto:hr@inst.edu", "Apply link", undefined, true),
    ).toBe("hr@inst.edu");
    expect(
      validateExternalUrl(
        "mailto:mailto:mailto:hr@inst.edu",
        "Apply link",
        undefined,
        true,
      ),
    ).toBe("hr@inst.edu");
    // Re-saving the cleaned value is a no-op.
    expect(
      validateExternalUrl("hr@inst.edu", "Apply link", undefined, true),
    ).toBe("hr@inst.edu");
  });

  it("rejects invalid emails and still accepts https URLs", () => {
    expect(() =>
      validateExternalUrl("mailto:not-an-email", "Apply link", undefined, true),
    ).toThrow("must be a valid email address");
    expect(() =>
      validateExternalUrl("hr@inst", "Apply link", undefined, true),
    ).toThrow("must be a valid email address");
    expect(
      validateExternalUrl(
        "https://recruitment.portal/apply",
        "Apply link",
        undefined,
        true,
      ),
    ).toBe("https://recruitment.portal/apply");
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
