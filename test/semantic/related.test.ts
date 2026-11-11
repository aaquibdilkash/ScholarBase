import { beforeEach, describe, expect, it, vi } from "vitest";

import { getRelatedContent } from "@/lib/semantic/related";

const db = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const delegate = (name: string) => ({
    findMany: (args: unknown) => db.findMany(name, args),
  });

  return {
    default: {
      $queryRaw: (...args: unknown[]) => db.queryRaw(...args),
      user: delegate("user"),
      socialPost: delegate("socialPost"),
      publication: delegate("publication"),
      article: delegate("article"),
      helpPost: delegate("helpPost"),
      contribution: delegate("contribution"),
      researchTool: delegate("researchTool"),
      researchGrant: delegate("researchGrant"),
      course: delegate("course"),
      journal: delegate("journal"),
      result: delegate("result"),
      researchSurvey: delegate("researchSurvey"),
      callForPaper: delegate("callForPaper"),
      admission: delegate("admission"),
      academicPosition: delegate("academicPosition"),
      supervisor: delegate("supervisor"),
      recommendation: delegate("recommendation"),
      journalReview: delegate("journalReview"),
    },
  };
});

function sqlText(call: unknown): string {
  return (call as { strings: string[] }).strings.join("?");
}

describe("related content lookup", () => {
  beforeEach(() => {
    db.queryRaw.mockReset();
    db.findMany.mockReset();
  });

  it("uses one HNSW-shaped query over the entity's own table", async () => {
    db.queryRaw.mockResolvedValue([{ id: "p2", similarity: "0.9" }]);
    db.findMany.mockResolvedValue([
      { id: "p2", title: "A paper", authors: "A. Author" },
    ]);

    await getRelatedContent("PUBLICATION", "p1");

    expect(db.queryRaw).toHaveBeenCalledTimes(1);

    const sql = sqlText(db.queryRaw.mock.calls[0][0]);

    expect(sql).toContain('FROM "Publication" AS candidate');
    expect(sql).toContain('candidate."embedding" <=>');
    expect(sql).toContain('candidate."isDeleted" = false');
    expect(sql).toContain('candidate."id" <> ?');
    expect(sql).not.toContain("APPROVED");
  });

  it("restricts contribution neighbours to approved rows", async () => {
    db.queryRaw.mockResolvedValue([{ id: "c2", similarity: "0.7" }]);
    db.findMany.mockResolvedValue([{ id: "c2", title: "Travel grant" }]);

    const items = await getRelatedContent("CONTRIBUTION", "c1");

    expect(sqlText(db.queryRaw.mock.calls[0][0])).toContain(
      `"status" = 'APPROVED'`,
    );
    expect(items).toEqual([
      {
        id: "c2",
        href: "/contributions/c2",
        title: "Travel grant",
        subtitle: undefined,
        avatarUrl: null,
        imageUrl: null,
        authorName: undefined,
        authorHandle: undefined,
        similarity: 0.7,
      },
    ]);
  });

  it("hydrates scholars and articles with their public hrefs", async () => {
    db.queryRaw.mockResolvedValue([
      { id: "u2", similarity: "0.95" },
      { id: "u3", similarity: "0.6" },
    ]);
    db.findMany.mockImplementation(async (name: string) =>
      name === "user"
        ? [
            {
              id: "u3",
              name: "Ada",
              handle: "ada",
              followersCount: 12,
              followingCount: 3,
              reputation: 20,
            },
            {
              id: "u2",
              name: "Grace",
              handle: null,
              followersCount: 0,
              followingCount: 0,
              reputation: 0,
            },
          ]
        : [],
    );

    const scholars = await getRelatedContent("SCHOLAR", "u1");

    expect(scholars).toEqual([
      {
        id: "u2",
        href: "/scholars/u2",
        title: "Grace",
        subtitle: undefined,
        avatarUrl: null,
        imageUrl: null,
        authorName: "Grace",
        authorHandle: undefined,
        stats: { followers: 0, following: 0, reputation: 0 },
        similarity: 0.95,
      },
      {
        id: "u3",
        href: "/scholars/u3",
        title: "Ada",
        subtitle: "@ada",
        avatarUrl: null,
        imageUrl: null,
        authorName: "Ada",
        authorHandle: "ada",
        stats: { followers: 12, following: 3, reputation: 20 },
        similarity: 0.6,
      },
    ]);
  });

  it("uses the article slug rather than its id", async () => {
    db.queryRaw.mockResolvedValue([{ id: "a2", similarity: "0.8" }]);
    db.findMany.mockResolvedValue([
      { id: "a2", slug: "on-engines", title: "On engines" },
    ]);

    const items = await getRelatedContent("ARTICLE", "a1");

    expect(items[0]?.href).toBe("/blog/on-engines");
    expect(items[0]?.avatarUrl).toBeNull();
    expect(items[0]?.authorName).toBeUndefined();
  });

  it("builds parent-scoped hrefs for recommendations and reviews", async () => {
    db.queryRaw.mockResolvedValue([{ id: "r2", similarity: "0.75" }]);
    db.findMany.mockResolvedValue([
      {
        id: "r2",
        feedback: "<p>Great mentorship.</p>",
        supervisorId: "s1",
        supervisor: { name: "Dr. Hopper" },
      },
    ]);

    const recommendations = await getRelatedContent("RECOMMENDATION", "r1");

    expect(recommendations[0]).toMatchObject({
      href: "/supervisor/s1/recommendation/r2",
      title: "Great mentorship.",
      subtitle: "Dr. Hopper",
    });

    db.queryRaw.mockResolvedValue([{ id: "j2", similarity: "0.7" }]);
    db.findMany.mockResolvedValue([
      {
        id: "j2",
        feedback: "Rigorous but slow.",
        journalId: "j1",
        journal: { title: "Journal of Graphs" },
      },
    ]);

    const reviews = await getRelatedContent("JOURNAL_REVIEW", "j3");

    expect(reviews[0]).toMatchObject({
      href: "/journals/j1/review/j2",
      title: "Rigorous but slow.",
      subtitle: "Journal of Graphs",
    });
  });

  it("returns early when the source has no vector yet", async () => {
    db.queryRaw.mockResolvedValue([]);

    await expect(getRelatedContent("COURSE", "c1")).resolves.toEqual([]);
    expect(db.findMany).not.toHaveBeenCalled();
  });

  it("drops matches whose row disappeared before hydration", async () => {
    db.queryRaw.mockResolvedValue([
      { id: "e2", similarity: "0.8" },
      { id: "e3", similarity: "0.4" },
    ]);
    db.findMany.mockResolvedValue([
      { id: "e3", title: "Graphs workshop", location: "Bengaluru" },
    ]);

    const items = await getRelatedContent("CALL_FOR_PAPER", "e1");

    expect(items.map((item) => item.id)).toEqual(["e3"]);
  });

  it("returns an empty section instead of failing the page", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    db.queryRaw.mockRejectedValue(new Error("pgvector unavailable"));

    await expect(getRelatedContent("ARTICLE", "a1")).resolves.toEqual([]);
    expect(error).toHaveBeenCalled();

    error.mockRestore();
  });

  it("caps the caller's limit at the shared match ceiling", async () => {
    db.queryRaw.mockResolvedValue([]);

    await getRelatedContent("ACADEMIC_POSITION", "v1", 500);

    const values = (db.queryRaw.mock.calls[0][0] as { values: number[] }).values;

    expect(values).toContain(50);
  });

  it("never leaks an anonymous author through the related sidebar", async () => {
    const author = {
      id: "u2",
      name: "Ada",
      handle: "ada",
      avatarUrl: "https://cdn.example/ada.png",
    };
    const cases = [
      {
        type: "JOURNAL" as const,
        row: {
          id: "j2",
          title: "Nature",
          publisher: "Springer",
          isAnonymous: true,
          author,
        },
      },
      {
        type: "SUPERVISOR" as const,
        row: {
          id: "s2",
          name: "Prof Ada",
          university: "Oxford",
          department: "CS",
          isAnonymous: true,
          author,
        },
      },
      {
        type: "RECOMMENDATION" as const,
        row: {
          id: "r2",
          feedback: "<p>Great mentorship.</p>",
          supervisorId: "s1",
          isAnonymous: true,
          supervisor: { name: "Dr. Hopper" },
          author,
        },
      },
      {
        type: "JOURNAL_REVIEW" as const,
        row: {
          id: "j2",
          feedback: "Rigorous but slow.",
          journalId: "j1",
          isAnonymous: true,
          journal: { title: "Journal of Graphs" },
          author,
        },
      },
    ];

    for (const { type, row } of cases) {
      db.queryRaw.mockResolvedValue([{ id: row.id, similarity: "0.9" }]);
      db.findMany.mockResolvedValue([row]);

      const [item] = await getRelatedContent(type, "source");

      expect(item, type).toMatchObject({
        avatarUrl: null,
        authorName: "Anonymous Scholar",
        authorHandle: undefined,
      });
    }
  });

  it("still shows the real author for public related rows", async () => {
    db.queryRaw.mockResolvedValue([{ id: "s2", similarity: "0.9" }]);
    db.findMany.mockResolvedValue([
      {
        id: "s2",
        name: "Prof Ada",
        university: "Oxford",
        department: "CS",
        isAnonymous: false,
        author: {
          id: "u2",
          name: "Ada",
          handle: "ada",
          avatarUrl: "https://cdn.example/ada.png",
        },
      },
    ]);

    const [item] = await getRelatedContent("SUPERVISOR", "s1");

    expect(item).toMatchObject({
      avatarUrl: "https://cdn.example/ada.png",
      authorName: "Ada",
      authorHandle: "ada",
    });
  });
});
