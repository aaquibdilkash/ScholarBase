import { describe, expect, it } from "vitest";

import {
  buildArticleText,
  buildContributionText,
  buildCourseText,
  buildHelpPostText,
  buildJobVacancyText,
  buildJournalReviewText,
  buildJournalText,
  buildPhdAdmissionText,
  buildPublicationText,
  buildRecommendationText,
  buildCallForPaperText,
  buildResearchGrantText,
  buildResearchSurveyText,
  buildResearchToolText,
  buildResultText,
  buildScholarText,
  buildSocialPostText,
  buildSupervisorText,
  EMBEDDING_TABLES,
  EMBEDDING_TRIGGER_FIELDS,
} from "@/lib/semantic/text";

describe("semantic text projections", () => {
  it("builds a scholar profile from every declared field in order", () => {
    const text = buildScholarText({
      name: "  Ada Lovelace ",
      handle: " ada ",
      bio: "Analytical engines\nand computation",
      interests: " mathematics ",
    });

    expect(text).toBe(
      "Ada Lovelace\nada\nAnalytical engines\nand computation\nmathematics",
    );
  });

  it("skips empty and missing scholar fields", () => {
    expect(
      buildScholarText({
        name: null,
        handle: "",
        bio: "   ",
        interests: "distributed systems",
      }),
    ).toBe("distributed systems");
  });

  it("returns an empty string when a scholar has no embeddable text", () => {
    expect(
      buildScholarText({
        name: " ",
        handle: null,
        bio: null,
        interests: "",
      }),
    ).toBe("");
  });

  it("uses the whole social post content", () => {
    expect(
      buildSocialPostText({ content: "  A new result on graph cores.  " }),
    ).toBe("A new result on graph cores.");
  });

  it("combines publication metadata and abstract", () => {
    const text = buildPublicationText({
      title: "Graph cores in practice",
      authors: "A. Lovelace, C. Babbage",
      keywords: "graphs; cores",
      domain: "Computer Science",
      journalOrConference: "Journal of Graphs",
      abstract: "We study core decompositions.",
    });

    expect(text).toBe(
      [
        "Graph cores in practice",
        "A. Lovelace, C. Babbage",
        "graphs; cores",
        "Computer Science",
        "Journal of Graphs",
        "We study core decompositions.",
      ].join("\n"),
    );
  });

  it("skips missing publication fields", () => {
    expect(
      buildPublicationText({
        title: "A title",
        authors: "An Author",
        keywords: null,
        domain: " ",
        journalOrConference: null,
        abstract: "An abstract.",
      }),
    ).toBe("A title\nAn Author\nAn abstract.");
  });

  it("strips rich-text HTML from article bodies", () => {
    expect(
      buildArticleText({
        title: "On engines",
        excerpt: null,
        content:
          "<p>First <strong>paragraph</strong>.</p><p>Second &amp; last.</p>",
      }),
    ).toBe("On engines\nFirst paragraph.\n\nSecond & last.");
  });

  it("combines help post routing fields", () => {
    expect(
      buildHelpPostText({
        title: "Need a dataset",
        subject: "Data science",
        category: "QUESTION",
        message: "Where can I find an annotated corpus?",
      }),
    ).toBe(
      "Need a dataset\nData science\nQUESTION\nWhere can I find an annotated corpus?",
    );
  });

  it("combines contribution title and message", () => {
    expect(
      buildContributionText({
        title: "Travel grant",
        message: "Happy to support conference travel.",
      }),
    ).toBe("Travel grant\nHappy to support conference travel.");
  });

  it("combines research tool fields", () => {
    expect(
      buildResearchToolText({
        name: "Zotero",
        use: "Reference management",
        description: "Collects and cites papers.",
      }),
    ).toBe("Zotero\nReference management\nCollects and cites papers.");
  });

  it("combines research grant fields", () => {
    expect(
      buildResearchGrantText({
        title: "Early career grant",
        description: "For postdoctoral researchers.",
      }),
    ).toBe("Early career grant\nFor postdoctoral researchers.");
  });

  it("combines course metadata", () => {
    expect(
      buildCourseText({
        title: "Applied statistics",
        provider: "OpenLearn",
        instructor: "Dr. Bayes",
        format: "Online",
        level: "Intermediate",
        description: "Inference for practitioners.",
      }),
    ).toBe(
      "Applied statistics\nOpenLearn\nDr. Bayes\nOnline\nIntermediate\nInference for practitioners.",
    );
  });

  it("combines journal profile fields", () => {
    expect(
      buildJournalText({
        title: "Journal of Graphs",
        publisher: "Graph Press",
        about: "Core decompositions and applications.",
        subjectArea: "Computer Science",
      }),
    ).toBe(
      "Journal of Graphs\nGraph Press\nCore decompositions and applications.\nComputer Science",
    );
  });

  it("combines result metadata", () => {
    expect(
      buildResultText({
        title: "UGC NET June 2024",
        description: "Final answer key released.",
        category: "NET",
        conductingBody: "NTA",
        session: "June 2024",
      }),
    ).toBe("UGC NET June 2024\nFinal answer key released.\nNET\nNTA\nJune 2024");
  });

  it("combines survey fields", () => {
    expect(
      buildResearchSurveyText({
        title: "Lab safety practices",
        description: "Ten-minute survey for lab managers.",
      }),
    ).toBe("Lab safety practices\nTen-minute survey for lab managers.");
  });

  it("combines event fields", () => {
    expect(
      buildCallForPaperText({
        title: "Graphs workshop",
        location: "Bengaluru",
        description: "Two days of applied graph theory.",
      }),
    ).toBe("Graphs workshop\nBengaluru\nTwo days of applied graph theory.");
  });

  it("combines PhD admission fields", () => {
    expect(
      buildPhdAdmissionText({
        university: "IISc",
        department: "Computer Science",
        description: "Applications open for the autumn session.",
      }),
    ).toBe(
      "IISc\nComputer Science\nApplications open for the autumn session.",
    );
  });

  it("combines vacancy fields", () => {
    expect(
      buildJobVacancyText({
        title: "Assistant Professor",
        institution: "IIT Bombay",
        department: "CSE",
        subject: "Algorithms",
        description: "Tenure-track position.",
      }),
    ).toBe(
      "Assistant Professor\nIIT Bombay\nCSE\nAlgorithms\nTenure-track position.",
    );
  });

  it("combines supervisor profile fields", () => {
    expect(
      buildSupervisorText({
        name: "Dr. Hopper",
        university: "Yale",
        department: "Computer Science",
        about: "Compilers and programming languages.",
      }),
    ).toBe("Dr. Hopper\nYale\nComputer Science\nCompilers and programming languages.");
  });

  it("adds supervisor context to recommendation feedback", () => {
    expect(
      buildRecommendationText({
        feedback: "Clear expectations and quick replies.",
        supervisor: {
          name: "Dr. Hopper",
          university: "Yale",
          department: "Computer Science",
          about: "Compilers.",
        },
      }),
    ).toBe(
      "Clear expectations and quick replies.\nDr. Hopper\nYale\nComputer Science\nCompilers.",
    );
  });

  it("still embeds recommendation feedback without a parent", () => {
    expect(
      buildRecommendationText({
        feedback: "Great mentorship.",
        supervisor: null,
      }),
    ).toBe("Great mentorship.");
  });

  it("adds journal context to review feedback", () => {
    expect(
      buildJournalReviewText({
        feedback: "Rigorous but slow.",
        journal: {
          title: "Journal of Graphs",
          publisher: "Graph Press",
          subjectArea: "Computer Science",
          about: "Core decompositions.",
        },
      }),
    ).toBe(
      "Rigorous but slow.\nJournal of Graphs\nGraph Press\nComputer Science\nCore decompositions.",
    );
  });

  it("still embeds review feedback without a parent", () => {
    expect(
      buildJournalReviewText({ feedback: "Fair review.", journal: null }),
    ).toBe("Fair review.");
  });

  it("declares a table and trigger field list for every entity type", () => {
    expect(Object.keys(EMBEDDING_TABLES).sort()).toEqual(
      Object.keys(EMBEDDING_TRIGGER_FIELDS).sort(),
    );

    for (const [entityType, table] of Object.entries(EMBEDDING_TABLES)) {
      expect(table, entityType).toMatch(/^[A-Z][A-Za-z]+$/);
      expect(
        EMBEDDING_TRIGGER_FIELDS[
          entityType as keyof typeof EMBEDDING_TRIGGER_FIELDS
        ].length,
        entityType,
      ).toBeGreaterThan(0);
    }
  });

  it("watches only the owned columns for review tables", () => {
    expect(EMBEDDING_TRIGGER_FIELDS.RECOMMENDATION).toEqual(["feedback"]);
    expect(EMBEDDING_TRIGGER_FIELDS.JOURNAL_REVIEW).toEqual(["feedback"]);
  });
});
