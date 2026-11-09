import { describe, expect, it } from "vitest";

import {
  MAX_OUTREACH_EMAIL,
  MAX_OUTREACH_INSTITUTION,
  MAX_OUTREACH_NOTES,
  MAX_OUTREACH_ROLE,
  MAX_OUTREACH_SOURCE,
} from "@/lib/constants";
import {
  detectDelimiter,
  outreachRowsFromMatrix,
  parseDelimited,
  parseOutreachCsv,
} from "@/lib/outreach/import";

describe("parseOutreachCsv", () => {
  it("reads the S. No. / Name / Email layout Google Sheets exports", () => {
    const result = parseOutreachCsv(
      [
        "S. No.,Name,Email",
        "1,Trit Sharma,sharma.trtd@gmail.com",
        "2,Harish Verma,vsid0786@gmail.com",
      ].join("\n"),
    );

    expect(result.error).toBeUndefined();
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      row: 2,
      name: "Trit Sharma",
      email: "sharmatrtd@gmail.com",
    });
    expect(result.rows[1]).toMatchObject({
      row: 3,
      name: "Harish Verma",
      email: "vsid0786@gmail.com",
    });
  });

  it("handles BOM, CRLF, and a quoted name containing the delimiter", () => {
    const result = parseOutreachCsv(
      '\uFEFFName,Email\r\n"Doe, Jane",jane@university.edu\r\n',
    );

    expect(result.error).toBeUndefined();
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      name: "Doe, Jane",
      email: "jane@university.edu",
    });
  });

  it("detects a semicolon delimiter", () => {
    const result = parseOutreachCsv("Name;Email\nJane;jane@university.edu");

    expect(result.rows[0]).toMatchObject({
      name: "Jane",
      email: "jane@university.edu",
    });
  });

  it("tolerates a title row above the header row", () => {
    const result = parseOutreachCsv(
      [
        "ScholarBase outreach — November",
        "",
        "Name,Email",
        "Jane,jane@university.edu",
      ].join("\n"),
    );

    expect(result.error).toBeUndefined();
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].row).toBe(4);
  });

  it("ignores a junk 'Emails' column when a real Email column exists", () => {
    const result = parseOutreachCsv(
      [
        "Emails,Name,Email",
        "trk.phd.jmi@gmail.com ipsa bharti <ipsabharti29@gmail.com>,ipsa bharti,ipsabharti29@gmail.com",
        ",Anam Aslam,anamaslam20@gmail.com",
      ].join("\n"),
    );

    expect(result.error).toBeUndefined();
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      name: "ipsa bharti",
      email: "ipsabharti29@gmail.com",
    });
  });

  it("rejects a file without a header row", () => {
    const rowsWithoutHeader = parseOutreachCsv(
      ["Jane Doe,jane@university.edu", "John Roe,john@university.edu"].join(
        "\n",
      ),
    );

    expect(rowsWithoutHeader.rows).toHaveLength(0);
    expect(rowsWithoutHeader.error).toMatch(/no header row/i);

    // A bare email column is no longer inferred either.
    const emailsOnly = parseOutreachCsv(
      ["jane@university.edu", "john@university.edu"].join("\n"),
    );

    expect(emailsOnly.rows).toHaveLength(0);
    expect(emailsOnly.error).toMatch(/no header row/i);
  });

  it("flags invalid rows without dropping the valid ones", () => {
    const result = parseOutreachCsv(
      ["Name,Email", "Jane,not-an-email", "Bob,bob@university.edu"].join("\n"),
    );

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].error).toBe("Invalid email");
    expect(result.rows[1].error).toBeUndefined();
  });

  it("flags duplicate addresses case-insensitively", () => {
    const result = parseOutreachCsv(
      [
        "Name,Email",
        "Jane,jane@university.edu",
        "Jane Again,JANE@university.edu",
      ].join("\n"),
    );

    expect(result.rows[1].error).toBe("Duplicate email");
  });

  it("flags an over-length email instead of truncating it to a different recipient", () => {
    const longEmail = `${"a".repeat(MAX_OUTREACH_EMAIL)}@university.edu`;
    const result = parseOutreachCsv(
      ["Name,Email", `Jane,${longEmail}`, "Bob,bob@university.edu"].join("\n"),
    );

    expect(result.rows[0].error).toBe("Email too long");
    // The address is kept whole so the admin can see what was skipped.
    expect(result.rows[0].email).toBe(longEmail);
    expect(result.rows[1].error).toBeUndefined();
  });

  it("truncates long free-text fields to the shared schema limits", () => {
    const result = parseOutreachCsv(
      [
        "Name,Email,Institution,Role,Source,Notes",
        [
          "Jane",
          "jane@university.edu",
          "i".repeat(MAX_OUTREACH_INSTITUTION + 10),
          "r".repeat(MAX_OUTREACH_ROLE + 10),
          "s".repeat(MAX_OUTREACH_SOURCE + 10),
          "n".repeat(MAX_OUTREACH_NOTES + 10),
        ].join(","),
      ].join("\n"),
    );

    expect(result.rows[0].error).toBeUndefined();
    expect(result.rows[0].institution).toHaveLength(MAX_OUTREACH_INSTITUTION);
    expect(result.rows[0].role).toHaveLength(MAX_OUTREACH_ROLE);
    expect(result.rows[0].source).toHaveLength(MAX_OUTREACH_SOURCE);
    expect(result.rows[0].notes).toHaveLength(MAX_OUTREACH_NOTES);
  });

  it("leaves the name blank when the cell is empty", () => {
    const result = parseOutreachCsv("name,email\n,jane.doe@university.edu");

    expect(result.rows[0].name).toBe("");
    expect(result.rows[0].email).toBe("jane.doe@university.edu");
    expect(result.rows[0].error).toBeUndefined();
  });

  it("does not mistake an institution column for a name", () => {
    const result = parseOutreachCsv(
      ["Email,Institution", "jane.doe@university.edu,Delhi University"].join(
        "\n",
      ),
    );

    expect(result.rows[0].institution).toBe("Delhi University");
    expect(result.rows[0].name).toBe("");
  });

  it("ignores columns it does not recognize", () => {
    const result = parseOutreachCsv(
      [
        "S. No.,Name,Email,Phone,Country,Department",
        "1,Jane,jane@university.edu,9999999999,India,Physics",
      ].join("\n"),
    );

    expect(result.rows[0]).toMatchObject({
      name: "Jane",
      email: "jane@university.edu",
      institution: "",
      role: "",
      source: "",
      notes: "",
      error: undefined,
    });
  });

  it("reports a missing email column instead of importing garbage", () => {
    const result = parseOutreachCsv("Name,Phone\nJane,12345");

    expect(result.rows).toHaveLength(0);
    expect(result.error).toMatch(/no email column/i);
  });

  it("reports an empty file", () => {
    expect(parseOutreachCsv("   \n").error).toMatch(/empty/i);
    expect(outreachRowsFromMatrix([[""]]).error).toMatch(/empty/i);
  });

  it("keeps optional columns when the header names them", () => {
    const result = parseOutreachCsv(
      [
        "Name,Email,Institution,Role,Source,Notes",
        "Jane,jane@university.edu,Test University,Professor,conference,Met in person",
      ].join("\n"),
    );

    expect(result.rows[0]).toMatchObject({
      institution: "Test University",
      role: "Professor",
      source: "conference",
      notes: "Met in person",
    });
  });
});

describe("parseDelimited", () => {
  it("keeps delimiter characters inside quoted fields", () => {
    const rows = parseDelimited('Name,Email\n"Doe, Jane",jane@university.edu');

    expect(rows[1]).toEqual(["Doe, Jane", "jane@university.edu"]);
  });

  it("unescapes doubled quotes", () => {
    const rows = parseDelimited('Name,Email\n"Jane ""JJ"" Doe",jane@university.edu');

    expect(rows[1][0]).toBe('Jane "JJ" Doe');
  });

  it("detects tab-separated files", () => {
    expect(detectDelimiter("Name\tEmail\nJane\tjane@university.edu")).toBe("\t");
  });
});
