/**
 * Venue-scoped editorial capabilities.
 *
 * These predicates are the contract between the Server Actions and the UI, so
 * the two tests that matter most are the ones proving an `ASSOC_EDITOR` cannot
 * publish and a `TRACK_CHAIR` cannot decide a journal acceptance. Those are the
 * two paths by which a paper could reach a reader without a journal review.
 */
import { describe, expect, it } from "vitest";

import {
  canAssignReviewer,
  canEditVenueContent,
  canEditorSetStatus,
  canTransferToJournal,
  isStatusAllowedForVenue,
  type EditorialActor,
} from "@/lib/publishing/permissions";

const nobody: EditorialActor = { roles: [] };
const assoc: EditorialActor = { roles: ["ASSOC_EDITOR"] };
const chair: EditorialActor = { roles: ["TRACK_CHAIR"] };
const eic: EditorialActor = { roles: ["EDITOR_IN_CHIEF"] };
const admin: EditorialActor = { roles: [], isAdmin: true };

describe("content and assignment", () => {
  it("only the editor-in-chief (or admin) edits venue content", () => {
    expect(canEditVenueContent(eic)).toBe(true);
    expect(canEditVenueContent(admin)).toBe(true);
    expect(canEditVenueContent(chair)).toBe(false);
    expect(canEditVenueContent(assoc)).toBe(false);
    expect(canEditVenueContent(nobody)).toBe(false);
  });

  it("any editorial seat triages reviewers", () => {
    expect(canAssignReviewer(eic)).toBe(true);
    expect(canAssignReviewer(chair)).toBe(true);
    expect(canAssignReviewer(assoc)).toBe(true);
    expect(canAssignReviewer(admin)).toBe(true);
    expect(canAssignReviewer(nobody)).toBe(false);
  });

  it("only chair-level roles originate a journal transfer", () => {
    expect(canTransferToJournal(eic)).toBe(true);
    expect(canTransferToJournal(chair)).toBe(true);
    expect(canTransferToJournal(admin)).toBe(true);
    expect(canTransferToJournal(assoc)).toBe(false);
    expect(canTransferToJournal(nobody)).toBe(false);
  });
});

describe("status authority", () => {
  it("only the editor-in-chief publishes", () => {
    expect(canEditorSetStatus(eic, "PUBLISHED")).toBe(true);
    expect(canEditorSetStatus(admin, "PUBLISHED")).toBe(true);
    expect(canEditorSetStatus(chair, "PUBLISHED")).toBe(false);
    expect(canEditorSetStatus(assoc, "PUBLISHED")).toBe(false);
    expect(canEditorSetStatus(nobody, "PUBLISHED")).toBe(false);
  });

  it("a journal acceptance needs the editor-in-chief", () => {
    expect(canEditorSetStatus(eic, "ACCEPTED_JOURNAL")).toBe(true);
    expect(canEditorSetStatus(chair, "ACCEPTED_JOURNAL")).toBe(false);
    expect(canEditorSetStatus(assoc, "ACCEPTED_JOURNAL")).toBe(false);
  });

  it("a track chair can accept to proceedings", () => {
    expect(canEditorSetStatus(chair, "ACCEPTED_PROCEDINGS")).toBe(true);
    expect(canEditorSetStatus(eic, "ACCEPTED_PROCEDINGS")).toBe(true);
    expect(canEditorSetStatus(assoc, "ACCEPTED_PROCEDINGS")).toBe(false);
  });

  it("desk rejection stays with the editor-in-chief", () => {
    expect(canEditorSetStatus(eic, "DESK_REJECTED")).toBe(true);
    expect(canEditorSetStatus(chair, "DESK_REJECTED")).toBe(false);
    expect(canEditorSetStatus(assoc, "DESK_REJECTED")).toBe(false);
  });

  it("every editorial seat can move a paper into review", () => {
    expect(canEditorSetStatus(eic, "UNDER_REVIEW")).toBe(true);
    expect(canEditorSetStatus(chair, "UNDER_REVIEW")).toBe(true);
    expect(canEditorSetStatus(assoc, "UNDER_REVIEW")).toBe(true);
    expect(canEditorSetStatus(nobody, "UNDER_REVIEW")).toBe(false);
  });

  it("nobody sets author-owned statuses, including admins", () => {
    for (const actor of [nobody, assoc, chair, eic, admin]) {
      expect(canEditorSetStatus(actor, "SUBMITTED")).toBe(false);
      expect(canEditorSetStatus(actor, "WITHDRAWN")).toBe(false);
    }
  });
});

describe("venue/status compatibility", () => {
  it("restricts proceedings acceptance to conferences", () => {
    expect(isStatusAllowedForVenue("ACCEPTED_PROCEDINGS", "CONFERENCE")).toBe(true);
    expect(isStatusAllowedForVenue("ACCEPTED_PROCEDINGS", "JOURNAL")).toBe(false);
  });

  it("restricts journal acceptance to journals", () => {
    expect(isStatusAllowedForVenue("ACCEPTED_JOURNAL", "JOURNAL")).toBe(true);
    expect(isStatusAllowedForVenue("ACCEPTED_JOURNAL", "CONFERENCE")).toBe(false);
  });

  it("leaves shared statuses venue-agnostic", () => {
    for (const status of ["SUBMITTED", "UNDER_REVIEW", "REVISION_REQUIRED", "REJECTED", "PUBLISHED"] as const) {
      expect(isStatusAllowedForVenue(status, "JOURNAL")).toBe(true);
      expect(isStatusAllowedForVenue(status, "CONFERENCE")).toBe(true);
    }
  });
});
