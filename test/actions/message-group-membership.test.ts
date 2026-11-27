/**
 * Group membership: reading the member list, leaving, removing and revoking.
 *
 * The important invariants: only the owner can remove/revoke, an owner who
 * leaves hands the group to the earliest-joined member (and the creator id
 * follows so notifications still reach the right person), and the last member
 * leaving removes the thread instead of leaving an ownerless orphan.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";

import {
  getGroupDetails,
  removeGroupParticipant,
  revokeGroupInvite,
} from "@/app/actions/messages";

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

const ids = vi.hoisted(() => ({
  owner: "u-owner",
  member: "u-member",
  late: "u-late",
  conversation: "c-group",
}));

let mockUser: { id: string } | null = { id: ids.owner };

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => mockUser),
  requireCurrentUser: vi.fn(async () => {
    if (!mockUser) throw new Error("Not logged in");
    return mockUser;
  }),
  getActiveUser: vi.fn(async () => {
    if (!mockUser) throw new Error("Not logged in");
    return { user: mockUser, frozen: false, message: "" };
  }),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
  RATE_LIMIT_ERROR: "Rate limit exceeded",
  RATE_LIMIT_DEGRADED_ERROR: "Rate limit unavailable",
}));

vi.mock("@/lib/qstash", () => ({
  queueMessagePush: vi.fn(async () => {}),
  queueGroupMessagePush: vi.fn(async () => {}),
}));
vi.mock("next/server", () => ({ after: vi.fn() }));

const person = (id: string) => ({
  id,
  name: id,
  handle: id,
  avatarUrl: null,
  institutionVerifiedAt: null,
  isFrozen: false,
  isDeleted: false,
});

const seedGroup = (
  participants: { id: string; role: string; joinedAt: string }[],
) => {
  const rows = participants.map((participant) => ({
    id: `participant-${participant.id}`,
    conversationId: ids.conversation,
    userId: participant.id,
    user: person(participant.id),
    role: participant.role,
    joinedAt: new Date(participant.joinedAt),
  }));
  // The relation is materialised on the conversation for reads, and the
  // participant table exists so deletes/updates by composite key resolve.
  fakeDb.seed("conversationParticipant", rows);
  return fakeDb.seed("conversation", {
    id: ids.conversation,
    type: "GROUP",
    title: "Reading circle",
    isFrozen: false,
    createdById: ids.owner,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    participants: rows,
    invites: [],
  });
};

beforeEach(() => {
  resetFakeDb();
  mockUser = { id: ids.owner };
});

describe("getGroupDetails", () => {
  it("shows the owner who is still invited", async () => {
    seedGroup([
      { id: ids.owner, role: "OWNER", joinedAt: "2026-01-01T00:00:00.000Z" },
      { id: ids.member, role: "MEMBER", joinedAt: "2026-01-02T00:00:00.000Z" },
    ]);
    const conversation = fakeDb.rows("conversation")[0];
    conversation.invites = [
      {
        invitee: person(ids.late),
        status: "PENDING",
        createdAt: new Date("2026-01-03T00:00:00.000Z"),
      },
    ];

    const details = await getGroupDetails(ids.conversation);

    expect(details?.isOwner).toBe(true);
    expect(details?.participants.map((participant) => participant.id)).toEqual([
      ids.owner,
      ids.member,
    ]);
    expect(details?.pendingInvites.map((invite) => invite.id)).toEqual([
      ids.late,
    ]);
  });

  it("hides pending invite identities from ordinary members", async () => {
    mockUser = { id: ids.member };
    seedGroup([
      { id: ids.owner, role: "OWNER", joinedAt: "2026-01-01T00:00:00.000Z" },
      { id: ids.member, role: "MEMBER", joinedAt: "2026-01-02T00:00:00.000Z" },
    ]);
    (fakeDb.rows("conversation")[0] as Record<string, unknown>).invites = [
      { invitee: person(ids.late), createdAt: new Date() },
    ];

    const details = await getGroupDetails(ids.conversation);

    expect(details?.isOwner).toBe(false);
    expect(details?.pendingInvites).toEqual([]);
  });

  it("returns null for someone outside the group", async () => {
    mockUser = { id: ids.late };
    seedGroup([
      { id: ids.owner, role: "OWNER", joinedAt: "2026-01-01T00:00:00.000Z" },
    ]);

    await expect(getGroupDetails(ids.conversation)).resolves.toBeNull();
  });
});

describe("removeGroupParticipant", () => {
  it("lets the owner remove a member and drops their invite", async () => {
    seedGroup([
      { id: ids.owner, role: "OWNER", joinedAt: "2026-01-01T00:00:00.000Z" },
      { id: ids.member, role: "MEMBER", joinedAt: "2026-01-02T00:00:00.000Z" },
    ]);
    fakeDb.seed("conversationInvite", {
      id: "inv-1",
      conversationId: ids.conversation,
      inviteeId: ids.member,
      inviterId: ids.owner,
      status: "PENDING",
    });

    const result = await removeGroupParticipant(ids.conversation, ids.member);

    expect(result.success).toBe(true);
    // The row survives as a read-only archive (leftAt set), so the thread stays
    // readable; the invite is still dropped.
    const left = fakeDb
      .rows("conversationParticipant")
      .find((row) => row.userId === ids.member);
    expect(left).toBeTruthy();
    expect(left?.leftAt).toBeTruthy();
    expect(fakeDb.rows("conversationInvite")).toHaveLength(0);
  });

  it("rejects a member removing somebody else", async () => {
    mockUser = { id: ids.member };
    seedGroup([
      { id: ids.owner, role: "OWNER", joinedAt: "2026-01-01T00:00:00.000Z" },
      { id: ids.member, role: "MEMBER", joinedAt: "2026-01-02T00:00:00.000Z" },
      { id: ids.late, role: "MEMBER", joinedAt: "2026-01-03T00:00:00.000Z" },
    ]);

    const result = await removeGroupParticipant(ids.conversation, ids.late);

    expect(result).toEqual({
      success: false,
      error: "Only the group owner can remove members.",
    });
  });

  it("transfers ownership to the earliest-joined member when the owner leaves", async () => {
    seedGroup([
      { id: ids.owner, role: "OWNER", joinedAt: "2026-01-01T00:00:00.000Z" },
      { id: ids.member, role: "MEMBER", joinedAt: "2026-01-02T00:00:00.000Z" },
      { id: ids.late, role: "MEMBER", joinedAt: "2026-01-03T00:00:00.000Z" },
    ]);

    const result = await removeGroupParticipant(ids.conversation, ids.owner);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ newOwnerId: ids.member });
    const conversation = fakeDb.rows("conversation")[0];
    expect(conversation.createdById).toBe(ids.member);
    const member = fakeDb
      .rows("conversationParticipant")
      .find((row) => row.userId === ids.member);
    expect(member?.role).toBe("OWNER");
  });

  it("keeps the conversation as a read-only archive when the last member leaves", async () => {
    seedGroup([
      { id: ids.owner, role: "OWNER", joinedAt: "2026-01-01T00:00:00.000Z" },
    ]);

    const result = await removeGroupParticipant(ids.conversation, ids.owner);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ conversationDeleted: false });
    // The thread survives so the leaver can still read the history.
    expect(fakeDb.rows("conversation")).toHaveLength(1);
    const left = fakeDb
      .rows("conversationParticipant")
      .find((row) => row.userId === ids.owner);
    expect(left?.leftAt).toBeTruthy();
  });
});

describe("revokeGroupInvite", () => {
  it("lets the owner cancel a pending invitation", async () => {
    fakeDb.seed("conversationParticipant", {
      id: "p-owner",
      conversationId: ids.conversation,
      userId: ids.owner,
      role: "OWNER",
    });
    fakeDb.seed("conversationInvite", {
      id: "inv-1",
      conversationId: ids.conversation,
      inviteeId: ids.late,
      inviterId: ids.owner,
      status: "PENDING",
    });

    const result = await revokeGroupInvite(ids.conversation, ids.late);

    expect(result).toEqual({ success: true });
    expect(fakeDb.rows("conversationInvite")).toHaveLength(0);
  });

  it("rejects a non-owner", async () => {
    fakeDb.seed("conversationParticipant", {
      id: "p-member",
      conversationId: ids.conversation,
      userId: ids.member,
      role: "MEMBER",
    });

    const result = await revokeGroupInvite(ids.conversation, ids.late);

    expect(result).toEqual({
      success: false,
      error: "Only the group owner can revoke invitations.",
    });
  });
});
