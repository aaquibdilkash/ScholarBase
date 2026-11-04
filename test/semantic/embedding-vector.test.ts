import { describe, expect, it } from "vitest";

import { EMBEDDING_DIMENSIONS, toVectorLiteral } from "@/lib/semantic/vector";

describe("toVectorLiteral", () => {
  it("formats exactly 384 finite values as a pgvector literal", () => {
    const vector = Array.from(
      { length: EMBEDDING_DIMENSIONS },
      (_, index) => index / 1000,
    );
    const literal = toVectorLiteral(vector);

    expect(literal.startsWith("[")).toBe(true);
    expect(literal.endsWith("]")).toBe(true);

    const parts = literal.slice(1, -1).split(",");
    expect(parts).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(parts[0]).toBe("0.000000");
    expect(parts[EMBEDDING_DIMENSIONS - 1]).toBe("0.383000");
  });

  it("keeps negative values and rounds to six decimals", () => {
    const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
    vector[0] = -0.123456789;
    vector[1] = 1.0000004;

    const parts = toVectorLiteral(vector).slice(1, -1).split(",");
    expect(parts[0]).toBe("-0.123457");
    expect(parts[1]).toBe("1.000000");
  });

  it("rejects the wrong dimensionality", () => {
    expect(() => toVectorLiteral([0.1, 0.2])).toThrow(
      /Expected a 384-dimensional embedding, received 2/,
    );
  });

  it("rejects non-finite values", () => {
    const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
    vector[3] = Number.NaN;

    expect(() => toVectorLiteral(vector)).toThrow(/index 3 is not finite/);

    vector[3] = Number.POSITIVE_INFINITY;
    expect(() => toVectorLiteral(vector)).toThrow(/index 3 is not finite/);
  });
});
