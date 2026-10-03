/**
 * The export at realistic volume, with real statistics, validated by a reader
 * that did not write the file.
 *
 * The earlier suites prove correctness on four respondents. That is enough to
 * prove the LOGIC and not enough to prove the FEATURE, because three separate
 * things only misbehave at volume or outside exceljs:
 *
 *  1. STATISTICS. A dataset a researcher cannot compute on is not a dataset.
 *     Every summary here is checked against a CLOSED-FORM ground truth derived
 *     from how the fixture was constructed, so a wrong mean, a wrong standard
 *     deviation or a mis-indexed column fails loudly instead of producing a
 *     plausible-looking number.
 *  2. SCALE. Row/column counts are asserted exactly at 1,000 and 5,000
 *     responses, because a silently truncated export still opens fine in a
 *     spreadsheet and is only discovered after publication.
 *  3. FILE VALIDITY. Every other suite reads the workbook back with exceljs —
 *     the same library that wrote it, which cannot catch malformed OOXML. These
 *     tests unzip the bytes with an external tool and assert the real SpreadsheetML
 *     parts exist and agree on the row count.
 *
 * The numbers are built to be exactly checkable: a 1..5 scale cycling over the
 * responses has a population mean of 3 and a population variance of 2, so the
 * sample statistics below have a known answer rather than a snapshot of
 * whatever the code happened to produce.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type ExcelJS from "exceljs";

import { buildWorkbook, readWorkbook, writeWorkbook } from "@/lib/surveys/export-xlsx";
import {
  NA_SKIPPED,
  type ExportQuestion,
  type ExportResponse,
  type ExportSurvey,
} from "@/lib/surveys/export";

const SCALE_VALUES = [1, 2, 3, 4, 5] as const;
/** Closed-form ground truth for a uniform cycle over 1..5. */
const EXPECTED_MEAN = 3;
const EXPECTED_POPULATION_VARIANCE = 2;

function q(
  over: Partial<ExportQuestion> & { id: string; order: number },
): ExportQuestion {
  return {
    type: "SHORT_TEXT",
    title: "Question",
    required: false,
    minValue: null,
    maxValue: null,
    archivedAt: null,
    shuffleOptions: false,
    skipLogic: null,
    columnLabels: null,
    options: [],
    ...over,
  };
}

/**
 * A survey using several types at once, so scale is exercised across variable
 * kinds rather than on one narrow column.
 */
function scaleSurvey(): ExportSurvey {
  return {
    title: "Platform evaluation 2026",
    privacy: "HYBRID",
    questions: [
      q({ id: "q_role", order: 0, type: "DROPDOWN", title: "Role", options: [
        { value: "pi", label: "Investigator", order: 0 },
        { value: "postdoc", label: "Postdoc", order: 1 },
        { value: "grad", label: "Graduate student", order: 2 },
      ] }),
      q({ id: "q_sat", order: 1, type: "RATING", title: "Satisfaction", minValue: 1, maxValue: 5 }),
      q({ id: "q_recommend", order: 2, type: "LINEAR_SCALE", title: "Recommend", minValue: 1, maxValue: 5 }),
      q({ id: "q_tools", order: 3, type: "CHECKBOXES", title: "Tools", options: [
        { value: "python", label: "Python", order: 0 },
        { value: "r", label: "R", order: 1 },
      ] }),
      q({ id: "q_matrix", order: 4, type: "MATRIX_LIKERT", title: "Aspects",
        options: [
          { value: "speed", label: "Speed", order: 0 },
          { value: "support", label: "Support", order: 1 },
        ],
        // Five labels, matching the 1..5 scale. An out-of-range column index
        // resolves to a blank cell, which would silently drop a fifth of the
        // matrix data behind a plausible-looking chart.
        columnLabels: ["Poor", "Fair", "Good", "Excellent", "Outstanding"] }),
    ],
  };
}

/**
 * A separate survey for the skip-volume test.
 *
 * Skip logic is kept out of {@link scaleSurvey} on purpose: a rule hides the
 * questions between its trigger and its destination, so wiring one in here would
 * blank the columns the statistics below depend on. Mixing them would mean a
 * change to either silently altered the other's ground truth.
 */
function skipSurvey(): ExportSurvey {
  const base = [
    q({ id: "q_score", order: 0, type: "LINEAR_SCALE", title: "Score", minValue: 1, maxValue: 5 }),
    q({ id: "q_a", order: 1, type: "SHORT_TEXT", title: "A" }),
    q({ id: "q_b", order: 2, type: "SHORT_TEXT", title: "B" }),
    q({ id: "q_c", order: 3, type: "SHORT_TEXT", title: "C" }),
  ];
  // A 1..5 scale whose value 1 triggers the skip, hiding orders 1..3.
  base[0].skipLogic = [{ operator: "equals", value: "1", skipToOrder: 4 }];
  return { title: "Follow-up survey", privacy: "HYBRID", questions: base };
}

/** Responses for {@link skipSurvey}: every fifth respondent scores 1. */
function skipResponses(n: number): ExportResponse[] {
  return Array.from({ length: n }, (_, i) => {
    const score = SCALE_VALUES[i % SCALE_VALUES.length];
    const at = new Date(Date.UTC(2026, 0, 1));
    return {
      id: `resp_${i}`,
      createdAt: at,
      editedAt: null,
      startedAt: at,
      completedAt: at,
      consentedAt: null,
      isAnonymous: false,
      respondent: { name: "Scholar", handle: `h${i}` },
      answers: [
        { questionId: "q_score", value: String(score) },
        { questionId: "q_a", value: "A" },
        { questionId: "q_b", value: "B" },
        { questionId: "q_c", value: "C" },
      ],
    };
  });
}

/**
 * `n` responses whose scale answers cycle 1..5, giving a mean of exactly 3 and
 * a population variance of exactly 2 for any `n` divisible by 5.
 */
function scaleResponses(survey: ExportSurvey, n: number): ExportResponse[] {
  const respondents = Array.from({ length: 3 }, (_, i) => ({
    id: `u${i}`,
    name: `Scholar ${i}`,
    handle: `scholar${i}`,
  }));
  return Array.from({ length: n }, (_, i) => {
    const scale = SCALE_VALUES[i % SCALE_VALUES.length];
    const respondent = respondents[i % respondents.length];
    const at = new Date(Date.UTC(2026, 0, 1, 0, 0, i));
    return {
      id: `resp_${i}`,
      createdAt: at,
      editedAt: null,
      startedAt: at,
      completedAt: at,
      consentedAt: null,
      isAnonymous: i % 5 === 0,
      respondent: i % 5 === 0 ? null : respondent,
      answers: [
        { questionId: "q_role", value: ["pi", "postdoc", "grad"][i % 3] },
        { questionId: "q_sat", value: String(scale) },
        { questionId: "q_recommend", value: String(scale) },
        { questionId: "q_tools", value: i % 2 === 0 ? ["python"] : ["python", "r"] },
        { questionId: "q_matrix", value: { speed: scale, support: scale } },
      ],
    };
  });
}

/** Write the workbook to disk and hand back the ArrayBuffer. */
async function writeToDisk(
  survey: ExportSurvey,
  responses: ExportResponse[],
): Promise<{ bytes: ArrayBuffer; file: string; dir: string }> {
  const dir = mkdtempSync(join(tmpdir(), "sb-export-"));
  const file = join(dir, "export.xlsx");
  const bytes = await writeWorkbook(buildWorkbook(survey, responses, true, false));
  writeFileSync(file, Buffer.from(bytes));
  return { bytes, file, dir };
}

/** Raw Data as header-keyed records, read back through exceljs. */
function records(sheet: ExcelJS.Worksheet): Record<string, string>[] {
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row) => {
    rows.push(
      (row.values as unknown[])
        .slice(1)
        .map((cell) => (cell === null || cell === undefined ? "" : String(cell))),
    );
  });
  const [header, ...body] = rows;
  return body.map((cells) =>
    Object.fromEntries(header.map((key, index) => [key, cells[index] ?? ""])),
  );
}

async function exportedRecords(
  survey: ExportSurvey,
  responses: ExportResponse[],
) {
  const bytes = await writeWorkbook(
    buildWorkbook(survey, responses, true, false),
  );
  const workbook = await readWorkbook(bytes);
  return records(workbook.getWorksheet("Raw Data")!);
}

/** Descriptive statistics computed FROM THE EXPORTED CELLS, not the source. */
function stats(values: number[]) {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1);
  const sorted = [...values].sort((a, b) => a - b);
  const quantile = (q: number) => sorted[Math.floor(q * (n - 1))];
  return {
    n,
    mean,
    sampleVariance: variance,
    sampleSd: Math.sqrt(variance),
    median: quantile(0.5),
    q1: quantile(0.25),
    q3: quantile(0.75),
    min: sorted[0],
    max: sorted[n - 1],
  };
}

/** Pearson correlation between two equally-long numeric series. */
function pearson(xs: number[], ys: number[]): number {
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < xs.length; i += 1) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  return num / Math.sqrt(dx * dy);
}

/** Numeric cells of one column, dropping blanks and non-numeric codes. */
function numeric(rows: Record<string, string>[], column: string): number[] {
  return rows
    .map((row) => row[column])
    .filter((cell) => cell !== "" && !Number.isNaN(Number(cell)))
    .map(Number);
}

describe("export at volume", () => {
  // These carry a long timeout on purpose: they are the only tests that build a
  // five-thousand-row workbook, and a slow machine must not turn that into a
  // failure that looks like a product defect.
  const SLOW = 120_000;

  it("writes every row and column for 1,000 responses", async () => {
    const survey = scaleSurvey();
    const responses = scaleResponses(survey, 1000);
    const rows = await exportedRecords(survey, responses);

    // One record per response — a truncated export still opens fine, so the
    // count itself is the assertion that matters.
    expect(rows).toHaveLength(1000);
    // 4 metadata + consented_at + 2 identity = 7, then Q1..Q4 plus the matrix
    // flattened into two row-variables (Q5r1, Q5r2). The matrix is the FIFTH
    // question, so its rows are Q5r1/Q5r2.
    expect(Object.keys(rows[0])).toEqual([
      "response_id",
      "submitted_at",
      "updated_at",
      "duration_seconds",
      "consented_at",
      "is_anonymous",
      "respondent_handle",
      "Q1",
      "Q2",
      "Q3",
      "Q4",
      "Q5r1",
      "Q5r2",
    ]);
  }, SLOW);

  it("writes every row and column for 5,000 responses", async () => {
    const survey = scaleSurvey();
    const rows = await exportedRecords(survey, scaleResponses(survey, 5000));

    expect(rows).toHaveLength(5000);
    expect(new Set(rows.map((row) => row.response_id)).size).toBe(5000);
    expect(Object.keys(rows[0]).filter((key) => key.startsWith("Q"))).toHaveLength(6);
  }, SLOW);

  it("keeps response ids in submission order", async () => {
    const survey = scaleSurvey();
    const rows = await exportedRecords(survey, scaleResponses(survey, 500));

    expect(rows[0].response_id).toBe("resp_0");
    expect(rows[499].response_id).toBe("resp_499");
  }, SLOW);

  it("stays inside Excel's hard row and column limits", async () => {
    // XLSX tops out at 1,048,576 rows and 16,384 columns per sheet. A survey
    // that can exceed either would produce a file Excel refuses to open.
    const survey = scaleSurvey();
    const rows = await exportedRecords(survey, scaleResponses(survey, 5000));

    expect(rows.length + 1).toBeLessThanOrEqual(1_048_576);
    expect(Object.keys(rows[0]).length).toBeLessThanOrEqual(16_384);
  }, SLOW);

  it("codes the skipped follow-ups as NA_SKIPPED at volume", async () => {
    const survey = skipSurvey();
    const rows = await exportedRecords(survey, skipResponses(1000));

    // The rule fires whenever the score is 1, which is every fifth response,
    // and hides ALL THREE downstream questions.
    expect(rows.filter((row) => row.Q2 === NA_SKIPPED)).toHaveLength(200);
    expect(rows.filter((row) => row.Q3 === NA_SKIPPED)).toHaveLength(200);
    expect(rows.filter((row) => row.Q4 === NA_SKIPPED)).toHaveLength(200);
    // Nobody's follow-up text survives as a real value FOR THE SKIPPED
    // RESPONDENTS: the two states are disjoint and together account for every
    // row, which is what makes "not applicable" and "answered" separable.
    expect(rows.filter((row) => row.Q2 === "A")).toHaveLength(800);
    const accounted = rows.filter(
      (row) => row.Q2 === NA_SKIPPED || row.Q2 === "A",
    );
    expect(accounted).toHaveLength(1000);
    // And the trigger itself is never coded as skipped.
    expect(rows.filter((row) => row.Q1 === NA_SKIPPED)).toHaveLength(0);
  }, SLOW);
});

describe("statistics computed on the downloaded data are correct", () => {
  const SLOW = 120_000;

  it("reproduces the closed-form mean and standard deviation at n=1,000", async () => {
    const survey = scaleSurvey();
    const rows = await exportedRecords(survey, scaleResponses(survey, 1000));
    const values = numeric(rows, "Q3");

    const observed = stats(values);
    expect(observed.n).toBe(1000);
    expect(observed.mean).toBeCloseTo(EXPECTED_MEAN, 10);
    expect(observed.mean).toBe(3);

    // Sample variance is the population variance scaled by n/(n-1).
    const expectedSampleVariance =
      (EXPECTED_POPULATION_VARIANCE * 1000) / 999;
    expect(observed.sampleVariance).toBeCloseTo(expectedSampleVariance, 6);
    expect(observed.sampleSd).toBeCloseTo(Math.sqrt(expectedSampleVariance), 6);
    // The finite-sample sample SD is slightly ABOVE sqrt(2): for n=1000 the
    // unbiased variance scales by n/(n-1). Precision 2 keeps the loose
    // "about sqrt(2)" sanity check without pretending it is exact.
    expect(observed.sampleSd).toBeCloseTo(Math.sqrt(2), 2);
  }, SLOW);

  it("reports a confidence interval that contains the true mean", async () => {
    const survey = scaleSurvey();
    const rows = await exportedRecords(survey, scaleResponses(survey, 1000));
    const { n, mean, sampleSd } = stats(numeric(rows, "Q3"));

    const margin = 1.96 * (sampleSd / Math.sqrt(n));
    const lower = mean - margin;
    const upper = mean + margin;

    // The point of a CI: 3 is the real population mean of this fixture, so the
    // interval a researcher would report must bracket it.
    expect(lower).toBeLessThanOrEqual(EXPECTED_MEAN);
    expect(upper).toBeGreaterThanOrEqual(EXPECTED_MEAN);
    // And it must be narrow enough to be informative, not a vacuous -inf..inf.
    expect(upper - lower).toBeLessThan(0.5);
  }, SLOW);

  it("reports the right median and quartiles for a uniform scale", async () => {
    const survey = scaleSurvey();
    const rows = await exportedRecords(survey, scaleResponses(survey, 1000));
    const observed = stats(numeric(rows, "Q3"));

    expect(observed.median).toBe(3);
    expect(observed.q1).toBe(2);
    expect(observed.q3).toBe(4);
    expect(observed.min).toBe(1);
    expect(observed.max).toBe(5);
  }, SLOW);

  it("gives a perfect correlation for two identically-scored questions", async () => {
    // Q2 (rating) and Q3 (recommend) are filled from the same cycle in the
    // fixture, so r must be exactly 1. Anything less means a column got shifted
    // relative to its row — the classic mis-alignment in a hand-built export.
    const survey = scaleSurvey();
    const rows = await exportedRecords(survey, scaleResponses(survey, 1000));

    const r = pearson(numeric(rows, "Q2"), numeric(rows, "Q3"));
    expect(r).toBeCloseTo(1, 10);
  }, SLOW);

  it("keeps a categorical column countable, not averaged", async () => {
    const survey = scaleSurvey();
    const rows = await exportedRecords(survey, scaleResponses(survey, 1000));

    const counts = new Map<string, number>();
    for (const row of rows) {
      counts.set(row.Q1, (counts.get(row.Q1) ?? 0) + 1);
    }
    // The fixture cycles three roles, so each gets an exact third.
    expect(Object.fromEntries(counts)).toEqual({
      Investigator: 334,
      Postdoc: 333,
      "Graduate student": 333,
    });
  }, SLOW);

  it("aggregates a multi-select column across the whole dataset", async () => {
    const survey = scaleSurvey();
    const rows = await exportedRecords(survey, scaleResponses(survey, 1000));

    const counts = new Map<string, number>();
    for (const row of rows) {
      for (const label of row.Q4.split(";").map((p) => p.trim()).filter(Boolean)) {
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    }
    expect(Object.fromEntries(counts)).toEqual({ Python: 1000, R: 500 });
  }, SLOW);

  it("produces a per-row distribution for a flattened matrix at volume", async () => {
    const survey = scaleSurvey();
    const rows = await exportedRecords(survey, scaleResponses(survey, 1000));

    const counts = new Map<string, number>();
    for (const row of rows) {
      counts.set(row.Q5r1, (counts.get(row.Q5r1) ?? 0) + 1);
    }
    // Labels, not indices — and exactly 200 of each for a 1..5 cycle across five
    // columns. The fifth label exists precisely so a top-of-scale answer is not
    // silently dropped as out-of-range.
    expect(Object.fromEntries(counts)).toEqual({
      Poor: 200,
      Fair: 200,
      Good: 200,
      Excellent: 200,
      Outstanding: 200,
    });
  }, SLOW);
});

describe("the downloaded file is valid SpreadsheetML, not just exceljs-readable", () => {
  // Every other suite round-trips through exceljs, which is the WRITER. If it
  // emitted something subtly malformed, reading it back would still succeed
  // while Excel refused to open it. These tests unzip the bytes with an
  // external tool and assert the real OOXML parts.

  it("produces a zip whose OOXML parts are all present", async () => {
    const survey = scaleSurvey();
    const { file, dir } = await writeToDisk(survey, scaleResponses(survey, 500));
    try {
      const listing = execFileSync("zipinfo", ["-1", file], { encoding: "utf8" });
      for (const part of [
        "[Content_Types].xml",
        "_rels/.rels",
        "xl/workbook.xml",
        "xl/_rels/workbook.xml.rels",
      ]) {
        expect(listing, `missing ${part}`).toContain(part);
      }
      // Two worksheets: the Codebook and the Raw Data.
      expect(listing.match(/xl\/worksheets\/sheet\d+\.xml/g)).toHaveLength(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);

  it("declares both sheets in workbook.xml with real row counts", async () => {
    const survey = scaleSurvey();
    const { file, dir } = await writeToDisk(survey, scaleResponses(survey, 500));
    try {
      const workbookXml = execFileSync("unzip", ["-p", file, "xl/workbook.xml"], {
        encoding: "utf8",
      });
      expect(workbookXml).toContain('name="Codebook"');
      expect(workbookXml).toContain('name="Raw Data"');

      // The data sheet must declare 501 <row> elements for 500 responses.
      const rawXml = execFileSync(
        "unzip",
        ["-p", file, "xl/worksheets/sheet2.xml"],
        { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
      );
      const rows = rawXml.match(/<row /g) ?? [];
      expect(rows).toHaveLength(501);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);

  it("writes shared strings, so cells are not empty in other spreadsheet apps", async () => {
    // The old SheetJS writer emitted no sharedStrings part, and Google Sheets
    // rendered those cells as EMPTY. Asserting the part exists guards that.
    const survey = scaleSurvey();
    const { file, dir } = await writeToDisk(survey, scaleResponses(survey, 100));
    try {
      const listing = execFileSync("zipinfo", ["-1", file], { encoding: "utf8" });
      expect(listing).toContain("xl/sharedStrings.xml");

      const strings = execFileSync(
        "unzip",
        ["-p", file, "xl/sharedStrings.xml"],
        { encoding: "utf8" },
      );
      expect(strings).toContain("Investigator");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
