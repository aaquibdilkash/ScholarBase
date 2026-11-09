import { beforeEach, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";

import * as emailModule from "@/lib/email";
import * as rateLimitModule from "@/lib/rate-limit";
import { MAX_OUTREACH_BATCH_SIZE, MAX_OUTREACH_NOTES } from "@/lib/constants";
import { fakeDb, resetFakeDb } from "../fake-prisma";

const ADMIN = "u-admin";
const NON_ADMIN = "u-user";
const CONTACT_ID = "c-1";

let isAdminResult = true;
let rateLimitAllowed = true;
let rateLimitDegraded = false;
let sendEmailResult: { success: boolean; error?: string } = { success: true };

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => {
    if (isAdminResult) return { id: ADMIN } as unknown as { id: string };
    return { id: NON_ADMIN } as unknown as { id: string };
  }),
  isUserAdmin: vi.fn(async () => isAdminResult),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({
    allowed: rateLimitAllowed,
    degraded: rateLimitDegraded,
  })),
  RATE_LIMIT_ERROR: "Rate limit exceeded",
}));
vi.mock("@/lib/email", () => ({
  sendScholarOutreachEmail: vi.fn(async () => sendEmailResult),
}));

const seedAdmin = () => {
  fakeDb.store.seed("user", {
    id: ADMIN,
    email: "admin@scholarbase.app",
    name: "Admin User",
    isAdmin: true,
    isDeleted: false,
    isFrozen: false,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  });
  fakeDb.store.seed("user", {
    id: NON_ADMIN,
    email: "user@scholarbase.app",
    name: "Regular User",
    isAdmin: false,
    isDeleted: false,
    isFrozen: false,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  });
};

const seedContact = (overrides: Record<string, unknown> = {}) => {
  fakeDb.store.seed("outreach", {
    id: CONTACT_ID,
    name: "Jane Scholar",
    email: "jane@university.edu",
    institution: "Test University",
    role: "Professor",
    source: "conference",
    notes: "Met at the research symposium.",
    status: "PENDING",
    sendCount: 0,
    outreachedAt: null,
    emailSentAt: null,
    createdById: ADMIN,
    userId: null,
    createdAt: new Date("2026-01-02"),
    updatedAt: new Date("2026-01-02"),
    ...overrides,
  });
};

const seedContacts = (count: number): string[] =>
  Array.from({ length: count }, (_, index) => {
    const id = `c-${index + 1}`;
    fakeDb.store.seed("outreach", {
      id,
      name: `Scholar ${index + 1}`,
      email: `scholar${index + 1}@university.edu`,
      institution: null,
      role: null,
      source: null,
      notes: null,
      status: "PENDING",
      sendCount: 0,
      outreachedAt: null,
      emailSentAt: null,
      createdById: ADMIN,
      userId: null,
      createdAt: new Date("2026-01-02"),
      updatedAt: new Date("2026-01-02"),
    });
    return id;
  });

beforeEach(() => {
  resetFakeDb();
  vi.mocked(emailModule.sendScholarOutreachEmail).mockClear();
  vi.mocked(rateLimitModule.checkRateLimit).mockClear();
  isAdminResult = true;
  rateLimitAllowed = true;
  rateLimitDegraded = false;
  sendEmailResult = { success: true };
  seedAdmin();
});

describe("createOutreachContact", () => {
  it("creates a contact for an admin", async () => {
    const { createOutreachContact } = await import("@/app/actions/outreach");

    const result = await createOutreachContact({
      name: "Jane Scholar",
      email: "jane@university.edu",
      institution: "Test University",
      role: "Professor",
      source: "conference",
      notes: "Met at the research symposium.",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.id).toBe("string");
    }

    const rows = fakeDb.store.table("outreach");
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("jane@university.edu");
    expect(rows[0].status).toBe("PENDING");
    expect(rows[0].createdById).toBe(ADMIN);
  });

  it("rejects a non-admin", async () => {
    isAdminResult = false;
    const { createOutreachContact } = await import("@/app/actions/outreach");

    const result = await createOutreachContact({
      name: "Jane Scholar",
      email: "jane@university.edu",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/not authorized/i);
    }
  });

  it("rejects an invalid email", async () => {
    const { createOutreachContact } = await import("@/app/actions/outreach");

    const result = await createOutreachContact({
      name: "Jane Scholar",
      email: "not-an-email",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/valid email/i);
    }
  });

  it("marks an existing contact as UNSUBSCRIBED when the email opts out", async () => {
    seedContact({ status: "PENDING" });
    fakeDb.store.seed("outreachEmailUnsubscribe", {
      id: "u-1",
      email: "jane@university.edu",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    });
    const { createOutreachContact } = await import("@/app/actions/outreach");

    const result = await createOutreachContact({
      name: "Jane Scholar",
      email: "jane@university.edu",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.id).toBe("string");
    }
    const rows = fakeDb.store.table("outreach");
    expect(rows[0].status).toBe("UNSUBSCRIBED");
  });

  it("rejects adding a contact that already opted out", async () => {
    fakeDb.store.seed("outreachEmailUnsubscribe", {
      id: "u-1",
      email: "jane@university.edu",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    });
    const { createOutreachContact } = await import("@/app/actions/outreach");

    const result = await createOutreachContact({
      name: "Jane Scholar",
      email: "jane@university.edu",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/opted out/i);
    }
  });

  it("upserts on duplicate email instead of duplicating", async () => {
    seedContact();
    const { createOutreachContact } = await import("@/app/actions/outreach");

    const result = await createOutreachContact({
      name: "Jane Updated",
      email: "jane@university.edu",
      role: "Associate Professor",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.id).toBe("string");
    }
    const rows = fakeDb.store.table("outreach");
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Jane Updated");
    expect(rows[0].role).toBe("Associate Professor");
  });
});

describe("updateOutreachContact", () => {
  it("updates the contact fields", async () => {
    seedContact();
    const { updateOutreachContact } = await import("@/app/actions/outreach");

    const result = await updateOutreachContact({
      contactId: CONTACT_ID,
      name: "Jane Updated",
      email: "jane.updated@university.edu",
      institution: "New University",
      role: "Associate Professor",
      source: "referral",
      notes: "Updated notes.",
    });

    expect(result.success).toBe(true);

    const rows = fakeDb.store.table("outreach");
    expect(rows[0]).toMatchObject({
      name: "Jane Updated",
      email: "jane.updated@university.edu",
      institution: "New University",
      role: "Associate Professor",
      source: "referral",
      notes: "Updated notes.",
    });
  });

  it("rejects a non-admin", async () => {
    isAdminResult = false;
    seedContact();
    const { updateOutreachContact } = await import("@/app/actions/outreach");

    const result = await updateOutreachContact({
      contactId: CONTACT_ID,
      name: "Jane Updated",
      email: "jane.updated@university.edu",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/not authorized/i);
    }
  });

  it("rejects an invalid email", async () => {
    seedContact();
    const { updateOutreachContact } = await import("@/app/actions/outreach");

    const result = await updateOutreachContact({
      contactId: CONTACT_ID,
      name: "Jane",
      email: "not-an-email",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/valid email/i);
    }
  });

  it("rejects an email already used by another contact", async () => {
    seedContact();
    seedContact({ id: "c-2", name: "Bob", email: "bob@test.edu" });
    const { updateOutreachContact } = await import("@/app/actions/outreach");

    const result = await updateOutreachContact({
      contactId: CONTACT_ID,
      name: "Jane",
      email: "bob@test.edu",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/already uses this email/i);
    }
  });

  it("rejects moving a contact to an opted-out email", async () => {
    seedContact();
    fakeDb.store.seed("outreachEmailUnsubscribe", {
      id: "u-1",
      email: "opted-out@university.edu",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    });
    const { updateOutreachContact } = await import("@/app/actions/outreach");

    const result = await updateOutreachContact({
      contactId: CONTACT_ID,
      name: "Jane",
      email: "opted-out@university.edu",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/opted out/i);
    }
  });

  it("rejects a missing contact", async () => {
    const { updateOutreachContact } = await import("@/app/actions/outreach");

    const result = await updateOutreachContact({
      contactId: "does-not-exist",
      name: "Jane",
      email: "jane@university.edu",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/not found/i);
    }
  });
});

describe("listOutreachContacts", () => {
  it("lists contacts for an admin", async () => {
    seedContact({ name: "Alice", email: "alice@test.edu" });
    seedContact({ id: "c-2", name: "Bob", email: "bob@test.edu" });
    const { listOutreachContacts } = await import("@/app/actions/outreach");

    const result = await listOutreachContacts({
      page: 1,
      pageSize: 25,
      status: "all",
      search: "",
    });

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it("rejects a non-admin", async () => {
    isAdminResult = false;
    const { listOutreachContacts } = await import("@/app/actions/outreach");

    const result = await listOutreachContacts({
      page: 1,
      pageSize: 25,
      status: "all",
      search: "",
    });

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("filters by status", async () => {
    seedContact({ status: "PENDING" });
    seedContact({ id: "c-2", status: "OUTREACHED", email: "bob@test.edu" });
    const { listOutreachContacts } = await import("@/app/actions/outreach");

    const result = await listOutreachContacts({
      page: 1,
      pageSize: 25,
      status: "PENDING",
      search: "",
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].status).toBe("PENDING");
  });

  it("searches by name and email", async () => {
    seedContact({ name: "Alice Smith", email: "alice@test.edu" });
    seedContact({ id: "c-2", name: "Bob Jones", email: "bob@test.edu" });
    const { listOutreachContacts } = await import("@/app/actions/outreach");

    const result = await listOutreachContacts({
      page: 1,
      pageSize: 25,
      status: "all",
      search: "Alice",
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe("Alice Smith");
  });

  it("paginates results", async () => {
    seedContact({ name: "Alice", email: "alice@test.edu" });
    seedContact({ id: "c-2", name: "Bob", email: "bob@test.edu" });
    seedContact({ id: "c-3", name: "Carol", email: "carol@test.edu" });
    const { listOutreachContacts } = await import("@/app/actions/outreach");

    const page1 = await listOutreachContacts({
      page: 1,
      pageSize: 2,
      status: "all",
      search: "",
    });
    const page2 = await listOutreachContacts({
      page: 2,
      pageSize: 2,
      status: "all",
      search: "",
    });

    expect(page1.items).toHaveLength(2);
    expect(page1.totalPages).toBe(2);
    expect(page2.items).toHaveLength(1);
    expect(page2.items[0].name).toBe("Carol");
  });
});

describe("sendOutreachEmail", () => {
  it("sends and marks the contact as outreached", async () => {
    seedContact();
    const { sendOutreachEmail } = await import("@/app/actions/outreach");

    const result = await sendOutreachEmail({ contactId: CONTACT_ID });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("OUTREACHED");
      expect(result.data.emailSentAt).toBeInstanceOf(Date);
    }

    const rows = fakeDb.store.table("outreach");
    expect(rows[0].status).toBe("OUTREACHED");
    expect(rows[0].sendCount).toBe(1);
    expect(rows[0].outreachedAt).toBeInstanceOf(Date);
    expect(rows[0].emailSentAt).toBeInstanceOf(Date);
  });

  it("rejects a contact who already has an account", async () => {
    seedContact({ email: "member@university.edu" });
    fakeDb.store.seed("user", {
      id: "u-member",
      email: "member@university.edu",
      name: "Existing Member",
      isAdmin: false,
      isDeleted: false,
      isFrozen: false,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    });
    const { sendOutreachEmail } = await import("@/app/actions/outreach");

    const result = await sendOutreachEmail({ contactId: CONTACT_ID });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/already belongs to a ScholarBase member/i);
    }
    expect(emailModule.sendScholarOutreachEmail).not.toHaveBeenCalled();
  });

  it("rejects a non-admin", async () => {
    isAdminResult = false;
    seedContact();
    const { sendOutreachEmail } = await import("@/app/actions/outreach");

    const result = await sendOutreachEmail({ contactId: CONTACT_ID });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/not authorized/i);
    }
  });

  it("does not re-send to an already-outreached contact", async () => {
    seedContact({ status: "OUTREACHED" });
    const { sendOutreachEmail } = await import("@/app/actions/outreach");

    const result = await sendOutreachEmail({ contactId: CONTACT_ID });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/already been emailed/i);
    }
  });

  it("resends when explicitly requested", async () => {
    seedContact({ status: "OUTREACHED", sendCount: 1 });
    const { sendOutreachEmail } = await import("@/app/actions/outreach");

    const result = await sendOutreachEmail({
      contactId: CONTACT_ID,
      resend: true,
    });

    expect(result.success).toBe(true);

    const rows = fakeDb.store.table("outreach");
    expect(rows[0].status).toBe("OUTREACHED");
    expect(rows[0].sendCount).toBe(2);
  });

  it("uses a template variant and rotates it on resend", async () => {
    seedContact({ status: "PENDING" });
    const { sendOutreachEmail } = await import("@/app/actions/outreach");
    const mock = vi.mocked(emailModule.sendScholarOutreachEmail);
    mock.mockClear();

    await sendOutreachEmail({ contactId: CONTACT_ID });
    await sendOutreachEmail({ contactId: CONTACT_ID, resend: true });

    const first = mock.mock.calls[0]?.[0];
    const second = mock.mock.calls[1]?.[0];

    // The template appends the recipient name; the greeting must not repeat it.
    expect(first?.greeting).not.toContain("Jane");
    expect(first?.subject).toBeTruthy();
    expect(second?.subject).not.toBe(first?.subject);
    // Outreach is sent as the team, never as the signed-in admin.
    expect(first?.senderName).toBe("Outreach Team");
    expect(first?.senderRole).toBe("ScholarBase");
  });

  it("refuses to email an unsubscribed contact", async () => {
    seedContact({ status: "UNSUBSCRIBED" });
    const { sendOutreachEmail } = await import("@/app/actions/outreach");

    const result = await sendOutreachEmail({ contactId: CONTACT_ID });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/opted out/i);
    }
  });

  it("marks unsubscribed when the email is opted out", async () => {
    fakeDb.store.seed("outreachEmailUnsubscribe", {
      id: "u-1",
      email: "jane@university.edu",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    });
    seedContact();
    const { sendOutreachEmail } = await import("@/app/actions/outreach");

    const result = await sendOutreachEmail({ contactId: CONTACT_ID });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/opted out/i);
    }

    const rows = fakeDb.store.table("outreach");
    expect(rows[0].status).toBe("UNSUBSCRIBED");
  });

  it("fails when the email provider fails", async () => {
    seedContact();
    sendEmailResult = { success: false, error: "Provider error" };
    const { sendOutreachEmail } = await import("@/app/actions/outreach");

    const result = await sendOutreachEmail({ contactId: CONTACT_ID });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Provider error");
    }

    const rows = fakeDb.store.table("outreach");
    expect(rows[0].status).toBe("PENDING"); // not flipped on failure
  });

  it("rejects a missing contact", async () => {
    const { sendOutreachEmail } = await import("@/app/actions/outreach");

    const result = await sendOutreachEmail({ contactId: "does-not-exist" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/not found/i);
    }
  });

  it("applies rate limits", async () => {
    seedContact();
    rateLimitAllowed = false;
    const { sendOutreachEmail } = await import("@/app/actions/outreach");

    const result = await sendOutreachEmail({ contactId: CONTACT_ID });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Rate limit exceeded");
    }
  });
});

describe("markOutreachStatus", () => {
  it("marks a contact as replied", async () => {
    seedContact({ status: "PENDING" });
    const { markOutreachStatus } = await import("@/app/actions/outreach");

    const result = await markOutreachStatus({ contactId: CONTACT_ID, status: "REPLIED" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("REPLIED");
    }

    const rows = fakeDb.store.table("outreach");
    expect(rows[0].status).toBe("REPLIED");
    expect(rows[0].emailSentAt).toBeInstanceOf(Date);
  });

  it("marks a contact as bounced", async () => {
    seedContact();
    const { markOutreachStatus } = await import("@/app/actions/outreach");

    const result = await markOutreachStatus({ contactId: CONTACT_ID, status: "BOUNCED" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("BOUNCED");
    }

    const rows = fakeDb.store.table("outreach");
    expect(rows[0].status).toBe("BOUNCED");
  });

  it("is idempotent when status is unchanged", async () => {
    seedContact({ status: "OUTREACHED" });
    const { markOutreachStatus } = await import("@/app/actions/outreach");

    const result = await markOutreachStatus({ contactId: CONTACT_ID, status: "OUTREACHED" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("OUTREACHED");
    }
  });

  it("refuses to move an opted-out address back to pending", async () => {
    seedContact({ status: "UNSUBSCRIBED" });
    fakeDb.store.seed("outreachEmailUnsubscribe", {
      id: "u-1",
      email: "jane@university.edu",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    });
    const { markOutreachStatus } = await import("@/app/actions/outreach");

    const result = await markOutreachStatus({
      contactId: CONTACT_ID,
      status: "PENDING",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/unsubscribed through the email link/i);
    }

    const rows = fakeDb.store.table("outreach");
    expect(rows[0].status).toBe("UNSUBSCRIBED");
  });

  it("rejects a non-admin", async () => {
    isAdminResult = false;
    const { markOutreachStatus } = await import("@/app/actions/outreach");

    const result = await markOutreachStatus({ contactId: CONTACT_ID, status: "BOUNCED" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/not authorized/i);
    }
  });
});

describe("resubscribeOutreachContact", () => {
  it("moves an admin-marked unsubscribe back to pending", async () => {
    seedContact({ status: "UNSUBSCRIBED" });
    const { resubscribeOutreachContact } = await import(
      "@/app/actions/outreach"
    );

    const result = await resubscribeOutreachContact({
      contactId: CONTACT_ID,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("PENDING");
    }

    const rows = fakeDb.store.table("outreach");
    expect(rows[0].status).toBe("PENDING");
    // Outreach history is kept.
    expect(rows[0].sendCount).toBe(0);
  });

  it("restores a previously emailed contact as OUTREACHED, not PENDING", async () => {
    seedContact({ status: "UNSUBSCRIBED", sendCount: 2 });
    const { resubscribeOutreachContact } = await import(
      "@/app/actions/outreach"
    );

    const result = await resubscribeOutreachContact({
      contactId: CONTACT_ID,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("OUTREACHED");
    }

    const rows = fakeDb.store.table("outreach");
    expect(rows[0].status).toBe("OUTREACHED");
    expect(rows[0].sendCount).toBe(2);
  });

  it("keeps the recipient's own unsubscribe authoritative", async () => {
    seedContact({ status: "UNSUBSCRIBED" });
    fakeDb.store.seed("outreachEmailUnsubscribe", {
      id: "u-1",
      email: "jane@university.edu",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    });
    const { resubscribeOutreachContact } = await import(
      "@/app/actions/outreach"
    );

    const result = await resubscribeOutreachContact({
      contactId: CONTACT_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/unsubscribed through the email link/i);
    }

    const rows = fakeDb.store.table("outreach");
    expect(rows[0].status).toBe("UNSUBSCRIBED");
    // The opt-out list itself is never touched.
    expect(fakeDb.store.table("outreachEmailUnsubscribe")).toHaveLength(1);
  });

  it("keeps the opt-out list intact when the contact is revived", async () => {
    seedContact({ status: "UNSUBSCRIBED" });
    const { resubscribeOutreachContact } = await import(
      "@/app/actions/outreach"
    );

    await resubscribeOutreachContact({ contactId: CONTACT_ID });

    expect(fakeDb.store.table("outreachEmailUnsubscribe")).toHaveLength(0);
  });

  it("is a no-op for a contact that is not unsubscribed", async () => {
    seedContact({ status: "OUTREACHED", sendCount: 3 });
    const { resubscribeOutreachContact } = await import(
      "@/app/actions/outreach"
    );

    const result = await resubscribeOutreachContact({
      contactId: CONTACT_ID,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("OUTREACHED");
    }

    const rows = fakeDb.store.table("outreach");
    expect(rows[0].status).toBe("OUTREACHED");
    expect(rows[0].sendCount).toBe(3);
  });

  it("rejects a non-admin", async () => {
    isAdminResult = false;
    seedContact({ status: "UNSUBSCRIBED" });
    const { resubscribeOutreachContact } = await import(
      "@/app/actions/outreach"
    );

    const result = await resubscribeOutreachContact({
      contactId: CONTACT_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/not authorized/i);
    }
  });

  it("rejects a missing contact", async () => {
    const { resubscribeOutreachContact } = await import(
      "@/app/actions/outreach"
    );

    const result = await resubscribeOutreachContact({
      contactId: "does-not-exist",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/not found/i);
    }
  });
});

describe("deleteOutreachContact", () => {
  it("deletes a contact", async () => {
    seedContact();
    const { deleteOutreachContact } = await import("@/app/actions/outreach");

    const result = await deleteOutreachContact({ contactId: CONTACT_ID });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.id).toBe("string");
    }
    expect(fakeDb.store.table("outreach")).toHaveLength(0);
  });

  it("rejects a missing contact", async () => {
    const { deleteOutreachContact } = await import("@/app/actions/outreach");

    const result = await deleteOutreachContact({ contactId: "does-not-exist" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/not found/i);
    }
  });
});

const csvFile = (name: string, contents: string) =>
  new File([contents], name, { type: "text/csv" });

const uploadFormData = (file: File, sheet?: string) => {
  const formData = new FormData();
  formData.append("file", file);
  if (sheet) formData.append("sheet", sheet);
  return formData;
};

describe("previewOutreachImport", () => {
  it("parses a CSV upload", async () => {
    const { previewOutreachImport } = await import("@/app/actions/outreach");

    const result = await previewOutreachImport(
      uploadFormData(
        csvFile(
          "contacts.csv",
          "Name,Email\nJane,jane@university.edu\nBob,bob@university.edu",
        ),
      ),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fileName).toBe("contacts.csv");
      expect(result.data.sheets).toEqual([]);
      expect(result.data.sheetName).toBeNull();
      expect(result.data.rows).toHaveLength(2);
      expect(result.data.rows[0]).toMatchObject({
        name: "Jane",
        email: "jane@university.edu",
      });
    }
  });

  it("parses an XLSX upload", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Contacts");
    sheet.addRow(["Name", "Email"]);
    sheet.addRow(["Jane", "jane@university.edu"]);
    const written = (await workbook.xlsx.writeBuffer()) as unknown as Uint8Array;

    const { previewOutreachImport } = await import("@/app/actions/outreach");
    const result = await previewOutreachImport(
      uploadFormData(
        new File([new Uint8Array(written).buffer], "contacts.xlsx"),
      ),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sheets).toEqual(["Contacts"]);
      expect(result.data.sheetName).toBe("Contacts");
      expect(result.data.rows).toHaveLength(1);
    }
  });

  it("reads the worksheet chosen by the admin", async () => {
    const workbook = new ExcelJS.Workbook();
    const october = workbook.addWorksheet("October");
    october.addRow(["Name", "Email"]);
    october.addRow(["Jane", "jane@university.edu"]);
    const november = workbook.addWorksheet("November");
    november.addRow(["Name", "Email"]);
    november.addRow(["Bob", "bob@university.edu"]);
    const written = (await workbook.xlsx.writeBuffer()) as unknown as Uint8Array;

    const { previewOutreachImport } = await import("@/app/actions/outreach");
    const result = await previewOutreachImport(
      uploadFormData(
        new File([new Uint8Array(written).buffer], "contacts.xlsx"),
        "November",
      ),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sheets).toEqual(["October", "November"]);
      expect(result.data.sheetName).toBe("November");
      expect(result.data.rows[0].email).toBe("bob@university.edu");
    }
  });

  it("reports a file without a header row", async () => {
    const { previewOutreachImport } = await import("@/app/actions/outreach");

    const result = await previewOutreachImport(
      uploadFormData(csvFile("contacts.csv", "Jane,jane@university.edu")),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/no header row/i);
    }
  });

  it("rejects a non-admin", async () => {
    isAdminResult = false;
    const { previewOutreachImport } = await import("@/app/actions/outreach");

    const result = await previewOutreachImport(
      uploadFormData(csvFile("contacts.csv", "Name,Email\nJane,jane@x.edu")),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/not authorized/i);
    }
  });

  it("rejects an unsupported file type", async () => {
    const { previewOutreachImport } = await import("@/app/actions/outreach");

    const result = await previewOutreachImport(
      uploadFormData(new File(["hello"], "contacts.pdf")),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/unsupported file type/i);
    }
  });

  it("tells the admin to re-save legacy .xls files", async () => {
    const { previewOutreachImport } = await import("@/app/actions/outreach");

    const result = await previewOutreachImport(
      uploadFormData(new File(["legacy"], "contacts.xls")),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/save the sheet as \.xlsx/i);
    }
  });

  it("reports a file without an email column", async () => {
    const { previewOutreachImport } = await import("@/app/actions/outreach");

    const result = await previewOutreachImport(
      uploadFormData(csvFile("contacts.csv", "Name,Phone\nJane,12345")),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/no email column/i);
    }
  });
});

describe("importOutreachContacts", () => {
  it("creates contacts in one batch", async () => {
    const { importOutreachContacts } = await import("@/app/actions/outreach");

    const result = await importOutreachContacts({
      rows: [
        { name: "Jane", email: "jane@university.edu" },
        { name: "Bob", email: "bob@university.edu" },
      ],
    });

    expect(result).toEqual({
      success: true,
      data: { created: 2, updated: 0, skipped: 0 },
    });

    const rows = fakeDb.store.table("outreach");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      status: "PENDING",
      source: "file-import",
      createdById: ADMIN,
    });
  });

  it("refreshes existing contacts without resetting outreach history", async () => {
    seedContact({ status: "OUTREACHED", sendCount: 2 });
    const { importOutreachContacts } = await import("@/app/actions/outreach");

    const result = await importOutreachContacts({
      rows: [
        {
          name: "Jane Updated",
          email: "jane@university.edu",
          institution: "New University",
        },
      ],
    });

    expect(result).toEqual({
      success: true,
      data: { created: 0, updated: 1, skipped: 0 },
    });

    const rows = fakeDb.store.table("outreach");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "Jane Updated",
      institution: "New University",
      status: "OUTREACHED",
      sendCount: 2,
    });
  });

  it("skips addresses on the opt-out list and never deletes them", async () => {
    fakeDb.store.seed("outreachEmailUnsubscribe", {
      id: "u-1",
      email: "opted-out@university.edu",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    });
    const { importOutreachContacts } = await import("@/app/actions/outreach");

    const result = await importOutreachContacts({
      rows: [
        { name: "Opted Out", email: "opted-out@university.edu" },
        { name: "Jane", email: "jane@university.edu" },
      ],
    });

    expect(result).toEqual({
      success: true,
      data: { created: 1, updated: 0, skipped: 1 },
    });
    expect(fakeDb.store.table("outreachEmailUnsubscribe")).toHaveLength(1);
  });

  it("collapses duplicate emails in the payload", async () => {
    const { importOutreachContacts } = await import("@/app/actions/outreach");

    const result = await importOutreachContacts({
      rows: [
        { name: "Jane", email: "jane@university.edu" },
        { name: "Jane Again", email: "JANE@university.edu" },
      ],
    });

    expect(result).toEqual({
      success: true,
      data: { created: 1, updated: 0, skipped: 1 },
    });
  });

  it("skips a malformed row instead of failing the whole batch", async () => {
    const { importOutreachContacts } = await import("@/app/actions/outreach");

    const result = await importOutreachContacts({
      rows: [
        { name: "Jane", email: "jane@university.edu" },
        { name: "Missing Email" },
        { name: "Bad Email", email: "not-an-email" },
        {
          name: "Long Notes",
          email: "bob@university.edu",
          notes: "n".repeat(MAX_OUTREACH_NOTES + 1),
        },
      ],
    });

    expect(result).toEqual({
      success: true,
      data: { created: 1, updated: 0, skipped: 3 },
    });

    const rows = fakeDb.store.table("outreach");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ email: "jane@university.edu" });
  });

  it("imports an email-only row with a blank name", async () => {
    const { importOutreachContacts } = await import("@/app/actions/outreach");

    const result = await importOutreachContacts({
      rows: [{ name: "", email: "nameless@university.edu" }],
    });

    expect(result).toEqual({
      success: true,
      data: { created: 1, updated: 0, skipped: 0 },
    });

    expect(fakeDb.store.table("outreach")[0]).toMatchObject({
      name: "",
      email: "nameless@university.edu",
      status: "PENDING",
    });
  });

  it("fails closed when rate-limit protection is degraded", async () => {
    rateLimitDegraded = true;
    const { importOutreachContacts } = await import("@/app/actions/outreach");

    const result = await importOutreachContacts({
      rows: [{ name: "Jane", email: "jane@university.edu" }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/temporarily unavailable/i);
    }
    expect(fakeDb.store.table("outreach")).toHaveLength(0);
  });

  it("rejects a non-admin", async () => {
    isAdminResult = false;
    const { importOutreachContacts } = await import("@/app/actions/outreach");

    const result = await importOutreachContacts({
      rows: [{ name: "Jane", email: "jane@university.edu" }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/not authorized/i);
    }
  });
});

describe("sendOutreachBatch", () => {
  it("sends to every pending contact with a different template each", async () => {
    const ids = seedContacts(MAX_OUTREACH_BATCH_SIZE);
    const { sendOutreachBatch } = await import("@/app/actions/outreach");
    const mock = vi.mocked(emailModule.sendScholarOutreachEmail);

    const result = await sendOutreachBatch({ contactIds: ids });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        sent: MAX_OUTREACH_BATCH_SIZE,
        skipped: 0,
        failed: 0,
      });
    }

    const subjects = mock.mock.calls.map(([payload]) => payload.subject);
    expect(subjects).toHaveLength(MAX_OUTREACH_BATCH_SIZE);
    expect(new Set(subjects).size).toBe(MAX_OUTREACH_BATCH_SIZE);

    const rows = fakeDb.store.table("outreach");
    expect(rows.every((row) => row.status === "OUTREACHED")).toBe(true);
    expect(rows.every((row) => row.sendCount === 1)).toBe(true);
  });

  it("claims one rate-limit slot per delivered email", async () => {
    const ids = seedContacts(3);
    const { sendOutreachBatch } = await import("@/app/actions/outreach");

    await sendOutreachBatch({ contactIds: ids });

    expect(rateLimitModule.checkRateLimit).toHaveBeenCalledTimes(3);
  });

  it("skips contacts that are already emailed or opted out", async () => {
    seedContact({ status: "OUTREACHED", sendCount: 1 });
    fakeDb.store.seed("outreach", {
      id: "c-2",
      name: "Opted Out",
      email: "opted-out@university.edu",
      institution: null,
      role: null,
      source: null,
      notes: null,
      status: "PENDING",
      sendCount: 0,
      outreachedAt: null,
      emailSentAt: null,
      createdById: ADMIN,
      userId: null,
      createdAt: new Date("2026-01-02"),
      updatedAt: new Date("2026-01-02"),
    });
    fakeDb.store.seed("outreachEmailUnsubscribe", {
      id: "u-1",
      email: "opted-out@university.edu",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    });
    const { sendOutreachBatch } = await import("@/app/actions/outreach");

    const result = await sendOutreachBatch({
      contactIds: [CONTACT_ID, "c-2"],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ sent: 0, skipped: 2, failed: 0 });
    }
    expect(emailModule.sendScholarOutreachEmail).not.toHaveBeenCalled();

    const rows = fakeDb.store.table("outreach");
    expect(rows.find((row) => row.id === "c-2")?.status).toBe("UNSUBSCRIBED");
    expect(rows.find((row) => row.id === CONTACT_ID)?.status).toBe("OUTREACHED");
  });

  it("skips contacts who already have an account", async () => {
    const ids = seedContacts(2);
    fakeDb.store.seed("user", {
      id: "u-member",
      email: "scholar1@university.edu",
      name: "Existing Member",
      isAdmin: false,
      isDeleted: false,
      isFrozen: false,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    });
    const { sendOutreachBatch } = await import("@/app/actions/outreach");

    const result = await sendOutreachBatch({ contactIds: ids });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ sent: 1, skipped: 1, failed: 0 });
      expect(
        result.data.results.find((item) => item.id === ids[0])?.error,
      ).toMatch(/already belongs to a ScholarBase member/i);
    }
  });

  it("resends to already-contacted recipients when asked", async () => {
    seedContact({ status: "OUTREACHED", sendCount: 1 });
    const { sendOutreachBatch } = await import("@/app/actions/outreach");

    const result = await sendOutreachBatch({
      contactIds: [CONTACT_ID],
      resend: true,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sent).toBe(1);
    }

    const rows = fakeDb.store.table("outreach");
    expect(rows[0]).toMatchObject({ status: "OUTREACHED", sendCount: 2 });
  });

  it("records only the emails that were delivered", async () => {
    const ids = seedContacts(2);
    const mock = vi.mocked(emailModule.sendScholarOutreachEmail);
    mock.mockImplementationOnce(async () => ({
      success: false,
      error: "Provider error",
    }));
    const { sendOutreachBatch } = await import("@/app/actions/outreach");

    const result = await sendOutreachBatch({ contactIds: ids });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ sent: 1, failed: 1, skipped: 0 });
      const failedItem = result.data.results.find(
        (item) => item.status === "failed",
      );
      expect(failedItem?.error).toBe("Provider error");
    }

    const rows = fakeDb.store.table("outreach");
    expect(rows.find((row) => row.id === ids[0])?.status).toBe("PENDING");
    expect(rows.find((row) => row.id === ids[1])?.status).toBe("OUTREACHED");
  });

  it("stops the batch when the rate limiter blocks", async () => {
    const ids = seedContacts(2);
    rateLimitAllowed = false;
    const { sendOutreachBatch } = await import("@/app/actions/outreach");

    const result = await sendOutreachBatch({ contactIds: ids });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Rate limit exceeded");
    }
    expect(emailModule.sendScholarOutreachEmail).not.toHaveBeenCalled();
  });

  it("only sends to pending contacts outside resend mode", async () => {
    seedContact({ status: "REPLIED", sendCount: 1 });
    const { sendOutreachBatch } = await import("@/app/actions/outreach");

    const result = await sendOutreachBatch({ contactIds: [CONTACT_ID] });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ sent: 0, skipped: 1, failed: 0 });
    }
    expect(emailModule.sendScholarOutreachEmail).not.toHaveBeenCalled();
  });

  it("rejects more contacts than one batch allows", async () => {
    const ids = seedContacts(MAX_OUTREACH_BATCH_SIZE + 1);
    const { sendOutreachBatch } = await import("@/app/actions/outreach");

    const result = await sendOutreachBatch({ contactIds: ids });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/between 1 and/i);
    }
  });

  it("rejects a non-admin", async () => {
    isAdminResult = false;
    seedContact();
    const { sendOutreachBatch } = await import("@/app/actions/outreach");

    const result = await sendOutreachBatch({ contactIds: [CONTACT_ID] });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/not authorized/i);
    }
  });
});
