import { describe, expect, it } from "vitest";

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

  it("works without a header row", () => {
    const result = parseOutreachCsv(
      ["Jane Doe,jane@university.edu", "John Roe,john@university.edu"].join(
        "\n",
      ),
    );

    expect(result.error).toBeUndefined();
    expect(result.rows.map((row) => row.name)).toEqual([
      "Jane Doe",
      "John Roe",
    ]);
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

  it("derives a readable name when the cell is blank", () => {
    const result = parseOutreachCsv("Name,Email\n,jane.doe@university.edu");

    expect(result.rows[0].name).toBe("Jane Doe");
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
