import ExcelJS from "exceljs";
import {
  buildCodebook,
  buildRawData,
  type ExportResponse,
  type ExportSurvey,
} from "./export";

/**
 * XLSX rendering for the research export.
 *
 * Split out from `./export` on purpose: that module stays dependency-free pure
 * data-shaping (Codebook rows, raw-data matrix, CSV text), which is what makes
 * it cheap to test. This module owns the one heavyweight dependency and the
 * workbook layout, so the pure logic never pulls exceljs into the graph.
 *
 * exceljs replaced SheetJS (`xlsx`) in Sept 2026. The reasons were not
 * cosmetic: `xlsx` is frozen at 0.18.5 on npm — SheetJS publishes fixes only
 * to its own CDN — so `npm audit` flags two unfixable high advisories
 * (prototype pollution + ReDoS, both in the parse path). exceljs is a normally
 * published, normally auditable npm package.
 */

const CODEBOOK_SHEET = "Codebook";
const RAW_DATA_SHEET = "Raw Data";

/** Column widths mirroring the widths the previous SheetJS writer set via `!cols`. */
const CODEBOOK_COLUMNS = [16, 60, 18, 10, 50, 60];

function addRows(worksheet: ExcelJS.Worksheet, rows: string[][]): void {
  for (const row of rows) {
    worksheet.addRow(row);
  }
}

/**
 * Build the two-sheet workbook (Codebook + Raw Data) as an `ExcelJS.Workbook`.
 *
 * Returned rather than serialized so callers own the `writeBuffer()` await and
 * so tests can assert on sheet names and cell values without decoding a zip.
 */
export function buildWorkbook(
  survey: ExportSurvey,
  responses: ExportResponse[],
  includeIdentity: boolean,
  anonymize: boolean,
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ScholarBase";
  workbook.created = new Date();

  const codebook = workbook.addWorksheet(CODEBOOK_SHEET);
  CODEBOOK_COLUMNS.forEach((width, index) => {
    codebook.getColumn(index + 1).width = width;
  });
  addRows(codebook, buildCodebook(survey));

  const rawData = workbook.addWorksheet(RAW_DATA_SHEET);
  addRows(
    rawData,
    buildRawData(survey, responses, includeIdentity, anonymize),
  );

  return workbook;
}

/**
 * Serialize a workbook to XLSX bytes, as an `ArrayBuffer`.
 *
 * The cast below is not laziness, it is a workaround for exceljs's bundled
 * types: `node_modules/exceljs/index.d.ts` opens with
 * `declare interface Buffer extends ArrayBuffer { }` — a placeholder that has
 * no `length` and no indexing, so the `Buffer` exceljs's `writeBuffer()`
 * advertises is structurally nothing like a real Buffer. Returning it as-is
 * poisons every downstream signature.
 *
 * `ArrayBuffer` is returned because it is a first-class `BodyInit`, so the
 * route can hand it straight to `NextResponse` with no wrapping.
 *
 * exceljs also writes real shared strings, which resolves a long-standing wart
 * in the SheetJS path: writing without `bookSST` emitted `t="str"` cells with no
 * sharedStrings part, which Google Sheets and some Excel builds rendered as
 * EMPTY cells. No equivalent flag is needed here.
 */
export async function writeWorkbook(
  workbook: ExcelJS.Workbook,
): Promise<ArrayBuffer> {
  const source = (await workbook.xlsx.writeBuffer()) as unknown as Uint8Array;
  // Copy into a standalone ArrayBuffer rather than aliasing the Buffer's
  // backing store, which may be a shared pool.
  const bytes = new Uint8Array(source.byteLength);
  bytes.set(source);
  return bytes.buffer;
}

/** Inverse of {@link writeWorkbook}, for tests and any future re-read. */
export async function readWorkbook(data: ArrayBuffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  // Same placeholder-`Buffer` problem as above, this time on `load()`.
  await (
    workbook.xlsx.load as unknown as (bytes: Uint8Array) => Promise<unknown>
  )(new Uint8Array(data));
  return workbook;
}

/**
 * Why the CSV formula-escape is NOT applied to XLSX cells.
 *
 * CSV has no cell types: every field is re-parsed as text-then-formula by the
 * spreadsheet, so a leading `=` is a genuine injection vector and `./export`'s
 * `toCsv` prefixes it with `'`. XLSX carries explicit cell types, and exceljs
 * writes these values as string cells (`t="s"`, no `<f>` element), which Excel
 * and LibreOffice display literally.
 *
 * Copying the CSV prefix here would be actively wrong, not merely redundant:
 * unlike the CSV parser, XLSX does NOT strip a leading apostrophe, so every
 * such cell would render a stray `'` to the researcher.
 *
 * This is asserted in `test/surveys/export-xlsx.test.ts` — a regression that
 * made exceljs emit a formula would reintroduce the injection.
 */
export const XLSX_FORMULA_NOTE =
  "XLSX cells are typed strings; leading `=` is not evaluated. Do not port the CSV apostrophe prefix.";
