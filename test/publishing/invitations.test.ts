/**
 * Invitation state is derived, not mutated.
 *
 * A `TRANSFER_DECLINED` event closes an invitation without rewriting the
 * `TRANSFER_INVITED` row, so "latest event wins" is the whole rule. These tests
 * pin it, including the clock-tie case that must not reopen a decline.
 */
import { describe, expect, it } from "vitest";

import {
  invitationKey,
  latestInvitationByTarget,
  latestInvitationEvent,
} from "@/lib/publishing/invitations";

const at = (iso: string) => new Date(iso);

const invited = (id: string, iso: string, target = "journal-1") => ({
  id,
  type: "TRANSFER_INVITED" as const,
  createdAt: at(iso),
  targetVenueId: target,
});

const declined = (id: string, iso: string, target = "journal-1") => ({
  id,
  type: "TRANSFER_DECLINED" as const,
  createdAt: at(iso),
  targetVenueId: target,
});

describe("invitationKey", () => {
  it("scopes a pair by manuscript and target venue", () => {
    expect(invitationKey("ms-1", "venue-1")).toBe("ms-1:venue-1");
    expect(invitationKey("ms-1", "venue-1")).not.toBe(
      invitationKey("ms-1", "venue-2"),
    );
  });
});

describe("latestInvitationEvent", () => {
  it("returns the newest event even when rows arrive unsorted", () => {
    const latest = latestInvitationEvent([
      invited("old", "2026-01-01T00:00:00Z"),
      declined("new", "2026-02-01T00:00:00Z"),
      invited("middle", "2026-01-15T00:00:00Z"),
    ]);

    expect(latest?.id).toBe("new");
  });

  it("prefers a decline when timestamps tie", () => {
    const latest = latestInvitationEvent([
      invited("invite", "2026-01-01T00:00:00Z"),
      declined("decline", "2026-01-01T00:00:00Z"),
    ]);

    expect(latest?.id).toBe("decline");
  });

  it("returns null for an empty list", () => {
    expect(latestInvitationEvent([])).toBeNull();
  });
});

describe("latestInvitationByTarget", () => {
  it("keeps the latest event per journal", () => {
    const map = latestInvitationByTarget([
      invited("a-invite", "2026-01-01T00:00:00Z", "journal-1"),
      declined("a-decline", "2026-02-01T00:00:00Z", "journal-1"),
      invited("b-invite", "2026-03-01T00:00:00Z", "journal-2"),
    ]);

    expect(map.get("journal-1")?.id).toBe("a-decline");
    expect(map.get("journal-2")?.id).toBe("b-invite");
    expect(map.size).toBe(2);
  });

  it("drops events without a target venue", () => {
    const map = latestInvitationByTarget([
      { ...invited("no-target", "2026-01-01T00:00:00Z"), targetVenueId: null },
    ]);

    expect(map.size).toBe(0);
  });
});
