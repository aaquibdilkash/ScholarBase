import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";

import { buildWorkbook, readWorkbook, writeWorkbook } from "@/lib/surveys/export-xlsx";
import {
  NA_SKIPPED,
  type ExportQuestion,
  type ExportResponse,
  type ExportSurvey,
} from "@/lib/surveys/export";

/**
 * The XLSX half of the research export.
 *
 * This path had no tests before exceljs replaced SheetJS (`xlsx`) in Sept 2026
 * — it was the one export branch with zero coverage. The formula-injection
 * assertion below is the load-bearing one: it is what keeps P3-4 honest.
 */

function question(over: Partial<ExportQuestion> = {}): ExportQuestion {
  return {
    id: "q1",
    type: "SINGLE_CHOICE",
    title: "Which field?",
    required: true,
    order: 0,
    minValue: null,
    maxValue: null,
    archivedAt: null,
    shuffleOptions: false,
    skipLogic: null,
    columnLabels: null,
    options: [{ value: "CS", label: "Computer Science", order: 0 }],
    ...over,
  };
}

function response(over: Partial<ExportResponse> = {}): ExportResponse {
  return {
    id: "r1",
    createdAt: new Date("2026-01-02T03:04:05.000Z"),
    editedAt: null,
    startedAt: new Date("2026-01-02T03:00:00.000Z"),
    completedAt: new Date("2026-01-02T03:05:00.000Z"),
    consentedAt: new Date("2026-01-02T03:00:01.000Z"),
    isAnonymous: false,
    respondent: { name: "Ada Lovelace", handle: "ada" },
    answers: [{ questionId: "q1", value: "CS" }],
    ...over,
  };
}

function survey(questions: ExportQuestion[] = [question()]): ExportSurvey {
  return { title: "Field survey", privacy: "CONFIDENTIAL", questions };
}

/** Every populated cell in the workbook, flattened. */
function cellsOf(workbook: ExcelJS.Workbook): ExcelJS.Cell[] {
  const out: ExcelJS.Cell[] = [];
  workbook.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      row.eachCell({ includeEmpty: false }, (cell) => out.push(cell));
    });
  });
  return out;
}

/**
 * Round-trip a workbook through its bytes, the way a spreadsheet app would.
 * `readWorkbook` owns the exceljs placeholder-`Buffer` cast; the test just
 * uses it so the assertion reads as behaviour, not as type plumbing.
 */
async function reload(workbook: ExcelJS.Workbook): Promise<ExcelJS.Workbook> {
  return readWorkbook(await writeWorkbook(workbook));
}

describe("buildWorkbook", () => {
  it("carries the two sheets the research export promises", () => {
    const workbook = buildWorkbook(survey(), [response()], false, false);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Codebook",
      "Raw Data",
    ]);
  });

  it("opens the Codebook with the data-dictionary header", () => {
    const workbook = buildWorkbook(survey(), [response()], false, false);
    const codebook = workbook.getWorksheet("Codebook")!;
    expect(codebook.getRow(1).values).toEqual([
      undefined,
      "Variable",
      "Question Text",
      "Type",
      "Required",
      "Options / Scale",
      "Notes",
    ]);
  });

  it("preserves the Codebook column widths", () => {
    const workbook = buildWorkbook(survey(), [response()], false, false);
    const codebook = workbook.getWorksheet("Codebook")!;
    expect([1, 2, 3, 4, 5, 6].map((n) => codebook.getColumn(n).width)).toEqual([
      16, 60, 18, 10, 50, 60,
    ]);
  });

  it("writes one Raw Data row per response, under a header", () => {
    const workbook = buildWorkbook(
      survey(),
      [response({ id: "r1" }), response({ id: "r2" })],
      false,
      false,
    );
    // header + two responses
    expect(workbook.getWorksheet("Raw Data")!.actualRowCount).toBe(3);
  });

  it("strips respondent identity for an anonymized export", () => {
    const text = (workbook: ExcelJS.Workbook) =>
      cellsOf(workbook)
        .map((cell) => String(cell.value ?? ""))
        .join("|");
    expect(text(buildWorkbook(survey(), [response()], true, false))).toContain("ada");
    const shared = text(buildWorkbook(survey(), [response()], true, true));
    expect(shared).not.toContain("ada");
    expect(shared).not.toContain("Ada Lovelace");
  });

  it("codes skip-logic-hidden questions as NA_SKIPPED", () => {
    const questions = [
      question({ id: "q1", order: 0 }),
      question({ id: "q2", order: 1, title: "Follow-up" }),
    ];
    questions[0].skipLogic = [
      { skipToOrder: 2, operator: "equals", value: "CS" },
    ];
    const workbook = buildWorkbook(survey(questions), [response()], false, false);
    const text = cellsOf(workbook)
      .map((cell) => String(cell.value ?? ""))
      .join("|");
    expect(text).toContain(NA_SKIPPED);
  });
});

describe("writeWorkbook", () => {
  it("serializes to real XLSX bytes that reload", async () => {
    const workbook = buildWorkbook(survey(), [response()], false, false);
    const bytes = await writeWorkbook(workbook);

    expect(bytes).toBeInstanceOf(ArrayBuffer);
    expect(bytes.byteLength).toBeGreaterThan(0);
    // XLSX is a zip container: local file header "PK\x03\x04".
    expect(Array.from(new Uint8Array(bytes).slice(0, 4))).toEqual([
      0x50, 0x4b, 0x03, 0x04,
    ]);

    const reloaded = await reload(workbook);
    expect(reloaded.worksheets.map((s) => s.name)).toEqual([
      "Codebook",
      "Raw Data",
    ]);
  });
});


describe("XLSX formula injection (P3-4)", () => {
  // Survey content is user-controlled, so a question title or a free-text
  // answer can start with `=`. CSV must escape it — `toCsv` prefixes `'`.
  // XLSX deliberately does not: XLSX carries explicit cell types and exceljs
  // writes these as string cells, which spreadsheets display literally. That
  // claim is asserted here through a real write->read round-trip instead of
  // being assumed, because a regression that made exceljs emit a formula would
  // silently reintroduce the injection.
  const INJECTION = '=HYPERLINK("http://evil.example","click")';

  it("never emits a formula cell for formula-leading content", async () => {
    const questions = [
      question({ id: "q1", title: INJECTION }),
      question({
        id: "q2",
        type: "TEXT",
        order: 1,
        title: "Open text",
        options: [],
      }),
    ];
    const workbook = buildWorkbook(
      survey(questions),
      [response({ answers: [{ questionId: "q2", value: INJECTION }] })],
      false,
      false,
    );

    const reloaded = await reload(workbook);
    const formulaCells = cellsOf(reloaded).filter((cell) => cell.formula != null);
    expect(
      formulaCells.map((cell) => cell.formula),
      "a formula cell here means user text would be evaluated on open",
    ).toEqual([]);

    // Preserved verbatim — not stripped, not mangled, no stray apostrophe.
    const values = cellsOf(reloaded).map((cell) => String(cell.value ?? ""));
    expect(values).toContain(INJECTION);
    expect(values.join("|")).not.toContain(`'${INJECTION}`);
  });

  it("keeps `+`, `-` and `@` prefixed text as literal strings", async () => {
    const workbook = buildWorkbook(
      survey([question({ title: "+1-1" }), question({ id: "q2", title: "@cmd", order: 1 })]),
      [],
      false,
      false,
    );
    const reloaded = await reload(workbook);
    expect(cellsOf(reloaded).filter((cell) => cell.formula != null)).toEqual([]);
  });
});

