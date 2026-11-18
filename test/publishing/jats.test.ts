import { describe, expect, it } from "vitest";

import { buildJatsXml } from "@/lib/publishing/jats";

const article = {
  id: "article-1",
  title: "Research & practice",
  abstract: "A <useful> abstract.",
  keywords: "policy, evidence",
  jelCodes: "M12, O33",
  fundingStatement: "No specific funding.",
  dataAvailabilityStatement: null,
  ethicsStatement: null,
  competingInterests: null,
  aiUseStatement: null,
  doi: "10.5281/zenodo.123",
  isbn: null,
  volume: 1,
  issue: 2,
  firstPage: "1",
  lastPage: "12",
  pageRange: "1–12",
  publishedAt: new Date("2026-01-02T00:00:00.000Z"),
  authors: [{
    name: "Asha Rao",
    affiliation: "Example University",
    orcid: "0000-0002-1825-0097",
    rorId: "https://ror.org/03vek6s52",
    creditRoles: ["Methodology", "Writing – original draft"],
  }],
  fileName: "article.pdf",
  sizeBytes: 100,
  publicationNotices: [],
};

const venue = {
  id: "venue-1",
  slug: "journal",
  name: "ScholarBase Journal",
  type: "JOURNAL" as const,
  coverImageUrl: null,
  publisherName: "ScholarBase",
  issn: null,
  eissn: "12345678",
  frequency: null,
  contactEmail: null,
  launchedAt: null,
  isPublished: true,
  isDemo: false,
  aimsAndScope: null,
  authorGuidelines: null,
  peerReviewPolicy: null,
  ethicsPolicy: null,
  editorName: null,
  editorAffiliation: null,
  editorOrcid: null,
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  createdAt: new Date(),
  updatedAt: new Date(),
  board: [],
};

describe("buildJatsXml", () => {
  it("emits escaped, citable JATS metadata without fabricating full text", () => {
    const xml = buildJatsXml(article, venue, "https://scholarbase.app/sbj/journal/article/article-1");

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('article-type="research-article"');
    expect(xml).toContain("Research &amp; practice");
    expect(xml).toContain("M12");
    expect(xml).toContain("Writing – original draft");
    expect(xml).toContain('institution-id-type="ROR"');
    expect(xml).toContain('contrib-id-type="orcid"');
    expect(xml).toContain("<abstract>A &lt;useful&gt; abstract.</abstract>");
    expect(xml).not.toContain("<body>");
  });
});
