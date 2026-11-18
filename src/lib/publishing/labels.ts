import type {
  EditorialRoleTitle,
  ManuscriptEventType,
  ManuscriptStatus,
  ReviewDecision,
} from "@prisma/client";

/**
 * Human labels for publishing enums.
 *
 * The database enums are the single source of truth; these maps only decide
 * copy, so a new status is a type error here until it is labelled.
 */
export const MANUSCRIPT_STATUS_LABELS: Record<ManuscriptStatus, string> = {
  SUBMITTED: "Submitted",
  DESK_REJECTED: "Desk rejected",
  UNDER_REVIEW: "Under review",
  REVISION_REQUIRED: "Revision required",
  ACCEPTED_PROCEDINGS: "Accepted to proceedings",
  ACCEPTED_JOURNAL: "Accepted",
  PUBLISHED: "Published",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

export type StatusTone = "neutral" | "progress" | "success" | "warning" | "danger";

export function manuscriptStatusTone(status: ManuscriptStatus): StatusTone {
  switch (status) {
    case "SUBMITTED":
      return "progress";
    case "UNDER_REVIEW":
      return "progress";
    case "REVISION_REQUIRED":
      return "warning";
    case "ACCEPTED_PROCEDINGS":
    case "ACCEPTED_JOURNAL":
    case "PUBLISHED":
      return "success";
    case "DESK_REJECTED":
    case "REJECTED":
      return "danger";
    case "WITHDRAWN":
    default:
      return "neutral";
  }
}

export const EDITORIAL_ROLE_LABELS: Record<EditorialRoleTitle, string> = {
  EDITOR_IN_CHIEF: "Editor-in-Chief",
  TRACK_CHAIR: "Track Chair",
  ASSOC_EDITOR: "Associate Editor",
};

/** Reviewer recommendations, as shown to the desk and to the reviewer. */
export const REVIEW_DECISION_LABELS: Record<ReviewDecision, string> = {
  ACCEPT: "Accept",
  MINOR_REVISION: "Minor revision",
  MAJOR_REVISION: "Major revision",
  REJECT: "Reject",
};

/**
 * Timeline labels for the append-only manuscript event log.
 *
 * The author-facing detail page renders one row per event; a status change is
 * the only type whose label comes from the status map, so the rest live here.
 */
export const MANUSCRIPT_EVENT_LABELS: Record<ManuscriptEventType, string> = {
  SUBMITTED: "Submitted",
  STATUS_CHANGED: "Status changed",
  REVIEW_ASSIGNED: "Reviewer assigned",
  REVIEW_SUBMITTED: "Review submitted",
  REVISION_UPLOADED: "Revision uploaded",
  REVIEW_RECUSAL_DECLARED: "Reviewer recused",
  EDITORIAL_RECUSAL_DECLARED: "Editor recused",
  PUBLICATION_NOTICE_ADDED: "Publication notice added",
  TRANSFER_INVITED: "Extended-version invitation",
  TRANSFER_DECLINED: "Invitation declined",
  TRANSFERRED: "Extended version submitted",
  PUBLISHED: "Published",
  WITHDRAWN: "Withdrawn",
};
