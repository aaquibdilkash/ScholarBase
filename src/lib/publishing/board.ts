import type { ManuscriptStatus, VenueType } from "@prisma/client";

import {
  canEditorSetStatus,
  isStatusAllowedForVenue,
  type EditorialActor,
} from "@/lib/publishing/permissions";
import { nextStatuses } from "@/lib/publishing/transitions";

/**
 * Decision-board grouping and its one safe write.
 *
 * The board is a view over the same state machine as the review workspace, not
 * a second one. Columns are presentation only; a move is offered only when
 * `MANUSCRIPT_TRANSITIONS` already has that edge, the actor's seat covers the
 * target, and the venue type allows it.
 *
 * Dragging is deliberately absent. Publishing needs a citation locator and a
 * rejection needs a decision letter, so neither can be a silent drop; the board
 * offers the two reversible triage moves and links everything else to the
 * workspace that asks the questions.
 *
 * `PUBLISHED` and `WITHDRAWN` are not columns: publication is recorded from the
 * publication panel and withdrawal belongs to the author.
 */

export type BoardColumnKey =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "REVISION_REQUIRED"
  | "ACCEPTED"
  | "DECLINED";

export type BoardColumn = {
  key: BoardColumnKey;
  label: string;
  hint: string;
  statuses: readonly ManuscriptStatus[];
};

export const BOARD_COLUMNS: readonly BoardColumn[] = [
  {
    key: "SUBMITTED",
    label: "Submitted",
    hint: "Waiting for triage",
    statuses: ["SUBMITTED"],
  },
  {
    key: "UNDER_REVIEW",
    label: "Under review",
    hint: "Reviewers reading",
    statuses: ["UNDER_REVIEW"],
  },
  {
    key: "REVISION_REQUIRED",
    label: "Revision required",
    hint: "Waiting on the author",
    statuses: ["REVISION_REQUIRED"],
  },
  {
    key: "ACCEPTED",
    label: "Accepted",
    hint: "Ready to publish",
    statuses: ["ACCEPTED_JOURNAL", "ACCEPTED_PROCEDINGS"],
  },
  {
    key: "DECLINED",
    label: "Declined",
    hint: "Closed",
    statuses: ["REJECTED", "DESK_REJECTED"],
  },
];

export const BOARD_STATUSES: readonly ManuscriptStatus[] = BOARD_COLUMNS.flatMap(
  (column) => column.statuses,
);

export function boardColumnFor(status: ManuscriptStatus): BoardColumn | null {
  return BOARD_COLUMNS.find((column) => column.statuses.includes(status)) ?? null;
}

/** Statuses the board may move a card to without asking for more input. */
const QUICK_MOVE_STATUSES: readonly ManuscriptStatus[] = [
  "UNDER_REVIEW",
  "REVISION_REQUIRED",
];

export const QUICK_MOVE_LABELS: Partial<Record<ManuscriptStatus, string>> = {
  UNDER_REVIEW: "Open review",
  REVISION_REQUIRED: "Request revision",
};

/**
 * The only status changes a board card may offer as one click. Everything else
 * (accept, reject, publish, withdraw) needs a report, a letter, or a locator.
 */
export function quickBoardMoves(
  actor: EditorialActor,
  from: ManuscriptStatus,
  venueType: VenueType,
): ManuscriptStatus[] {
  return nextStatuses(from).filter(
    (status) =>
      QUICK_MOVE_STATUSES.includes(status) &&
      canEditorSetStatus(actor, status) &&
      isStatusAllowedForVenue(status, venueType),
  );
}
