import { beforeEach, describe, expect, it, vi } from "vitest";

import * as emailModule from "@/lib/email";
import {
  runOutreachCron,
  type OutreachCronConfig,
  type OutreachRedis,
} from "@/lib/outreach/sender";
import { SCHOLAR_OUTREACH_VARIANTS } from "@/lib/emails/scholarInvite";
import { fakeDb, resetFakeDb } from "../fake-prisma";

const ADMIN = "u-admin";
const NOW = new Date("2026-03-10T12:00:00.000Z");
const DAY = "2026-03-10";

let sendEmailResult: { success: boolean; error?: string } = { success: true };

const redisState = vi.hoisted(() => ({
  fromEnvThrows: false,
  // Assigned in beforeEach; the mock factory only reads it when called.
  instance: null as unknown,
}));

vi.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: () => {
      if (redisState.fromEnvThrows) throw new Error("Missing UPSTASH_REDIS_REST_URL");
      return redisState.instance;
    },
  },
}));

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

vi.mock("@/lib/email", () => ({
  sendScholarOutreachEmail: vi.fn(async () => sendEmailResult),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, degraded: false })),
  RATE_LIMIT_ERROR: "Rate limit exceeded",
}));

class FakeRedis implements OutreachRedis {
  readonly store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(
    key: string,
    value: string,
    options?: { nx?: boolean; px?: number; ex?: number },
  ): Promise<"OK" | null> {
    if (options?.nx && this.store.has(key)) return null;
    this.store.set(key, value);
    return "OK";
  }

  async incr(key: string): Promise<number> {
    const next = Number(this.store.get(key) ?? 0) + 1;
    this.store.set(key, String(next));
    return next;
  }

  async expire(_key: string, _seconds: number): Promise<number> {
    return 1;
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }
}

function config(overrides: Partial<OutreachCronConfig> = {}): Partial<OutreachCronConfig> {
  return {
    windowStartUtc: 0,
    windowEndUtc: 0,
    probability: 1,
    dailyLimit: 20,
    domainDailyLimit: 1,
    minAgeHours: 24,
    ...overrides,
  };
}

function seedContact(overrides: Record<string, unknown> = {}) {
  fakeDb.store.seed("outreach", {
    id: "c-1",
    name: "Jane Scholar",
    email: "jane@university.edu",
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
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    ...overrides,
  });
}

function seedMember(email: string) {
  fakeDb.store.seed("user", {
    id: `u-${email}`,
    email,
    name: "Existing Member",
    isAdmin: false,
    isDeleted: false,
    isFrozen: false,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  });
}

const run = (redis: FakeRedis, overrides: Parameters<typeof runOutreachCron>[0] = {}) =>
  runOutreachCron({
    now: NOW,
    random: () => 0,
    redis,
    config: config(),
    ...overrides,
  });

beforeEach(() => {
  resetFakeDb();
  vi.mocked(emailModule.sendScholarOutreachEmail).mockClear();
  sendEmailResult = { success: true };
  redisState.fromEnvThrows = false;
  redisState.instance = new FakeRedis();
});

describe("runOutreachCron guards", () => {
  it("does nothing outside the sending window", async () => {
    seedContact();
    const result = await run(new FakeRedis(), {
      config: config({ windowStartUtc: 7, windowEndUtc: 21 }),
      now: new Date("2026-03-10T03:00:00.000Z"),
    });

    expect(result.reason).toBe("outside_window");
    expect(emailModule.sendScholarOutreachEmail).not.toHaveBeenCalled();
  });

  it("skips the run when the probability roll fails", async () => {
    seedContact();
    const result = await run(new FakeRedis(), {
      random: () => 0.9,
      config: config({ probability: 0.4 }),
    });

    expect(result.reason).toBe("probability_skip");
    expect(emailModule.sendScholarOutreachEmail).not.toHaveBeenCalled();
  });

  it("fails closed when Redis is unavailable", async () => {
    seedContact();
    const result = await runOutreachCron({
      now: NOW,
      random: () => 0,
      redis: null,
      config: config(),
    });

    expect(result).toMatchObject({ success: true, sent: 0, reason: "redis_unavailable" });
    expect(emailModule.sendScholarOutreachEmail).not.toHaveBeenCalled();
  });

  it("fails closed when the Redis client cannot be constructed", async () => {
    seedContact();
    redisState.fromEnvThrows = true;

    const result = await runOutreachCron({
      now: NOW,
      random: () => 0,
      config: config(),
    });

    expect(result).toMatchObject({ success: true, sent: 0, reason: "redis_unavailable" });
    expect(emailModule.sendScholarOutreachEmail).not.toHaveBeenCalled();
  });

  it("uses Redis.fromEnv when no client is injected", async () => {
    seedContact();

    const result = await runOutreachCron({
      now: NOW,
      random: () => 0,
      config: config(),
    });

    expect(result.sent).toBe(1);
  });

  it("supports a sending window that crosses midnight", async () => {
    seedContact();

    const result = await runOutreachCron({
      now: new Date("2026-03-10T23:00:00.000Z"),
      random: () => 0,
      redis: new FakeRedis(),
      config: config({ windowStartUtc: 21, windowEndUtc: 5 }),
    });

    expect(result.sent).toBe(1);
  });

  it("refuses to run while another invocation holds the lock", async () => {
    seedContact();
    const redis = new FakeRedis();
    redis.store.set("cron:outreach:lock", "someone-else");

    const result = await run(redis);

    expect(result.reason).toBe("locked");
    expect(emailModule.sendScholarOutreachEmail).not.toHaveBeenCalled();
  });

  it("stops at the daily cap", async () => {
    seedContact();
    const redis = new FakeRedis();
    redis.store.set(`cron:outreach:sent:${DAY}`, "20");

    const result = await run(redis);

    expect(result.reason).toBe("daily_limit_reached");
    expect(emailModule.sendScholarOutreachEmail).not.toHaveBeenCalled();
  });

  it("ignores contacts that are too new", async () => {
    seedContact({ createdAt: new Date("2026-03-10T11:00:00.000Z") });

    const result = await run(new FakeRedis());

    expect(result).toMatchObject({ sent: 0, reason: "no_candidates" });
    expect(emailModule.sendScholarOutreachEmail).not.toHaveBeenCalled();
  });
});

describe("runOutreachCron eligibility", () => {
  it("sends one email and records it", async () => {
    seedContact();
    const redis = new FakeRedis();

    const result = await run(redis);

    expect(result).toMatchObject({ success: true, sent: 1, contactId: "c-1" });
    expect(emailModule.sendScholarOutreachEmail).toHaveBeenCalledTimes(1);

    const [row] = fakeDb.store.table("outreach");
    expect(row).toMatchObject({ status: "OUTREACHED", sendCount: 1 });

    expect(redis.store.get(`cron:outreach:sent:${DAY}`)).toBe("1");
    expect(redis.store.get(`cron:outreach:rotation:${DAY}`)).toBe("1");
  });

  it("never emails an address on the unsubscribe list", async () => {
    seedContact();
    fakeDb.store.seed("outreachEmailUnsubscribe", {
      id: "u-1",
      email: "jane@university.edu",
      createdAt: new Date("2026-02-01"),
      updatedAt: new Date("2026-02-01"),
    });

    const result = await run(new FakeRedis());

    expect(result).toMatchObject({ sent: 0, reason: "no_eligible_contact" });
    expect(emailModule.sendScholarOutreachEmail).not.toHaveBeenCalled();
  });

  it("never cold-emails an existing member", async () => {
    seedContact();
    seedMember("jane@university.edu");

    const result = await run(new FakeRedis());

    expect(result).toMatchObject({ sent: 0, reason: "no_eligible_contact" });
    expect(emailModule.sendScholarOutreachEmail).not.toHaveBeenCalled();
  });

  it("skips a contact linked to a user account", async () => {
    seedContact({ userId: "u-linked" });

    const result = await run(new FakeRedis());

    // The candidate query already excludes linked contacts.
    expect(result).toMatchObject({ sent: 0, reason: "no_candidates" });
  });

  it("sends at most one email per recipient domain per day", async () => {
    seedContact({ id: "c-1", email: "a@university.edu" });
    seedContact({ id: "c-2", email: "b@university.edu" });
    const redis = new FakeRedis();

    const result = await run(redis, { limit: 2 });

    expect(result.sent).toBe(1);
    expect(emailModule.sendScholarOutreachEmail).toHaveBeenCalledTimes(1);
  });

  it("treats a domain limit of zero as unlimited", async () => {
    seedContact({ id: "c-1", email: "a@university.edu" });
    seedContact({ id: "c-2", email: "b@university.edu" });

    const result = await run(new FakeRedis(), {
      limit: 2,
      config: config({ domainDailyLimit: 0 }),
    });

    expect(result.sent).toBe(2);
  });

  it("ignores a candidate whose address has no usable domain", async () => {
    seedContact({ email: "not-an-email" });

    const result = await run(new FakeRedis());

    expect(result).toMatchObject({ sent: 0, reason: "no_eligible_contact" });
    expect(emailModule.sendScholarOutreachEmail).not.toHaveBeenCalled();
  });

  it("rotates templates between consecutive sends", async () => {
    seedContact({ id: "c-1", email: "a@alpha.edu" });
    seedContact({ id: "c-2", email: "b@beta.edu" });
    const redis = new FakeRedis();

    await run(redis);
    await run(redis);

    const mock = vi.mocked(emailModule.sendScholarOutreachEmail);
    const subjects = mock.mock.calls.map(([payload]) => payload.subject);

    expect(subjects).toHaveLength(2);
    expect(subjects[0]).not.toBe(subjects[1]);
    expect(subjects.every((subject) => SCHOLAR_OUTREACH_VARIANTS.some((v) => v.subject === subject))).toBe(true);
  });

  it("keeps the contact PENDING when the provider fails", async () => {
    seedContact();
    sendEmailResult = { success: false, error: "Provider down" };
    const redis = new FakeRedis();

    const result = await run(redis);

    expect(result).toMatchObject({
      success: false,
      sent: 0,
      reason: "send_failed",
      error: "Provider down",
    });

    const [row] = fakeDb.store.table("outreach");
    expect(row.status).toBe("PENDING");
    expect(row.sendCount).toBe(0);
    // The domain reservation is released so a later run can retry.
    expect(redis.store.has("cron:outreach:domain:university.edu:2026-03-10")).toBe(false);
  });
});

describe("runOutreachCron dry run", () => {
  it("reports the chosen contact without sending or mutating", async () => {
    seedContact();
    const redis = new FakeRedis();

    const result = await run(redis, { dryRun: true });

    expect(result).toMatchObject({
      success: true,
      sent: 0,
      dryRun: true,
      reason: "would_send",
      contactId: "c-1",
    });
    expect(result.template).toBeDefined();
    expect(emailModule.sendScholarOutreachEmail).not.toHaveBeenCalled();

    const [row] = fakeDb.store.table("outreach");
    expect(row.status).toBe("PENDING");
    expect(redis.store.size).toBe(0);
  });

  it("ignores the probability roll so selection can be verified", async () => {
    seedContact();
    const result = await run(new FakeRedis(), {
      dryRun: true,
      random: () => 0.99,
      config: config({ probability: 0 }),
    });

    expect(result.reason).toBe("would_send");
  });
});
