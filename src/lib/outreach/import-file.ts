import "server-only";

import ExcelJS from "exceljs";

import { outreachRowsFromMatrix, type OutreachImportParse } from "./import";

/**
 * XLSX reader for the outreach importer.
 *
 * Mirrors `src/lib/surveys/export-xlsx.ts`: the heavyweight dependency lives in
 * its own module so `./import` (mapping, validation, CSV) stays pure and cheap
 * to test. `exceljs` is already a dependency — SheetJS was removed for audit
 * reasons — and it is the only reader we use.
 *
 * Only the modern `.xlsx` container is supported. Legacy binary `.xls` cannot
 * be read by exceljs; the action turns that into a "save as .xlsx or CSV" hint.
 */

function cellToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);

  if (typeof value === "object") {
    const cell = value as {
      richText?: Array<{ text?: string }>;
      text?: string;
      result?: unknown;
    };

    // Rich text, hyperlink (`{ text, hyperlink }`), and formula cells all keep
    // the visible string in one of these fields.
    if (Array.isArray(cell.richText)) {
      return cell.richText.map((part) => part.text ?? "").join("");
    }
    if (typeof cell.text === "string") return cell.text;
    if (cell.result !== undefined) return cellToText(cell.result);
  }

  return "";
}

export async function parseOutreachWorkbook(
  buffer: ArrayBuffer,
): Promise<OutreachImportParse> {
  const workbook = new ExcelJS.Workbook();
  // Same placeholder-`Buffer` typing problem documented in export-xlsx.ts.
  await (
    workbook.xlsx.load as unknown as (bytes: Uint8Array) => Promise<unknown>
  )(new Uint8Array(buffer));

  // First sheet that has content; spreadsheets often lead with a blank tab.
  const sheet =
    workbook.worksheets.find((candidate) => candidate.actualRowCount > 0) ??
    workbook.worksheets[0];

  if (!sheet) {
    return { rows: [], error: "This workbook has no sheets." };
  }

  // `eachRow` skips empty rows, so key by the real row number and rebuild a
  // dense matrix — that keeps the preview's row numbers aligned with Excel.
  const cellsByRow = new Map<number, string[]>();
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    cellsByRow.set(rowNumber, values.map(cellToText));
  });

  if (cellsByRow.size === 0) {
    return { rows: [], error: `The sheet "${sheet.name}" is empty.` };
  }

  const lastRow = Math.max(...cellsByRow.keys());
  const matrix = Array.from(
    { length: lastRow },
    (_, index) => cellsByRow.get(index + 1) ?? [],
  );

  return outreachRowsFromMatrix(matrix);
}
