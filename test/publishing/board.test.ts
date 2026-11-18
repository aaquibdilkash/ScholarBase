/**
 * Decision board rules.
 *
 * The board is a second surface over the editorial state machine, so the risk is
 * that it offers a move the state machine does not allow. These tests pin the
 * column mapping and the deliberately tiny set of one-click moves.
 */
import { describe, expect, it } from "vitest";

import {
  BOARD_COLUMNS,
  BOARD_STATUSES,
  boardColumnFor,
  quickBoardMoves,
} from "@/lib/publishing/board";

const EIC = { roles: ["EDITOR_IN_CHIEF"] as const };
const ASSOC = { roles: ["ASSOC_EDITOR"] as const };
const CHAIR = { roles: ["TRACK_CHAIR"] as const };
const ADMIN = { roles: [], isAdmin: true };

describe("board columns", () => {
  it("maps every visible status to exactly one column", () => {
    expect(boardColumnFor("SUBMITTED")?.key).toBe("SUBMITTED");
    expect(boardColumnFor("UNDER_REVIEW")?.key).toBe("UNDER_REVIEW");
    expect(boardColumnFor("REVISION_REQUIRED")?.key).toBe("REVISION_REQUIRED");
    expect(boardColumnFor("ACCEPTED_JOURNAL")?.key).toBe("ACCEPTED");
    expect(boardColumnFor("ACCEPTED_PROCEDINGS")?.key).toBe("ACCEPTED");
    expect(boardColumnFor("REJECTED")?.key).toBe("DECLINED");
    expect(boardColumnFor("DESK_REJECTED")?.key).toBe("DECLINED");
  });

  it("keeps publication and withdrawal off the board", () => {
    expect(boardColumnFor("PUBLISHED")).toBeNull();
    expect(boardColumnFor("WITHDRAWN")).toBeNull();
    expect(BOARD_STATUSES).not.toContain("PUBLISHED");
    expect(BOARD_STATUSES).not.toContain("WITHDRAWN");
  });

  it("has no duplicate statuses across columns", () => {
    const all = BOARD_COLUMNS.flatMap((column) => column.statuses);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("quickBoardMoves", () => {
  it("opens peer review for a triaging editor", () => {
    expect(quickBoardMoves(ASSOC, "SUBMITTED", "JOURNAL")).toEqual(["UNDER_REVIEW"]);
    expect(quickBoardMoves(CHAIR, "SUBMITTED", "CONFERENCE")).toEqual([
      "UNDER_REVIEW",
    ]);
  });

  it("offers the reversible revision step only to seats that can set it", () => {
    expect(quickBoardMoves(CHAIR, "UNDER_REVIEW", "JOURNAL")).toEqual([
      "REVISION_REQUIRED",
    ]);
    expect(quickBoardMoves(EIC, "REVISION_REQUIRED", "JOURNAL")).toEqual([
      "UNDER_REVIEW",
    ]);
    // An associate editor may assign reviewers but cannot demand a revision.
    expect(quickBoardMoves(ASSOC, "UNDER_REVIEW", "JOURNAL")).toEqual([]);
  });

  it("never offers a decision or a publication from a card", () => {
    expect(quickBoardMoves(EIC, "ACCEPTED_JOURNAL", "JOURNAL")).toEqual([]);
    expect(quickBoardMoves(EIC, "ACCEPTED_PROCEDINGS", "CONFERENCE")).toEqual([]);
    expect(quickBoardMoves(EIC, "REJECTED", "JOURNAL")).toEqual([]);
    expect(quickBoardMoves(EIC, "DESK_REJECTED", "JOURNAL")).toEqual([]);
    expect(quickBoardMoves(EIC, "SUBMITTED", "JOURNAL")).not.toContain(
      "DESK_REJECTED",
    );
  });

  it("treats a platform administrator as able to triage any venue", () => {
    expect(quickBoardMoves(ADMIN, "SUBMITTED", "JOURNAL")).toEqual([
      "UNDER_REVIEW",
    ]);
    expect(quickBoardMoves(ADMIN, "UNDER_REVIEW", "CONFERENCE")).toEqual([
      "REVISION_REQUIRED",
    ]);
  });

  it("gives a viewer with no seat nothing to click", () => {
    expect(quickBoardMoves({ roles: [] }, "SUBMITTED", "JOURNAL")).toEqual([]);
  });
});
