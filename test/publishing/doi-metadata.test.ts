/**
 * DOI deposit metadata.
 *
 * These assertions are the contract with Zenodo: the record must name the same
 * authors, pages, licence, and canonical URL as the article page. A regression
 * here is invisible until a DOI is minted, which is irreversible, so every
 * mapped field is pinned.
 */
import { describe, expect, it } from "vitest";

import {
  buildDoiMetadata,
  DoiMetadataError,
  zenodoLicenseId,
  type DoiMetadataInput,
} from "@/lib/publishing/doi-metadata";

const JOURNAL: DoiMetadataInput = {
  article: {
    id: "manuscript-1",
    title: "Phase retrieval for sparse apertures",
    abstract: "We recover phase from <undersampled> data.\n\nSecond paragraph.",
    keywords: "optics, phase retrieval, Optics",
    publishedAt: "2026-03-04T00:00:00.000Z",
    volume: 3,
    issue: 2,
    firstPage: "101",
    lastPage: "118",
    isbn: null,
  },
  authors: [
    {
      name: "Ada Lovelace",
      affiliation: "Analytical Engine Lab",
      orcid: "https://orcid.org/0000-0002-1825-0097",
    },
    { name: "Grace Hopper" },
  ],
  venue: {
    name: "Journal of Computing",
    type: "JOURNAL",
    issn: "1234-567X",
    publisherName: "ScholarBase Press",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  },
  articleUrl: "https://scholarbase.app/sbj/jcs/article/manuscript-1",
};

describe("buildDoiMetadata", () => {
  it("maps a journal article to Zenodo's publication schema", () => {
    expect(buildDoiMetadata(JOURNAL)).toEqual({
      upload_type: "publication",
      publication_type: "article",
      title: "Phase retrieval for sparse apertures",
      creators: [
        {
          name: "Lovelace, Ada",
          orcid: "0000-0002-1825-0097",
          affiliation: "Analytical Engine Lab",
        },
        { name: "Hopper, Grace" },
      ],
      description:
        "<p>We recover phase from &lt;undersampled&gt; data.</p>" +
        "<p>Second paragraph.</p>" +
        '<p>Version of record: <a href="https://scholarbase.app/sbj/jcs/article/manuscript-1">https://scholarbase.app/sbj/jcs/article/manuscript-1</a></p>',
      access_right: "open",
      license: "cc-by-4.0",
      related_identifiers: [
        {
          identifier: "https://scholarbase.app/sbj/jcs/article/manuscript-1",
          relation: "isIdenticalTo",
          resource_type: "publication-article",
        },
      ],
      publication_date: "2026-03-04",
      keywords: ["optics", "phase retrieval"],
      imprint_publisher: "ScholarBase Press",
      journal_title: "Journal of Computing",
      journal_volume: "3",
      journal_issue: "2",
      journal_pages: "101–118",
      issn: "1234-567X",
    });
  });

  it("uses the conference-paper type, title, and ISBN for proceedings", () => {
    const metadata = buildDoiMetadata({
      ...JOURNAL,
      article: { ...JOURNAL.article, isbn: "978-3-16-148410-0" },
      venue: {
        ...JOURNAL.venue,
        name: "Conference on Optics",
        type: "CONFERENCE",
      },
    });

    expect(metadata).toMatchObject({
      publication_type: "conferencepaper",
      conference_title: "Conference on Optics",
      isbn: "978-3-16-148410-0",
      related_identifiers: [
        {
          identifier: "https://scholarbase.app/sbj/jcs/article/manuscript-1",
          relation: "isIdenticalTo",
          resource_type: "publication-conferencepaper",
        },
      ],
    });
    expect(metadata).not.toHaveProperty("journal_title");
    expect(metadata).not.toHaveProperty("issn");
  });

  it("falls back to the title when the abstract is empty", () => {
    const metadata = buildDoiMetadata({
      ...JOURNAL,
      article: { ...JOURNAL.article, abstract: null },
    });

    expect(metadata.description).toBe(
      "<p>Phase retrieval for sparse apertures</p>" +
        '<p>Version of record: <a href="https://scholarbase.app/sbj/jcs/article/manuscript-1">https://scholarbase.app/sbj/jcs/article/manuscript-1</a></p>',
    );
  });

  it("refuses to mint without a title or an author", () => {
    expect(() =>
      buildDoiMetadata({ ...JOURNAL, article: { ...JOURNAL.article, title: " " } }),
    ).toThrow(DoiMetadataError);
    expect(() => buildDoiMetadata({ ...JOURNAL, authors: [] })).toThrow(
      "The manuscript has no author byline.",
    );
  });

  it("maps licences honestly", () => {
    expect(zenodoLicenseId(null)).toBe("cc-by-4.0");
    expect(zenodoLicenseId("https://creativecommons.org/licenses/by/4.0/")).toBe(
      "cc-by-4.0",
    );
    expect(
      zenodoLicenseId("https://creativecommons.org/licenses/by-nc-nd/4.0/"),
    ).toBe("cc-by-nc-nd-4.0");
    expect(zenodoLicenseId("https://creativecommons.org/publicdomain/zero/1.0/")).toBe(
      "cc0-1.0",
    );
    expect(zenodoLicenseId("https://example.org/all-rights-reserved")).toBe(
      "other-open",
    );
  });
});
