import "server-only";

import ExcelJS from "exceljs";

import {
  hasOutreachHeaderRow,
  outreachRowsFromMatrix,
  type OutreachImportParse,
} from "./import";

/**
 * XLSX reader for the outreach importer.
 *
 * Mirrors `src/lib/surveys/export-xlsx.ts`: the heavyweight dependency lives in
 * its own module so `./import` (mapping, validation, CSV) stays pure and cheap
 * to test. `exceljs` is already a dependency — SheetJS was removed for audit
 * reasons — and it is the only reader we use.
 *
 * A workbook may contain several tabs (an Instructions sheet in front of the
 * contact list is common), so the caller can name the sheet to read. Without a
 * name, the first tab that looks like a contact list wins.
 *
 * Only the modern `.xlsx` container is supported. Legacy binary `.xls` cannot
 * be read by exceljs; the action turns that into a "save as .xlsx or CSV" hint.
 */

export type OutreachWorkbookParse = OutreachImportParse & {
  /** Every worksheet name, in workbook order. */
  sheets: string[];
  /** Worksheet that was read; null when the workbook has no sheets. */
  sheetName: string | null;
};

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

/**
 * Dense matrix of one sheet. `eachRow` skips empty rows, so key by the real row
 * number and rebuild the gaps — that keeps the preview's row numbers aligned
 * with Excel.
 */
function sheetMatrix(sheet: ExcelJS.Worksheet): string[][] {
  const cellsByRow = new Map<number, string[]>();
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    cellsByRow.set(rowNumber, values.map(cellToText));
  });

  if (cellsByRow.size === 0) return [];

  const lastRow = Math.max(...cellsByRow.keys());
  return Array.from(
    { length: lastRow },
    (_, index) => cellsByRow.get(index + 1) ?? [],
  );
}

export async function parseOutreachWorkbook(
  buffer: ArrayBuffer,
  requestedSheet?: string,
): Promise<OutreachWorkbookParse> {
  const workbook = new ExcelJS.Workbook();
  // Same placeholder-`Buffer` typing problem documented in export-xlsx.ts.
  await (
    workbook.xlsx.load as unknown as (bytes: Uint8Array) => Promise<unknown>
  )(new Uint8Array(buffer));

  const sheets = workbook.worksheets.map((sheet) => sheet.name);

  if (workbook.worksheets.length === 0) {
    return {
      rows: [],
      sheets,
      sheetName: null,
      error: "This workbook has no sheets.",
    };
  }

  // Each tab is converted at most once, even though selection may inspect
  // several tabs before settling on one.
  const matrixCache = new Map<string, string[][]>();
  const matrixFor = (sheet: ExcelJS.Worksheet): string[][] => {
    const cached = matrixCache.get(sheet.name);
    if (cached) return cached;

    const built = sheetMatrix(sheet);
    matrixCache.set(sheet.name, built);
    return built;
  };

  const requested = requestedSheet?.trim();
  let sheet: ExcelJS.Worksheet | undefined;

  if (requested) {
    sheet = workbook.worksheets.find(
      (candidate) => candidate.name === requested,
    );

    if (!sheet) {
      return {
        rows: [],
        sheets,
        sheetName: null,
        error: `Sheet "${requested}" not found. This workbook has: ${sheets.join(", ")}.`,
      };
    }
  }

  // Default: the first tab that actually looks like a contact list, so a
  // workbook with an Instructions tab in front still imports cleanly.
  if (!sheet) {
    sheet = workbook.worksheets.find((candidate) =>
      hasOutreachHeaderRow(matrixFor(candidate)),
    );
  }

  // Otherwise the first tab with content (spreadsheets often lead with a blank
  // tab), and finally the first tab at all.
  sheet ??=
    workbook.worksheets.find((candidate) => candidate.actualRowCount > 0) ??
    workbook.worksheets[0];

  if (!sheet) {
    return {
      rows: [],
      sheets,
      sheetName: null,
      error: "This workbook has no sheets.",
    };
  }

  const matrix = matrixFor(sheet);

  if (matrix.length === 0) {
    return {
      rows: [],
      sheets,
      sheetName: sheet.name,
      error: `The sheet "${sheet.name}" is empty.`,
    };
  }

  return { ...outreachRowsFromMatrix(matrix), sheets, sheetName: sheet.name };
}
