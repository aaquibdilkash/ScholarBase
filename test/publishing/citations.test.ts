import { describe, expect, it } from "vitest";

import {
  buildAuthorList,
  buildBibtexRecord,
  buildHighwireMeta,
  buildPlainCitation,
  buildRisRecord,
  citationYear,
  formatPageRange,
  highwireDate,
  invertAuthorName,
  parseCoAuthors,
  type CitationArticle,
  type CitationVenue,
} from "@/lib/publishing/citations";

const journal: CitationVenue = {
  slug: "scholarbase-journal-of-empirical-management",
  name: "ScholarBase Journal of Empirical Management",
  type: "JOURNAL",
  issn: "1234-567X",
  eissn: null,
  publisherName: "ScholarBase",
};

const conference: CitationVenue = {
  slug: "scholarbase-annual-conference",
  name: "ScholarBase Annual Conference",
  type: "CONFERENCE",
  issn: null,
  eissn: null,
  publisherName: "ScholarBase",
};

const article: CitationArticle = {
  id: "ms_1",
  title: "Rural clinics & the cost of care",
  keywords: "health, rural policy",
  doi: "10.1234/sb.2026.001",
  volume: 2,
  issue: 1,
  firstPage: "9",
  lastPage: "24",
  publishedAt: new Date("2026-03-05T00:00:00Z"),
  isbn: null,
  authors: [
    { name: "Jane Doe", affiliation: "IIT Delhi" },
    { name: "Arun Rao" },
  ],
};

describe("parseCoAuthors", () => {
  it("reads a bare array", () => {
    expect(
      parseCoAuthors([
        { name: " Arun Rao ", affiliation: " IIT " },
        { affiliation: "no name" },
        { name: "" },
      ]),
    ).toEqual([{ name: "Arun Rao", affiliation: "IIT", orcid: null }]);
  });

  it("reads the historical wrapper object", () => {
    expect(parseCoAuthors({ coAuthors: [{ name: "Meera Iyer" }] })).toEqual([
      { name: "Meera Iyer", affiliation: null, orcid: null },
    ]);
  });

  it("returns nothing for malformed JSON", () => {
    for (const value of [null, undefined, "Jane Doe", 42, { coAuthors: "x" }]) {
      expect(parseCoAuthors(value)).toEqual([]);
    }
  });
});

describe("buildAuthorList", () => {
  it("puts the submitting author first and drops duplicates", () => {
    const authors = buildAuthorList({ name: "Jane Doe", orcidUrl: "0000-1" }, [
      { name: "jane doe" },
      { name: "Arun Rao" },
    ]);

    expect(authors).toEqual([
      { name: "Jane Doe", orcid: "0000-1" },
      { name: "Arun Rao", affiliation: null, orcid: null },
    ]);
  });

  it("skips an unnamed primary author without failing", () => {
    expect(buildAuthorList({ name: null }, [{ name: "Arun Rao" }])).toEqual([
      { name: "Arun Rao", affiliation: null, orcid: null },
    ]);
  });
});

describe("formatPageRange", () => {
  it("joins a range with an en dash", () => {
    expect(formatPageRange("9", "24")).toBe("9–24");
  });

  it("collapses an equal range", () => {
    expect(formatPageRange("9", "9")).toBe("9");
  });

  it("returns a single page or null", () => {
    expect(formatPageRange("9", null)).toBe("9");
    expect(formatPageRange(null, "24")).toBeNull();
    expect(formatPageRange("  ", "")).toBeNull();
  });
});

describe("invertAuthorName", () => {
  it("moves the surname first", () => {
    expect(invertAuthorName("Jane Doe")).toBe("Doe, Jane");
    expect(invertAuthorName("Mary Jane Watson")).toBe("Watson, Mary Jane");
  });

  it("leaves a mononym alone", () => {
    expect(invertAuthorName("Plato")).toBe("Plato");
  });
});

describe("dates", () => {
  it("formats Highwire publication dates as YYYY/MM/DD", () => {
    expect(highwireDate(new Date("2026-03-05T00:00:00Z"))).toBe("2026/03/05");
    expect(highwireDate(null)).toBeNull();
    expect(highwireDate("not a date")).toBeNull();
  });

  it("derives the citation year", () => {
    expect(citationYear(article)).toBe("2026");
    expect(citationYear({ ...article, publishedAt: null })).toBeNull();
  });
});

describe("buildPlainCitation", () => {
  it("includes authors, year, locator and DOI", () => {
    const text = buildPlainCitation(article, journal);

    expect(text).toContain("Jane Doe, Arun Rao");
    expect(text).toContain("(2026).");
    expect(text).toContain(article.title);
    expect(text).toContain("vol. 2, no. 1, pp. 9–24");
    expect(text).toContain("https://doi.org/10.1234/sb.2026.001");
  });

  it("omits the DOI when there is none", () => {
    expect(buildPlainCitation({ ...article, doi: null }, journal)).not.toContain(
      "doi.org",
    );
  });
});

describe("buildRisRecord", () => {
  it("emits a journal record with inverted authors and a terminator", () => {
    const ris = buildRisRecord(article, journal, "https://example.test/a");

    expect(ris).toContain("TY  - JOUR");
    expect(ris).toContain("AU  - Doe, Jane");
    expect(ris).toContain("JO  - ScholarBase Journal of Empirical Management");
    expect(ris).toContain("SP  - 9");
    expect(ris).toContain("EP  - 24");
    expect(ris).toContain("SN  - 1234-567X");
    expect(ris).toContain("UR  - https://example.test/a");
    expect(ris.trimEnd().endsWith("ER  -")).toBe(true);
  });

  it("uses CPAPER and the ISBN for a proceedings paper", () => {
    const ris = buildRisRecord(
      { ...article, isbn: "9783161484100" },
      conference,
      "https://example.test/b",
    );

    expect(ris).toContain("TY  - CPAPER");
    expect(ris).toContain("T2  - ScholarBase Annual Conference");
    expect(ris).toContain("SN  - 9783161484100");
  });
});

describe("buildBibtexRecord", () => {
  it("emits an @article with an escaped title and a page range", () => {
    const bib = buildBibtexRecord(article, journal);

    expect(bib.startsWith("@article{")).toBe(true);
    expect(bib).toContain("title = {Rural clinics \\& the cost of care}");
    expect(bib).toContain("pages = {9--24}");
    expect(bib).toContain("journal = {ScholarBase Journal of Empirical Management}");
    expect(bib).toContain("doi = {10.1234/sb.2026.001}");
  });

  it("emits @inproceedings with a booktitle", () => {
    const bib = buildBibtexRecord(article, conference);

    expect(bib.startsWith("@inproceedings{")).toBe(true);
    expect(bib).toContain("booktitle = {ScholarBase Annual Conference}");
  });

  it("drops empty fields instead of writing blank braces", () => {
    const bib = buildBibtexRecord(
      { ...article, doi: null, issue: null, lastPage: null },
      conference,
    );

    expect(bib).not.toContain("doi = {}");
    expect(bib).not.toContain("number = {}");
    expect(bib).toContain("pages = {9}");
  });
});

describe("buildHighwireMeta", () => {
  it("repeats citation_author and includes the PDF URL", () => {
    const meta = buildHighwireMeta(article, journal, {
      articleUrl: "https://example.test/a",
      pdfUrl: "https://example.test/a.pdf",
    });

    expect(meta.citation_title).toBe(article.title);
    expect(meta.citation_author).toEqual(["Jane Doe", "Arun Rao"]);
    expect(meta.citation_publication_date).toBe("2026/03/05");
    expect(meta.citation_journal_title).toBe(journal.name);
    expect(meta.citation_issn).toBe("1234-567X");
    expect(meta.citation_pdf_url).toBe("https://example.test/a.pdf");
    expect(meta.citation_keywords).toEqual(["health", "rural policy"]);
  });

  it("omits citation_pdf_url when no file exists", () => {
    const meta = buildHighwireMeta(article, journal, {
      articleUrl: "https://example.test/a",
      pdfUrl: null,
    });

    expect(meta).not.toHaveProperty("citation_pdf_url");
  });

  it("uses the conference title key and never emits empty values", () => {
    const meta = buildHighwireMeta(
      { ...article, publishedAt: null, keywords: null, doi: null },
      conference,
      { articleUrl: "https://example.test/b", pdfUrl: null },
    );

    expect(meta.citation_conference_title).toBe(conference.name);
    expect(meta).not.toHaveProperty("citation_journal_title");
    expect(meta).not.toHaveProperty("citation_publication_date");
    expect(meta).not.toHaveProperty("citation_keywords");
    expect(Object.values(meta)).not.toContain("");
  });
});
