import type { ManuscriptStatus } from "@prisma/client";

/**
 * The manuscript state machine, in one place.
 *
 * Every Server Action that changes `Manuscript.status` must go through
 * `canTransition`, and every UI that offers a status must render
 * `nextStatuses`. Duplicating an edge in a Kanban component is how a paper
 * reaches `PUBLISHED` without passing review.
 *
 * The conference → journal "Golden Flow" is **not** a transition: it clones the
 * manuscript into a new row with `status = SUBMITTED` and
 * `originalManuscriptId` set, leaving the conference record untouched. Encoding
 * it as an edge would lose the decision record, so it has no entry here.
 */
export const MANUSCRIPT_TRANSITIONS: Record<ManuscriptStatus, readonly ManuscriptStatus[]> = {
  SUBMITTED: ["DESK_REJECTED", "UNDER_REVIEW", "WITHDRAWN"],
  UNDER_REVIEW: ["REVISION_REQUIRED", "ACCEPTED_PROCEDINGS", "ACCEPTED_JOURNAL", "REJECTED"],
  REVISION_REQUIRED: ["UNDER_REVIEW", "WITHDRAWN"],
  ACCEPTED_PROCEDINGS: ["PUBLISHED"],
  ACCEPTED_JOURNAL: ["PUBLISHED"],
  PUBLISHED: [],
  DESK_REJECTED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

/** Statuses with no outgoing edges. A correction is a new version, not a status. */
export const TERMINAL_MANUSCRIPT_STATUSES: readonly ManuscriptStatus[] = [
  "PUBLISHED",
  "DESK_REJECTED",
  "REJECTED",
  "WITHDRAWN",
];

export function canTransition(from: ManuscriptStatus, to: ManuscriptStatus): boolean {
  return MANUSCRIPT_TRANSITIONS[from].includes(to);
}

export function nextStatuses(from: ManuscriptStatus): readonly ManuscriptStatus[] {
  return MANUSCRIPT_TRANSITIONS[from];
}

export function isTerminalStatus(status: ManuscriptStatus): boolean {
  return MANUSCRIPT_TRANSITIONS[status].length === 0;
}

/**
 * Statuses an author may withdraw their own paper from.
 *
 * Deliberately not an edge in `MANUSCRIPT_TRANSITIONS`: that table is the
 * *editorial* decision machine, and its invariant is that nothing reaches
 * `PUBLISHED` without review. Author consent is a different question — a paper
 * under review is exactly when an author most often needs to withdraw — so it
 * gets its own set. Editors cannot use it either: `STATUS_ACTOR_ROLES` gives
 * `WITHDRAWN` no editorial owner.
 */
const AUTHOR_WITHDRAWABLE_STATUSES: readonly ManuscriptStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "REVISION_REQUIRED",
];

export function canAuthorWithdraw(status: ManuscriptStatus): boolean {
  return AUTHOR_WITHDRAWABLE_STATUSES.includes(status);
}
