/**
 * The manuscript state machine.
 *
 * The exhaustive sweep matters more than the named cases: a new status added to
 * the Prisma enum without an entry here would otherwise compile (the `Record`
 * catches it) but an accidental new edge would not. Asserting the full
 * status-by-status matrix means any widening of the graph fails loudly.
 */
import { describe, expect, it } from "vitest";
import type { ManuscriptStatus } from "@prisma/client";

import {
  MANUSCRIPT_TRANSITIONS,
  TERMINAL_MANUSCRIPT_STATUSES,
  canTransition,
  isTerminalStatus,
  nextStatuses,
} from "@/lib/publishing/transitions";

const ALL_STATUSES = Object.keys(MANUSCRIPT_TRANSITIONS) as ManuscriptStatus[];

describe("MANUSCRIPT_TRANSITIONS", () => {
  it("covers every status exactly once", () => {
    expect(new Set(ALL_STATUSES).size).toBe(ALL_STATUSES.length);
    expect(ALL_STATUSES.length).toBe(9);
  });

  it("matches the full matrix", () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        expect(canTransition(from, to), `${from} -> ${to}`).toBe(
          MANUSCRIPT_TRANSITIONS[from].includes(to),
        );
      }
    }
  });

  it("never allows a self-transition", () => {
    for (const status of ALL_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it("routes review through the expected decision set", () => {
    expect([...nextStatuses("UNDER_REVIEW")].sort()).toEqual(
      ["ACCEPTED_JOURNAL", "ACCEPTED_PROCEDINGS", "REJECTED", "REVISION_REQUIRED"].sort(),
    );
  });

  it("allows resubmission only from REVISION_REQUIRED", () => {
    expect(canTransition("REVISION_REQUIRED", "UNDER_REVIEW")).toBe(true);
    expect(canTransition("SUBMITTED", "UNDER_REVIEW")).toBe(true);
    expect(canTransition("REJECTED", "UNDER_REVIEW")).toBe(false);
    expect(canTransition("DESK_REJECTED", "UNDER_REVIEW")).toBe(false);
    expect(canTransition("WITHDRAWN", "UNDER_REVIEW")).toBe(false);
  });

  it("cannot publish without an acceptance", () => {
    for (const from of ALL_STATUSES) {
      if (from === "ACCEPTED_JOURNAL" || from === "ACCEPTED_PROCEDINGS") continue;
      expect(canTransition(from, "PUBLISHED"), `${from} -> PUBLISHED`).toBe(false);
    }
    expect(canTransition("ACCEPTED_JOURNAL", "PUBLISHED")).toBe(true);
    expect(canTransition("ACCEPTED_PROCEDINGS", "PUBLISHED")).toBe(true);
  });

  it("lets an author withdraw before acceptance but not from a decision", () => {
    expect(canTransition("SUBMITTED", "WITHDRAWN")).toBe(true);
    expect(canTransition("REVISION_REQUIRED", "WITHDRAWN")).toBe(true);
    expect(canTransition("ACCEPTED_JOURNAL", "WITHDRAWN")).toBe(false);
    expect(canTransition("PUBLISHED", "WITHDRAWN")).toBe(false);
  });
});

describe("terminal statuses", () => {
  it("declares exactly the statuses with no outgoing edge", () => {
    const derived = ALL_STATUSES.filter((status) => MANUSCRIPT_TRANSITIONS[status].length === 0);
    expect([...TERMINAL_MANUSCRIPT_STATUSES].sort()).toEqual(derived.sort());
  });

  it("reports terminal status consistently with the graph", () => {
    for (const status of ALL_STATUSES) {
      expect(isTerminalStatus(status)).toBe(MANUSCRIPT_TRANSITIONS[status].length === 0);
    }
  });
});
