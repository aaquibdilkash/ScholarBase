/**
 * Group invitations.
 *
 * Invitees are deliberately NOT participants until they accept: membership
 * drives the inbox, unread counts, read receipts and Realtime authorization, so
 * a pending invite must not leak any of them. These tests pin that boundary and
 * the seat count that includes pending invites.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";

import {
  createGroupConversation,
  getPendingGroupInvites,
  inviteGroupMembers,
  respondToGroupInvite,
} from "@/app/actions/messages";
import { MAX_GROUP_PARTICIPANTS } from "@/constants/messages";

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

const ids = vi.hoisted(() => ({
  owner: "u-owner",
  member: "u-member",
  invitee: "u-invitee",
  outsider: "u-outsider",
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

const after = vi.hoisted(() => vi.fn());
vi.mock("next/server", () => ({ after }));

const notifyUserById = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/lib/notifications", () => ({ notifyUserById }));

// Nested writes used by `createGroupConversation`.
fakeDb.link({
  parent: "conversation",
  relation: "participants",
  child: "conversationParticipant",
  fk: "conversationId",
});
fakeDb.link({
  parent: "conversation",
  relation: "invites",
  child: "conversationInvite",
  fk: "conversationId",
});

const user = (id: string, name = id) => ({
  id,
  name,
  handle: id,
  avatarUrl: null,
  isDeleted: false,
  isFrozen: false,
});

beforeEach(() => {
  resetFakeDb();
  mockUser = { id: ids.owner };
  after.mockClear();
  notifyUserById.mockClear();
});

describe("createGroupConversation", () => {
  it("invites members instead of adding them to the thread", async () => {
    fakeDb.seed("user", [user(ids.owner, "Owner"), user(ids.invitee, "Invitee")]);

    const form = new FormData();
    form.append("title", "Reading circle");
    form.append("memberIds", ids.invitee);

    const result = await createGroupConversation(form);

    expect(result.success).toBe(true);
    const conversation = fakeDb.rows("conversation")[0];
    expect(conversation.type).toBe("GROUP");
    expect(conversation.title).toBe("Reading circle");

    // Only the creator is a participant; the invitee waits for a response.
    const participants = fakeDb.rows("conversationParticipant");
    expect(participants.map((row) => row.userId)).toEqual([ids.owner]);
    expect(participants[0].role).toBe("OWNER");

    const invites = fakeDb.rows("conversationInvite");
    expect(invites).toHaveLength(1);
    expect(invites[0]).toMatchObject({
      inviteeId: ids.invitee,
      inviterId: ids.owner,
      status: "PENDING",
    });
    expect(after).toHaveBeenCalledTimes(1);
  });

  it("rejects a name over 64 characters", async () => {
    fakeDb.seed("user", [user(ids.owner), user(ids.invitee)]);
    const form = new FormData();
    form.append("title", "x".repeat(65));
    form.append("memberIds", ids.invitee);

    const result = await createGroupConversation(form);

    expect(result).toEqual({
      success: false,
      error: "A group name between 1 and 64 characters is required.",
    });
    expect(fakeDb.rows("conversation")).toHaveLength(0);
  });

  it("requires at least one invitee", async () => {
    fakeDb.seed("user", [user(ids.owner)]);
    const form = new FormData();
    form.append("title", "Solo");

    const result = await createGroupConversation(form);

    expect(result).toEqual({
      success: false,
      error: "Invite at least one other scholar to the group.",
    });
  });
});

describe("respondToGroupInvite", () => {
  const seedInvite = ({
    isFrozen = false,
    participantCount = 1,
    status = "PENDING",
  }: {
    isFrozen?: boolean;
    participantCount?: number;
    status?: string;
  } = {}) => {
    const participants = Array.from({ length: participantCount }, (_, index) => ({
      userId: index === 0 ? ids.owner : `u-member-${index}`,
      lastReadAt: new Date("2026-01-01T00:00:00.000Z"),
    }));
    fakeDb.seed("conversation", {
      id: ids.conversation,
      type: "GROUP",
      title: "Reading circle",
      isFrozen,
      participants,
    });
    fakeDb.seed("conversationInvite", {
      id: "inv-1",
      conversationId: ids.conversation,
      inviteeId: ids.invitee,
      inviterId: ids.owner,
      status,
      // The fake does not resolve relations by foreign key.
      conversation: { type: "GROUP" },
    });
  };

  it("accepting creates the participant with a read marker", async () => {
    mockUser = { id: ids.invitee };
    seedInvite();

    const result = await respondToGroupInvite(ids.conversation, true);

    expect(result).toEqual({
      success: true,
      data: { conversationId: ids.conversation, accepted: true },
    });
    const participant = fakeDb
      .rows("conversationParticipant")
      .find((row) => row.userId === ids.invitee);
    expect(participant).toBeDefined();
    expect(participant?.lastReadAt).toBeInstanceOf(Date);
    expect(fakeDb.rows("conversationInvite")[0].status).toBe("ACCEPTED");
  });

  it("declining records the response without creating a participant", async () => {
    mockUser = { id: ids.invitee };
    seedInvite();

    const result = await respondToGroupInvite(ids.conversation, false);

    expect(result).toEqual({
      success: true,
      data: { conversationId: ids.conversation, accepted: false },
    });
    expect(fakeDb.rows("conversationParticipant")).toHaveLength(0);
    expect(fakeDb.rows("conversationInvite")[0].status).toBe("DECLINED");
  });

  it("refuses to accept while the group is frozen", async () => {
    mockUser = { id: ids.invitee };
    seedInvite({ isFrozen: true });

    const result = await respondToGroupInvite(ids.conversation, true);

    expect(result).toEqual({
      success: false,
      error: "This group is frozen and cannot accept new members.",
    });
    expect(fakeDb.rows("conversationParticipant")).toHaveLength(0);
  });

  it("refuses to accept when the last seat was taken", async () => {
    mockUser = { id: ids.invitee };
    seedInvite({ participantCount: MAX_GROUP_PARTICIPANTS });

    const result = await respondToGroupInvite(ids.conversation, true);

    expect(result.success).toBe(false);
  });

  it("refuses an invitation between blocked scholars", async () => {
    mockUser = { id: ids.invitee };
    seedInvite();
    fakeDb.seed("block", {
      id: "b-1",
      blockerId: ids.owner,
      blockedId: ids.invitee,
    });

    const result = await respondToGroupInvite(ids.conversation, true);

    expect(result).toEqual({
      success: false,
      error: "This invitation is no longer available.",
    });
  });
});

describe("getPendingGroupInvites", () => {
  it("returns pending invites and hides frozen groups", async () => {
    mockUser = { id: ids.invitee };
    fakeDb.seed("conversationInvite", [
      {
        id: "inv-open",
        conversationId: "c-open",
        inviteeId: ids.invitee,
        inviterId: ids.owner,
        status: "PENDING",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        conversation: { title: "Open group", isFrozen: false },
        inviter: { id: ids.owner, name: "Owner", handle: "owner", avatarUrl: null },
      },
      {
        id: "inv-frozen",
        conversationId: "c-frozen",
        inviteeId: ids.invitee,
        inviterId: ids.owner,
        status: "PENDING",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        conversation: { title: "Frozen group", isFrozen: true },
        inviter: { id: ids.owner, name: "Owner", handle: "owner", avatarUrl: null },
      },
    ]);

    const invites = await getPendingGroupInvites();

    expect(invites.map((invite) => invite.conversationId)).toEqual(["c-open"]);
  });
});

describe("inviteGroupMembers", () => {
  const seedGroup = ({
    role = "OWNER",
    participants = 1,
    pending = 0,
    isFrozen = false,
  }: {
    role?: string;
    participants?: number;
    pending?: number;
    isFrozen?: boolean;
  } = {}) => {
    fakeDb.seed("conversation", {
      id: ids.conversation,
      type: "GROUP",
      title: "Reading circle",
      isFrozen,
      participants: [
        { userId: ids.owner, role },
        ...Array.from({ length: participants - 1 }, (_, index) => ({
          userId: `u-member-${index}`,
          role: "MEMBER",
        })),
      ],
      invites: Array.from({ length: pending }, (_, index) => ({
        inviteeId: `u-pending-${index}`,
        status: "PENDING",
      })),
    });
  };

  beforeEach(() => {
    fakeDb.seed("user", [
      user(ids.owner),
      user(ids.invitee),
      user(ids.outsider),
    ]);
  });

  it("creates a pending invite for the owner", async () => {
    seedGroup({ participants: 2 });

    const result = await inviteGroupMembers(ids.conversation, [ids.invitee]);

    expect(result).toEqual({
      success: true,
      data: { invited: [ids.invitee] },
    });
    expect(fakeDb.rows("conversationInvite")[0]).toMatchObject({
      conversationId: ids.conversation,
      inviteeId: ids.invitee,
      inviterId: ids.owner,
    });
  });

  it("rejects a non-owner", async () => {
    mockUser = { id: ids.member };
    seedGroup({ role: "MEMBER", participants: 2 });

    const result = await inviteGroupMembers(ids.conversation, [ids.invitee]);

    expect(result).toEqual({
      success: false,
      error: "Only the group owner can invite scholars.",
    });
  });

  it("counts pending invitations against the eight seats", async () => {
    seedGroup({ participants: 7, pending: 1 });

    const result = await inviteGroupMembers(ids.conversation, [ids.invitee]);

    expect(result).toEqual({
      success: false,
      error:
        "Groups can have up to 8 participants, including pending invitations.",
    });
  });

  it("refuses membership changes on a frozen group", async () => {
    seedGroup({ isFrozen: true });

    const result = await inviteGroupMembers(ids.conversation, [ids.invitee]);

    expect(result).toEqual({
      success: false,
      error:
        "This group is frozen by moderators and cannot change membership.",
    });
  });
});
