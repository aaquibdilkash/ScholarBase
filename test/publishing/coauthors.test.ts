import { describe, expect, it } from "vitest";

import {
  MAX_CO_AUTHORS,
  MAX_CO_AUTHOR_AFFILIATION,
  MAX_CO_AUTHOR_NAME,
  isValidOrcid,
  parseCoAuthorDraft,
  storedAuthorEmails,
} from "@/lib/publishing/coauthors";

/**
 * The submission form posts a JSON array of co-author rows. The server rejects
 * rather than tolerates: every accepted name is printed in the byline.
 */
describe("parseCoAuthorDraft", () => {
  it("validates ORCID check digits and accepts ORCID URLs", () => {
    expect(isValidOrcid("0000-0002-1825-0097")).toBe(true);
    expect(isValidOrcid("https://orcid.org/0000-0002-1825-0097")).toBe(true);
    expect(isValidOrcid("0000-0002-1825-0098")).toBe(false);
  });

  it("extracts corresponding and co-author emails for conflict checks", () => {
    expect(storedAuthorEmails({
      correspondingAuthor: { name: "A", email: "A@Example.edu" },
      coAuthors: [{ name: "B", email: "b@example.edu" }],
    })).toEqual(["a@example.edu", "b@example.edu"]);
  });
  it("treats an empty field and an empty array as no co-authors", () => {
    expect(parseCoAuthorDraft("")).toEqual({ ok: true, authors: [] });
    expect(parseCoAuthorDraft("   ")).toEqual({ ok: true, authors: [] });
    expect(parseCoAuthorDraft("[]")).toEqual({ ok: true, authors: [] });
  });

  it("trims values and drops fields that were left blank", () => {
    const result = parseCoAuthorDraft(
      JSON.stringify([
        {
          name: "  Asha Rao  ",
          affiliation: " IISc Bengaluru ",
          orcid: " ",
          email: "",
        },
      ]),
    );

    expect(result).toEqual({
      ok: true,
      authors: [
        { name: "Asha Rao", affiliation: "IISc Bengaluru" },
      ],
    });
  });

  it("drops a completely blank row", () => {
    const result = parseCoAuthorDraft(
      JSON.stringify([
        { name: "", affiliation: "", orcid: "", email: "" },
        { name: "Vikram Shah" },
      ]),
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.authors).toHaveLength(1);
  });

  it("rejects a row that carries data but no name", () => {
    const result = parseCoAuthorDraft(
      JSON.stringify([{ name: "", affiliation: "IISc" }]),
    );

    expect(result).toEqual({
      ok: false,
      message: "Every co-author needs a name.",
    });
  });

  it("deduplicates names case-insensitively", () => {
    const result = parseCoAuthorDraft(
      JSON.stringify([{ name: "Asha Rao" }, { name: "asha rao" }]),
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.authors).toHaveLength(1);
  });

  it(`rejects more than ${MAX_CO_AUTHORS} co-authors`, () => {
    const rows = Array.from({ length: MAX_CO_AUTHORS + 1 }, (_, index) => ({
      name: `Author ${index}`,
    }));

    const result = parseCoAuthorDraft(JSON.stringify(rows));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/at most/i);
  });

  it("rejects an over-long name", () => {
    const result = parseCoAuthorDraft(
      JSON.stringify([{ name: "x".repeat(MAX_CO_AUTHOR_NAME + 1) }]),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/name/i);
  });

  it("rejects an over-long affiliation", () => {
    const result = parseCoAuthorDraft(
      JSON.stringify([
        {
          name: "Asha Rao",
          affiliation: "x".repeat(MAX_CO_AUTHOR_AFFILIATION + 1),
        },
      ]),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/affiliation/i);
  });

  it("rejects an over-long ORCID iD", () => {
    const result = parseCoAuthorDraft(
      JSON.stringify([{ name: "Asha Rao", orcid: "x".repeat(65) }]),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/ORCID/i);
  });

  it("rejects an invalid email", () => {
    const result = parseCoAuthorDraft(
      JSON.stringify([{ name: "Asha Rao", email: "not-an-email" }]),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/not a valid/i);
  });

  it("accepts a valid email", () => {
    const result = parseCoAuthorDraft(
      JSON.stringify([{ name: "Asha Rao", email: "asha@example.edu" }]),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.authors[0]).toEqual({
        name: "Asha Rao",
        email: "asha@example.edu",
      });
    }
  });

  it("stores selected CRediT roles in the structured author entry", () => {
    const result = parseCoAuthorDraft(JSON.stringify([
      { name: "Asha Rao", creditRoles: ["Methodology", "Writing – original draft"] },
    ]));

    expect(result).toEqual({
      ok: true,
      authors: [{
        name: "Asha Rao",
        creditRoles: ["Methodology", "Writing – original draft"],
      }],
    });
  });

  it("rejects roles outside the CRediT taxonomy", () => {
    const result = parseCoAuthorDraft(JSON.stringify([
      { name: "Asha Rao", creditRoles: ["Invented role"] },
    ]));

    expect(result).toEqual({
      ok: false,
      message: "Choose contributor roles from the CRediT taxonomy.",
    });
  });

  it("rejects malformed JSON and non-array payloads", () => {
    expect(parseCoAuthorDraft("{").ok).toBe(false);
    expect(parseCoAuthorDraft(JSON.stringify({ name: "Asha Rao" })).ok).toBe(
      false,
    );
  });

  it("skips entries that are not objects", () => {
    const result = parseCoAuthorDraft(
      JSON.stringify(["Asha Rao", null, 42, { name: "Vikram Shah" }]),
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.authors).toHaveLength(1);
  });
});
