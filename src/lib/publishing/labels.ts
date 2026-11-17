import type { EditorialRoleTitle, ManuscriptStatus } from "@prisma/client";

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
