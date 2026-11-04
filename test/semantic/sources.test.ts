import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadEmbeddingSources } from "@/lib/semantic/sources";
import type { EmbeddingEntityType } from "@/lib/semantic/text";

const db = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const delegate = (name: string) => ({
    findMany: (args: unknown) => db.findMany(name, args),
  });

  return {
    default: {
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
      researchEvent: delegate("researchEvent"),
      phdAdmission: delegate("phdAdmission"),
      jobVacancy: delegate("jobVacancy"),
      supervisor: delegate("supervisor"),
      recommendation: delegate("recommendation"),
      journalReview: delegate("journalReview"),
    },
  };
});

type Case = {
  entityType: EmbeddingEntityType;
  delegate: string;
  row: Record<string, unknown>;
  text: string;
  isDeleted?: boolean;
};

const CASES: Case[] = [
  {
    entityType: "SCHOLAR",
    delegate: "user",
    row: {
      id: "u1",
      isDeleted: false,
      name: "Ada",
      handle: "ada",
      bio: null,
      interests: "mathematics",
    },
    text: "Ada\nada\nmathematics",
  },
  {
    entityType: "SOCIAL_POST",
    delegate: "socialPost",
    row: { id: "s1", isDeleted: false, content: "Graph cores." },
    text: "Graph cores.",
  },
  {
    entityType: "PUBLICATION",
    delegate: "publication",
    row: {
      id: "p1",
      isDeleted: false,
      title: "Graphs",
      authors: "A. Author",
      keywords: null,
      domain: "CS",
      journalOrConference: null,
      abstract: "Abstract.",
    },
    text: "Graphs\nA. Author\nCS\nAbstract.",
  },
  {
    entityType: "ARTICLE",
    delegate: "article",
    row: {
      id: "a1",
      isDeleted: false,
      title: "On engines",
      excerpt: null,
      content: "<p>Body</p>",
    },
    text: "On engines\nBody",
  },
  {
    entityType: "HELP_POST",
    delegate: "helpPost",
    row: {
      id: "h1",
      isDeleted: false,
      title: "Dataset",
      subject: "Data",
      category: "QUESTION",
      message: "Where?",
    },
    text: "Dataset\nData\nQUESTION\nWhere?",
  },
  {
    entityType: "CONTRIBUTION",
    delegate: "contribution",
    row: {
      id: "c1",
      isDeleted: false,
      title: "Travel grant",
      message: "Happy to help.",
    },
    text: "Travel grant\nHappy to help.",
  },
  {
    entityType: "RESEARCH_TOOL",
    delegate: "researchTool",
    row: {
      id: "t1",
      isDeleted: false,
      name: "Zotero",
      use: "References",
      description: "Collects papers.",
    },
    text: "Zotero\nReferences\nCollects papers.",
  },
  {
    entityType: "RESEARCH_GRANT",
    delegate: "researchGrant",
    row: {
      id: "g1",
      isDeleted: false,
      title: "Early career",
      description: "For postdocs.",
    },
    text: "Early career\nFor postdocs.",
  },
  {
    entityType: "COURSE",
    delegate: "course",
    row: {
      id: "co1",
      isDeleted: false,
      title: "Statistics",
      provider: "OpenLearn",
      instructor: "Dr. Bayes",
      format: "Online",
      level: "Intermediate",
      description: "Inference.",
    },
    text: "Statistics\nOpenLearn\nDr. Bayes\nOnline\nIntermediate\nInference.",
  },
  {
    entityType: "JOURNAL",
    delegate: "journal",
    row: {
      id: "j1",
      isDeleted: false,
      title: "Journal of Graphs",
      publisher: "Graph Press",
      about: null,
      subjectArea: "CS",
    },
    text: "Journal of Graphs\nGraph Press\nCS",
  },
  {
    entityType: "RESULT",
    delegate: "result",
    row: {
      id: "r1",
      isDeleted: false,
      title: "NET result",
      description: "Answer key.",
      category: "NET",
      conductingBody: "NTA",
      session: "June",
    },
    text: "NET result\nAnswer key.\nNET\nNTA\nJune",
  },
  {
    entityType: "RESEARCH_SURVEY",
    delegate: "researchSurvey",
    row: {
      id: "su1",
      isDeleted: false,
      title: "Lab safety",
      description: "Ten minutes.",
    },
    text: "Lab safety\nTen minutes.",
  },
  {
    entityType: "RESEARCH_EVENT",
    delegate: "researchEvent",
    row: {
      id: "e1",
      isDeleted: false,
      title: "Workshop",
      location: "Bengaluru",
      description: "Graph theory.",
    },
    text: "Workshop\nBengaluru\nGraph theory.",
  },
  {
    entityType: "PHD_ADMISSION",
    delegate: "phdAdmission",
    row: {
      id: "ad1",
      isDeleted: false,
      university: "IISc",
      department: "CSE",
      description: "Autumn intake.",
    },
    text: "IISc\nCSE\nAutumn intake.",
  },
  {
    entityType: "JOB_VACANCY",
    delegate: "jobVacancy",
    row: {
      id: "v1",
      isDeleted: false,
      title: "Assistant Professor",
      institution: "IIT Bombay",
      department: "CSE",
      subject: "Algorithms",
      description: "Tenure track.",
    },
    text: "Assistant Professor\nIIT Bombay\nCSE\nAlgorithms\nTenure track.",
  },
  {
    entityType: "SUPERVISOR",
    delegate: "supervisor",
    row: {
      id: "sp1",
      isDeleted: false,
      name: "Dr. Hopper",
      university: "Yale",
      department: "CS",
      about: "Compilers.",
    },
    text: "Dr. Hopper\nYale\nCS\nCompilers.",
  },
  {
    entityType: "RECOMMENDATION",
    delegate: "recommendation",
    row: {
      id: "re1",
      isDeleted: false,
      feedback: "Great mentorship.",
      supervisor: {
        name: "Dr. Hopper",
        university: "Yale",
        department: "CS",
        about: "Compilers.",
      },
    },
    text: "Great mentorship.\nDr. Hopper\nYale\nCS\nCompilers.",
  },
  {
    entityType: "JOURNAL_REVIEW",
    delegate: "journalReview",
    row: {
      id: "jr1",
      isDeleted: false,
      feedback: "Rigorous.",
      journal: {
        title: "Journal of Graphs",
        publisher: "Graph Press",
        subjectArea: "CS",
        about: null,
      },
    },
    text: "Rigorous.\nJournal of Graphs\nGraph Press\nCS",
  },
];

describe("embedding source loading", () => {
  beforeEach(() => {
    db.findMany.mockReset();
  });

  it("short-circuits without a query when the batch is empty", async () => {
    await expect(loadEmbeddingSources("ARTICLE", [])).resolves.toEqual(
      new Map(),
    );
    expect(db.findMany).not.toHaveBeenCalled();
  });

  it.each(CASES)(
    "loads and projects $entityType rows",
    async ({ entityType, delegate, row, text }) => {
      db.findMany.mockResolvedValue([row]);

      const sources = await loadEmbeddingSources(entityType, [
        row.id as string,
      ]);

      expect(db.findMany).toHaveBeenCalledWith(
        delegate,
        expect.objectContaining({ where: { id: { in: [row.id] } } }),
      );
      expect(sources.get(row.id as string)).toEqual({
        isDeleted: false,
        text,
      });
    },
  );

  it("propagates the deleted flag so the worker can drop the job", async () => {
    db.findMany.mockResolvedValue([
      { id: "a1", isDeleted: true, title: "T", excerpt: null, content: "C" },
    ]);

    const sources = await loadEmbeddingSources("ARTICLE", ["a1"]);

    expect(sources.get("a1")?.isDeleted).toBe(true);
  });

  it("returns no entries for rows that no longer exist", async () => {
    db.findMany.mockResolvedValue([]);

    const sources = await loadEmbeddingSources("PUBLICATION", ["missing"]);

    expect(sources.size).toBe(0);
  });
});
