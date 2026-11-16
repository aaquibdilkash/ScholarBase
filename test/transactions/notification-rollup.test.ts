/**
 * M8 of the launch-readiness audit — rollup counts were inflatable by one
 * person's repeated toggling.
 *
 * The unread rollup row is keyed on (recipientId, targetId, type); the
 * increment path never checked WHO triggered the previous event. A single
 * actor re-triggering the same rollup while the row stayed unread — a vote
 * toggle storm, an unfollow/refollow loop — bumped `count` every time, so
 * "Alice and 4 others upvoted" could be one person.
 *
 * Uses a purpose-built Prisma stub (same approach as
 * notification-fanout.test.ts): the behaviour under test is the TARGETED
 * path's transaction, and the shared fake-prisma does not model
 * findFirst/orderBy on notifications.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type NotificationRow = {
  id: string;
  recipientId: string;
  actorId: string;
  type: string;
  targetType: string;
  targetId: string | null;
  title: string;
  body: string;
  count: number;
  readAt: Date | null;
  updatedAt: Date;
};

let rows: NotificationRow[] = [];
let nextId = 1;

vi.mock("@/lib/db", () => ({
  default: {
    user: {
      findUnique: vi.fn(async () => ({ name: "Ada", handle: "ada" })),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        notification: {
          findFirst: vi.fn(async (args: { where: Record<string, unknown> }) => {
            const w = args.where;
            const matches = rows.filter(
              (r) =>
                r.recipientId === w.recipientId &&
                r.targetId === w.targetId &&
                r.type === w.type &&
                r.readAt === null,
            );
            return matches[matches.length - 1] ?? null;
          }),
          update: vi.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
            const row = rows.find((r) => r.id === args.where.id)!;
            Object.assign(row, args.data);
            return row;
          }),
          create: vi.fn(async (args: { data: Partial<NotificationRow> }) => {
            const row = {
              id: `n-${nextId++}`,
              updatedAt: new Date(),
              // Real column default: unread until read.
              readAt: null,
              ...args.data,
            } as NotificationRow;
            rows.push(row);
            return row;
          }),
        },
      }),
    ),
  },
}));
vi.mock("@/lib/qstash", () => ({
  queueNotification: vi.fn(async () => undefined),
}));
vi.mock("@/lib/notification-links", () => ({
  getModuleNoun: vi.fn(() => "feed post"),
}));

const targeted = (actorId: string, overrides: Record<string, unknown> = {}) => ({
  mode: "TARGETED" as const,
  recipientId: "u-recip",
  actorId,
  type: "NEW_VOTE",
  targetType: "SOCIAL_POST",
  targetId: "post-1",
  title: "New Upvote",
  body: "Machine Learning",
  ...overrides,
});

async function process(payload: Record<string, unknown>) {
  const { processNotificationPayload } = await import("@/lib/notification-processor");
  return processNotificationPayload(payload as never);
}

const unread = () => rows.filter((r) => r.readAt === null);

beforeEach(() => {
  rows = [];
  nextId = 1;
});

describe("TARGETED rollup: same-actor guard", () => {
  it("creates the first notification with count 1", async () => {
    await process(targeted("u-alice"));
    expect(unread()).toHaveLength(1);
    expect(unread()[0].count).toBe(1);
    expect(unread()[0].body).toBe('ada upvoted your feed post "Machine Learning".');
  });

  it("the SAME actor re-triggering does NOT inflate the count (vote toggling)", async () => {
    await process(targeted("u-alice"));
    await process(targeted("u-alice"));
    await process(targeted("u-alice"));

    expect(unread()).toHaveLength(1);
    expect(unread()[0].count).toBe(1);
  });

  it("a DIFFERENT actor increments and the rollup copy counts others", async () => {
    await process(targeted("u-alice"));
    await process(targeted("u-bob"));

    expect(unread()).toHaveLength(1);
    expect(unread()[0].count).toBe(2);
    expect(unread()[0].actorId).toBe("u-bob");
    expect(unread()[0].body).toBe('ada and 1 other upvoted your feed post "Machine Learning".');
  });

  it("guards NEW_FOLLOWER too — refollow loops cannot rack up follows", async () => {
    const follow = (actorId: string) =>
      targeted(actorId, {
        type: "NEW_FOLLOWER",
        targetType: "profile",
        targetId: "u-recip",
      });

    await process(follow("u-alice"));
    await process(follow("u-alice")); // unfollow + refollow while unread
    expect(unread()[0].count).toBe(1);

    await process(follow("u-bob"));
    expect(unread()[0].count).toBe(2);
  });

  it("a read row does not block a fresh unread one (partial-index semantics)", async () => {
    rows.push({
      id: "n-read",
      recipientId: "u-recip",
      actorId: "u-alice",
      type: "NEW_VOTE",
      targetType: "SOCIAL_POST",
      targetId: "post-1",
      title: "New Upvote",
      body: "read",
      count: 3,
      readAt: new Date(),
      updatedAt: new Date(),
    });

    await process(targeted("u-alice"));
    expect(unread()).toHaveLength(1);
    expect(unread()[0].count).toBe(1);
  });

  it("a different target is a different rollup and increments normally", async () => {
    await process(targeted("u-alice"));
    await process(targeted("u-alice", { targetId: "post-2" }));

    expect(unread()).toHaveLength(2);
    expect(unread().every((r) => r.count === 1)).toBe(true);
  });

  it("still no-ops self-notifications", async () => {
    await process(targeted("u-recip"));
    expect(rows).toHaveLength(0);
  });
});

describe("TARGETED rollup: survey-response (aggregated, one row per survey)", () => {
  const survey = (actorId: string, overrides: Record<string, unknown> = {}) =>
    targeted(actorId, {
      type: "survey-response",
      targetType: "survey",
      targetId: "survey-1",
      title: "Someone posted a response to your survey",
      body: "Research survey",
      ...overrides,
    });

  it("creates one row with the survey title in the body", async () => {
    await process(survey("u-alice"));

    const [row] = unread();
    expect(row.count).toBe(1);
    expect(row.actorId).toBe("u-alice");
    expect(row.body).toBe('ada posted a response to "Research survey".');
  });

  it("two different respondents keep ONE row; latest actor wins, body names others", async () => {
    await process(survey("u-alice"));
    await process(survey("u-bob"));

    const unreadRows = unread();
    expect(unreadRows).toHaveLength(1);
    expect(unreadRows[0].count).toBe(2);
    expect(unreadRows[0].actorId).toBe("u-bob");
    expect(unreadRows[0].body).toBe('ada and 1 other posted responses to "Research survey".');
  });

  it("same respondent re-triggering does not inflate the count", async () => {
    await process(survey("u-alice"));
    await process(survey("u-alice"));
    await process(survey("u-alice"));

    expect(unread()).toHaveLength(1);
    expect(unread()[0].count).toBe(1);
    expect(unread()[0].actorId).toBe("u-alice");
  });

  it("each survey is its own rollup", async () => {
    await process(survey("u-alice"));
    await process(survey("u-alice", { targetId: "survey-2", body: "Other survey" }));

    const unreadRows = unread();
    expect(unreadRows).toHaveLength(2);
    expect(unreadRows[0].count).toBe(1);
    const other = unreadRows.find((r) => r.targetId === "survey-2")!;
    expect(other.body).toBe('ada posted a response to "Other survey".');
  });
});

describe("TARGETED rollup: NEW_VOTE copy names the module and the item", () => {
  const vote = (overrides: Record<string, unknown> = {}) =>
    targeted("u-alice", {
      type: "NEW_VOTE",
      targetType: "SOCIAL_POST",
      targetId: "post-1",
      title: "New Upvote",
      body: "Machine Learning",
      ...overrides,
    });

  it("first upvote names the feed post and its title", async () => {
    await process(vote());

    const [row] = unread();
    expect(row.count).toBe(1);
    expect(row.body).toBe('ada upvoted your feed post "Machine Learning".');
  });

  it("aggregate upvote names the feed post and its title", async () => {
    await process(vote());
    await process(vote({ actorId: "u-bob" }));

    const [row] = unread();
    expect(row.count).toBe(2);
    expect(row.body).toBe('ada and 1 other upvoted your feed post "Machine Learning".');
  });

  it("upvote with Untitled title omits the quoted title", async () => {
    await process(vote({ body: "Untitled" }));

    const [row] = unread();
    expect(row.body).toBe("ada upvoted your feed post.");
  });

  it("aggregate upvote with Untitled title omits the quoted title", async () => {
    await process(vote({ body: "Untitled" }));
    await process(vote({ actorId: "u-bob", body: "Untitled" }));

    const [row] = unread();
    expect(row.body).toBe("ada and 1 other upvoted your feed post.");
  });
});
