import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { parseOutreachWorkbook } from "@/lib/outreach/import-file";

async function workbookBuffer(
  sheets: Array<{ name: string; rows: unknown[][] }>,
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();

  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);
    for (const row of sheet.rows) worksheet.addRow(row);
  }

  // exceljs's bundled `Buffer` type is a placeholder; see export-xlsx.ts.
  const written = (await workbook.xlsx.writeBuffer()) as unknown as Uint8Array;
  return new Uint8Array(written).buffer;
}

describe("parseOutreachWorkbook", () => {
  it("maps an xlsx sheet through the same header resolution as CSV", async () => {
    const buffer = await workbookBuffer([
      {
        name: "Emails",
        rows: [
          ["S. No.", "Name", "Email"],
          [1, "Trit Sharma", "sharmatrrd@gmail.com"],
          [2, "Harish Verma", "vsid0786@gmail.com"],
        ],
      },
    ]);

    const result = await parseOutreachWorkbook(buffer);

    expect(result.error).toBeUndefined();
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      row: 2,
      name: "Trit Sharma",
      email: "sharmatrrd@gmail.com",
    });
  });

  it("skips a blank leading sheet", async () => {
    const buffer = await workbookBuffer([
      { name: "Sheet1", rows: [] },
      {
        name: "Contacts",
        rows: [
          ["Name", "Email"],
          ["Jane", "jane@university.edu"],
        ],
      },
    ]);

    const result = await parseOutreachWorkbook(buffer);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].email).toBe("jane@university.edu");
  });

  it("reads hyperlink cells and dates without losing the value", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Contacts");
    sheet.addRow(["Name", "Email", "Source"]);
    sheet.addRow([
      "Jane",
      { text: "jane@university.edu", hyperlink: "mailto:jane@university.edu" },
      new Date("2026-02-03"),
    ]);
    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Uint8Array;

    const result = await parseOutreachWorkbook(
      new Uint8Array(buffer).buffer,
    );

    expect(result.rows[0]).toMatchObject({
      name: "Jane",
      email: "jane@university.edu",
      source: "2026-02-03",
    });
  });

  it("defaults to the first sheet that has a header row", async () => {
    const buffer = await workbookBuffer([
      {
        name: "Instructions",
        rows: [["How to use this file"], ["Keep the Email column intact"]],
      },
      {
        name: "Contacts",
        rows: [
          ["Name", "Email"],
          ["Jane", "jane@university.edu"],
        ],
      },
    ]);

    const result = await parseOutreachWorkbook(buffer);

    expect(result.error).toBeUndefined();
    expect(result.sheets).toEqual(["Instructions", "Contacts"]);
    expect(result.sheetName).toBe("Contacts");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].email).toBe("jane@university.edu");
  });

  it("reads the sheet the admin selects by name", async () => {
    const buffer = await workbookBuffer([
      {
        name: "October",
        rows: [
          ["Name", "Email"],
          ["Jane", "jane@university.edu"],
        ],
      },
      {
        name: "November",
        rows: [
          ["Name", "Email"],
          ["Bob", "bob@university.edu"],
        ],
      },
    ]);

    const result = await parseOutreachWorkbook(buffer, "November");

    expect(result.error).toBeUndefined();
    expect(result.sheetName).toBe("November");
    expect(result.rows[0].email).toBe("bob@university.edu");
  });

  it("lists the available sheets when the requested one is missing", async () => {
    const buffer = await workbookBuffer([
      {
        name: "Contacts",
        rows: [
          ["Name", "Email"],
          ["Jane", "jane@university.edu"],
        ],
      },
    ]);

    const result = await parseOutreachWorkbook(buffer, "Missing");

    expect(result.rows).toHaveLength(0);
    expect(result.sheets).toEqual(["Contacts"]);
    expect(result.error).toMatch(/sheet "missing" not found/i);
    expect(result.error).toContain("Contacts");
  });

  it("rejects a headerless sheet", async () => {
    const buffer = await workbookBuffer([
      {
        name: "Contacts",
        rows: [
          ["Jane", "jane@university.edu"],
          ["Bob", "bob@university.edu"],
        ],
      },
    ]);

    const result = await parseOutreachWorkbook(buffer);

    expect(result.rows).toHaveLength(0);
    expect(result.sheetName).toBe("Contacts");
    expect(result.error).toMatch(/no header row/i);
  });
});
