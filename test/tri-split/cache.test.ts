import { describe, expect, it } from "vitest";

import { LIST_REVALIDATE_MS } from "@/components/layout/listPage";
import {
  LIST_PAGE_SIZE_DEFAULT,
  LIST_PAGE_SIZE_MAX,
  LIST_REVALIDATE_SECONDS,
  normalizePageSize,
  serializeDates,
} from "@/lib/tri-split";

describe("the client and server list caches expire together", () => {
  it("use the same TTL", () => {
    // The client `staleTime` and the server `revalidate` are stated separately —
    // the server constant cannot be imported into a client bundle because it
    // pulls in `next/cache`. They must still describe the same window, or a
    // client entry could be considered fresh while the rows behind it had
    // already been regenerated.
    expect(LIST_REVALIDATE_MS).toBe(LIST_REVALIDATE_SECONDS * 1000);
  });

  it("is five minutes", () => {
    // A restatement, not a derivation: if the TTL is ever deliberately changed,
    // this is the reminder that the client half has to move with it.
    expect(LIST_REVALIDATE_SECONDS).toBe(5 * 60);
  });
});

describe("normalizePageSize", () => {
  it("falls back to the default for missing or non-finite input", () => {
    expect(normalizePageSize(undefined)).toBe(LIST_PAGE_SIZE_DEFAULT);
    expect(normalizePageSize(Number.NaN)).toBe(LIST_PAGE_SIZE_DEFAULT);
    expect(normalizePageSize(Number.POSITIVE_INFINITY)).toBe(
      LIST_PAGE_SIZE_DEFAULT,
    );
  });

  it("clamps into the cache-key-safe range", () => {
    expect(normalizePageSize(0)).toBe(1);
    expect(normalizePageSize(-25)).toBe(1);
    expect(normalizePageSize(1_000)).toBe(LIST_PAGE_SIZE_MAX);
  });

  it("truncates fractional page sizes and passes valid ones through", () => {
    expect(normalizePageSize(7.9)).toBe(7);
    expect(normalizePageSize(20)).toBe(20);
  });
});

describe("serializeDates", () => {
  it("converts declared Date columns to ISO strings", () => {
    const created = new Date("2026-01-02T03:04:05.000Z");
    const row = serializeDates({ id: "p1", createdAt: created }, ["createdAt"]);

    expect(row.createdAt).toBe("2026-01-02T03:04:05.000Z");
    expect(typeof row.createdAt).toBe("string");
  });

  it("normalises null/undefined date columns to null", () => {
    const row = serializeDates({ id: "p1", editedAt: null }, ["editedAt"]);
    expect(row.editedAt).toBeNull();
  });

  it("leaves the row untouched when no date keys are declared", () => {
    const created = new Date("2026-01-02T03:04:05.000Z");
    const row = serializeDates({ id: "p1", createdAt: created }, []);
    expect(row.createdAt).toBe(created);
  });

  it("does not mutate the input row", () => {
    const row = { id: "p1", createdAt: new Date("2026-01-02T03:04:05.000Z") };
    serializeDates(row, ["createdAt"]);
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  it("leaves absent keys absent rather than stamping them null", () => {
    // Regression guard. Several modules (supervisors, events, admissions) do
    // not select `updatedAt`/`editedAt`. An earlier version wrote `null` for
    // any declared key that was missing, which injected two fields the
    // projection never asked for and changed the cached payload shape.
    const row = { id: "p1", createdAt: new Date("2026-01-02T03:04:05.000Z") };
    const out = serializeDates(row, ["createdAt", "updatedAt", "editedAt"]);

    expect(out).not.toHaveProperty("updatedAt");
    expect(out).not.toHaveProperty("editedAt");
    expect(Object.keys(out).sort()).toEqual(["createdAt", "id"]);
  });

  it("preserves a null date that IS present on the row", () => {
    const out = serializeDates(
      { id: "p1", createdAt: new Date(), editedAt: null },
      ["createdAt", "editedAt"],
    );
    expect(out.editedAt).toBeNull();
  });
});
