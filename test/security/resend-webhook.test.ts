/**
 * `POST /api/webhooks/resend`
 *
 * A permanent bounce or a spam complaint is irreversible feedback about the
 * sending domain, so the route must reject anything that is not a genuinely
 * signed Resend event. These tests pin the signature contract (Svix HMAC,
 * timestamp tolerance) and both status transitions.
 */
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { fakeDb, resetFakeDb } from "../fake-prisma";

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

const KEY_BASE64 = "c2VjcmV0LWtleS1mb3ItdGVzdHM=";
const SECRET = `whsec_${KEY_BASE64}`;
const WEBHOOK_URL = "https://scholarbase.app/api/webhooks/resend";

function sign(body: string, id: string, timestamp: string): string {
  return createHmac("sha256", Buffer.from(KEY_BASE64, "base64"))
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
}

function request(
  body: string,
  options: { id?: string; timestamp?: string; signature?: string } = {},
) {
  const id = options.id ?? "msg_1";
  const timestamp = options.timestamp ?? String(Math.floor(Date.now() / 1000));
  const signature = options.signature ?? `v1,${sign(body, id, timestamp)}`;

  return new NextRequest(WEBHOOK_URL, {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": signature,
    },
  });
}

function seedContact(email: string) {
  fakeDb.store.seed("outreach", {
    id: "c-1",
    name: "Jane Scholar",
    email,
    institution: null,
    role: null,
    source: null,
    notes: null,
    status: "OUTREACHED",
    sendCount: 1,
    outreachedAt: new Date("2026-03-01"),
    emailSentAt: new Date("2026-03-01"),
    createdById: "u-admin",
    userId: null,
    createdAt: new Date("2026-02-01"),
    updatedAt: new Date("2026-02-01"),
  });
}

const bounced = (email: string, type = "Permanent") =>
  JSON.stringify({
    type: "email.bounced",
    data: {
      email_id: "em_1",
      to: [email],
      bounce: { type, message: "mailbox does not exist" },
    },
  });

const complained = (email: string) =>
  JSON.stringify({
    type: "email.complained",
    data: { email_id: "em_1", to: [email] },
  });

beforeEach(() => {
  resetFakeDb();
  process.env.RESEND_WEBHOOK_SECRET = SECRET;
});

afterEach(() => {
  delete process.env.RESEND_WEBHOOK_SECRET;
});

describe("POST /api/webhooks/resend", () => {
  it("rejects a missing or invalid signature", async () => {
    const { POST } = await import("@/app/api/webhooks/resend/route");
    const body = bounced("jane@university.edu");

    expect((await POST(request(body, { signature: "v1,not-a-signature" }))).status).toBe(401);

    const unsigned = new NextRequest(WEBHOOK_URL, { method: "POST", body });
    expect((await POST(unsigned)).status).toBe(401);
  });

  it("rejects a stale timestamp", async () => {
    const { POST } = await import("@/app/api/webhooks/resend/route");
    const body = bounced("jane@university.edu");
    const stale = String(Math.floor(Date.now() / 1000) - 10 * 60);

    const response = await POST(request(body, { timestamp: stale }));

    expect(response.status).toBe(401);
  });

  it("marks a permanent bounce as BOUNCED", async () => {
    seedContact("jane@university.edu");
    const { POST } = await import("@/app/api/webhooks/resend/route");

    const response = await POST(request(bounced("jane@university.edu")));

    expect(response.status).toBe(200);
    expect(fakeDb.store.table("outreach")[0].status).toBe("BOUNCED");
  });

  it("leaves the contact alone on a transient bounce", async () => {
    seedContact("jane@university.edu");
    const { POST } = await import("@/app/api/webhooks/resend/route");

    const response = await POST(request(bounced("jane@university.edu", "Transient")));

    expect(response.status).toBe(200);
    expect(fakeDb.store.table("outreach")[0].status).toBe("OUTREACHED");
  });

  it("treats a complaint as a permanent opt-out", async () => {
    seedContact("jane@university.edu");
    const { POST } = await import("@/app/api/webhooks/resend/route");

    const response = await POST(request(complained("jane@university.edu")));

    expect(response.status).toBe(200);
    expect(fakeDb.store.table("outreach")[0].status).toBe("UNSUBSCRIBED");
    expect(fakeDb.store.table("outreachEmailUnsubscribe")).toEqual([
      expect.objectContaining({ email: "jane@university.edu" }),
    ]);
  });

  it("acknowledges unrelated events without touching contacts", async () => {
    seedContact("jane@university.edu");
    const { POST } = await import("@/app/api/webhooks/resend/route");
    const body = JSON.stringify({ type: "email.delivered", data: { to: ["jane@university.edu"] } });

    const response = await POST(request(body));

    expect(response.status).toBe(200);
    expect(fakeDb.store.table("outreach")[0].status).toBe("OUTREACHED");
  });
});
