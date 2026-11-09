import { describe, expect, it } from "vitest";

import {
  assignOutreachVariants,
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

describe("assignOutreachVariants", () => {
  it("returns one template per recipient", () => {
    expect(assignOutreachVariants(4)).toHaveLength(4);
    expect(assignOutreachVariants(0)).toEqual([]);
  });

  it("gives every recipient a different template until the pool is exhausted", () => {
    const variants = assignOutreachVariants(SCHOLAR_OUTREACH_VARIANTS.length);
    const subjects = new Set(variants.map((variant) => variant.subject));

    expect(variants).toHaveLength(SCHOLAR_OUTREACH_VARIANTS.length);
    expect(subjects.size).toBe(SCHOLAR_OUTREACH_VARIANTS.length);
  });

  it("never repeats the template across a reshuffle boundary", () => {
    const count = SCHOLAR_OUTREACH_VARIANTS.length + 1;
    const variants = assignOutreachVariants(count);

    expect(variants).toHaveLength(count);
    expect(variants[count - 1]!.subject).not.toBe(variants[count - 2]!.subject);
  });

  it("uses the injected random source", () => {
    const makeRandom = () => {
      const sequence = [0.1, 0.9, 0.4, 0.7, 0.2, 0.5, 0.8, 0.3, 0.6];
      let cursor = 0;
      return () => sequence[cursor++ % sequence.length]!;
    };

    expect(assignOutreachVariants(5, makeRandom())).toEqual(
      assignOutreachVariants(5, makeRandom()),
    );
  });
});
