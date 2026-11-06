import { describe, expect, it } from "vitest";

import {
  SCHOLAR_OUTREACH_VARIANTS,
  pickScholarOutreachVariant,
} from "@/lib/emails/scholarInvite";

describe("pickScholarOutreachVariant", () => {
  it("is deterministic for the same recipient and offset", () => {
    expect(pickScholarOutreachVariant("jane@university.edu", 0)).toEqual(
      pickScholarOutreachVariant("jane@university.edu", 0),
    );
  });

  it("advances to another variant when the offset increases", () => {
    const first = pickScholarOutreachVariant("jane@university.edu", 0);
    const second = pickScholarOutreachVariant("jane@university.edu", 1);

    expect(second.subject).not.toBe(first.subject);
  });

  it("spreads different recipients across variants", () => {
    const subjects = new Set(
      ["a@x.edu", "b@x.edu", "c@x.edu", "d@x.edu", "e@x.edu"].map(
        (email) => pickScholarOutreachVariant(email).subject,
      ),
    );

    expect(subjects.size).toBeGreaterThan(1);
  });

  it("always returns a known variant", () => {
    expect(SCHOLAR_OUTREACH_VARIANTS).toContainEqual(
      pickScholarOutreachVariant("someone@university.edu", 7),
    );
  });
});
