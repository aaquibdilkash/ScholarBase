import type { EditorialRoleTitle, ManuscriptStatus, VenueType } from "@prisma/client";

/**
 * Venue-scoped editorial capabilities.
 *
 * Pure predicates so the role matrix is testable without a database and cannot
 * drift between the Server Action that enforces it and the component that hides
 * a button. An action must still verify that the actor holds a role **on the
 * manuscript's venue** — this module only answers "given these roles, is this
 * allowed?".
 *
 * `isAdmin` is `User.isAdmin`, not a venue role: platform administration is not
 * a row in `EditorialRole`.
 */
export type EditorialActor = {
  readonly roles: readonly EditorialRoleTitle[];
  readonly isAdmin?: boolean;
};

function hasAnyRole(actor: EditorialActor, roles: readonly EditorialRoleTitle[]): boolean {
  return roles.some((role) => actor.roles.includes(role));
}

/** Statuses an editor may set directly, keyed by the roles permitted to do it. */
export const STATUS_ACTOR_ROLES: Record<ManuscriptStatus, readonly EditorialRoleTitle[]> = {
  // Only the author's submission creates this, never an editorial transition.
  SUBMITTED: [],
  DESK_REJECTED: ["EDITOR_IN_CHIEF"],
  UNDER_REVIEW: ["EDITOR_IN_CHIEF", "TRACK_CHAIR", "ASSOC_EDITOR"],
  REVISION_REQUIRED: ["EDITOR_IN_CHIEF", "TRACK_CHAIR"],
  ACCEPTED_PROCEDINGS: ["EDITOR_IN_CHIEF", "TRACK_CHAIR"],
  ACCEPTED_JOURNAL: ["EDITOR_IN_CHIEF"],
  REJECTED: ["EDITOR_IN_CHIEF", "TRACK_CHAIR"],
  PUBLISHED: ["EDITOR_IN_CHIEF"],
  // Author-initiated only; an editor must not withdraw someone else's paper.
  WITHDRAWN: [],
};

/** Editing aims/scope, guidelines, policies, board members, and identifiers. */
export function canEditVenueContent(actor: EditorialActor): boolean {
  return Boolean(actor.isAdmin) || hasAnyRole(actor, ["EDITOR_IN_CHIEF"]);
}

/** Assigning or removing a reviewer. Any editorial seat may triage. */
export function canAssignReviewer(actor: EditorialActor): boolean {
  return (
    Boolean(actor.isAdmin) ||
    hasAnyRole(actor, ["EDITOR_IN_CHIEF", "TRACK_CHAIR", "ASSOC_EDITOR"])
  );
}

/**
 * Cloning an accepted conference paper into a journal submission queue.
 * Restricted because the clone lands as a normal `SUBMITTED` item in a venue
 * the actor may hold no role on.
 */
export function canTransferToJournal(actor: EditorialActor): boolean {
  return Boolean(actor.isAdmin) || hasAnyRole(actor, ["EDITOR_IN_CHIEF", "TRACK_CHAIR"]);
}

export function canEditorSetStatus(
  actor: EditorialActor,
  to: ManuscriptStatus,
): boolean {
  const allowed = STATUS_ACTOR_ROLES[to];
  // `SUBMITTED` and `WITHDRAWN` have no editorial owner — they belong to the
  // author (or the system). Admin does not bypass that, so a support action can
  // never withdraw a paper on an author's behalf.
  if (allowed.length === 0) return false;
  if (actor.isAdmin) return true;
  return hasAnyRole(actor, allowed);
}

/**
 * A conference can award `ACCEPTED_PROCEDINGS`; a journal can award
 * `ACCEPTED_JOURNAL`. Everything else is venue-agnostic. Checked separately from
 * the role so a mis-wired action cannot accept a paper "to proceedings" in a
 * journal it will never publish.
 */
export function isStatusAllowedForVenue(
  status: ManuscriptStatus,
  venueType: VenueType,
): boolean {
  if (status === "ACCEPTED_PROCEDINGS") return venueType === "CONFERENCE";
  if (status === "ACCEPTED_JOURNAL") return venueType === "JOURNAL";
  return true;
}
