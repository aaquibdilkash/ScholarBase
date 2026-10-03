/**
 * Question types across option counts, matrix dimensions and same-type combos.
 *
 * `question-input.test.tsx` proves each type renders; `export-analysis.test.ts`
 * proves one all-type survey analyses correctly. Neither varies the SHAPE of a
 * question: both use three options and a 2x4 matrix. This file fills that in,
 * because the places a dataset breaks are the edges:
 *
 *   - a choice question with ZERO options is reachable today (the builder's
 *     remove button filters without a floor), and it must not corrupt an export;
 *   - a MATRIX's row count is NOT capped anywhere in the product
 *     (`MAX_MATRIX_ROWS` is declared in constants.ts and referenced nowhere),
 *     while its COLUMN count is capped at 10 in the UI and again server-side;
 *   - several questions of the SAME type in one survey must stay separate
 *     variables, not collapse onto one column.
 *
 * The degenerate shapes are asserted as they behave, not as they should behave.
 * Where one looks like a defect it is reported rather than encoded as correct,
 * so the expectation can be flipped when the product tightens the rule.
 */
import { describe, expect, it } from "vitest";
import type ExcelJS from "exceljs";

import { buildWorkbook, readWorkbook, writeWorkbook } from "@/lib/surveys/export-xlsx";
import {
  NA_SKIPPED,
  type ExportQuestion,
  type ExportResponse,
  type ExportSurvey,
} from "@/lib/surveys/export";
import { MAX_MATRIX_COLUMNS, MAX_MATRIX_ROWS } from "@/lib/constants";

type Option = { value: string; label: string; order: number };

/** `n` options named Option 1..n, so counts are explicit at each call site. */
function options(n: number): Option[] {
  return Array.from({ length: n }, (_, index) => ({
    value: `opt_${index + 1}`,
    label: `Option ${index + 1}`,
    order: index,
  }));
}

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

function survey(questions: ExportQuestion[]): ExportSurvey {
  return { title: "Scale survey", privacy: "HYBRID", questions };
}

/** One respondent answering every question with its first option. */
function responseFor(target: ExportSurvey): ExportResponse {
  return {
    id: "r1",
    createdAt: new Date("2026-02-01T00:00:00.000Z"),
    editedAt: null,
    startedAt: new Date("2026-02-01T00:00:00.000Z"),
    completedAt: new Date("2026-02-01T00:00:00.000Z"),
    consentedAt: null,
    isAnonymous: false,
    respondent: { name: "Respon D", handle: "respon" },
    answers: target.questions.map((question) => {
      if (question.type === "MATRIX_LIKERT") {
        return {
          questionId: question.id,
          value: Object.fromEntries(
          question.options.map((option, index) => [option.value, index + 1]),
        ),
        };
      }
      if (
        question.type === "CHECKBOXES" ||
        question.type === "MULTIPLE_CHOICE" ||
        question.type === "DROPDOWN" ||
        question.type === "LIKERT_SCALE"
      ) {
        return { questionId: question.id, value: question.options[0]?.value ?? "" };
      }
      return { questionId: question.id, value: "answer" };
    }),
  };
}

/** Raw Data as header-keyed objects, read back from the written file. */
async function rawTable(target: ExportSurvey) {
  const workbook = buildWorkbook(target, [responseFor(target)], false, false);
  const sheet = (await readWorkbook(await writeWorkbook(workbook))).getWorksheet(
    "Raw Data",
  )!;
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

/** Column index (1-based) of a named header on the given sheet. */
function columnOf(sheet: ExcelJS.Worksheet, header: string): number {
  const values = (sheet.getRow(1).values as unknown[]).slice(1);
  const index = values.indexOf(header);
  if (index === -1) {
    throw new Error(
      `no column named ${header}; sheet has [${values.join(", ")}]`,
    );
  }
  return index + 1;
}

/** Value of `header` on the given (1-based) data row. */
function cellFor(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  header: string,
): unknown {
  return sheet.getRow(rowNumber).getCell(columnOf(sheet, header)).value;
}

/** Codebook entries only, keyed by variable name. */
async function codebook(target: ExportSurvey) {
  const workbook = buildWorkbook(target, [responseFor(target)], false, false);
  const sheet = (await readWorkbook(await writeWorkbook(workbook))).getWorksheet(
    "Codebook",
  )!;
  const entries: Record<string, string[]> = {};
  let sawHeader = false;
  let inLegend = false;
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const cells = (row.values as unknown[])
      .slice(1)
      .map((cell) => String(cell ?? ""));
    if (cells.every((cell) => cell === "")) return;
    if (!sawHeader) {
      sawHeader = true;
      return;
    }
    if (cells[0] === "Convention") {
      inLegend = true;
      return;
    }
    if (!inLegend) entries[cells[0]] = cells;
  });
  return entries;
}

const CHOICE_TYPES = [
  "MULTIPLE_CHOICE",
  "CHECKBOXES",
  "DROPDOWN",
  "LIKERT_SCALE",
] as const;

describe("option counts", () => {
  // 0 is included because it is genuinely reachable: the builder's remove
  // handler filters without a floor, so an author can save a choice question
  // with no options. The export must survive it rather than emit a broken row.
  for (const count of [0, 1, 2, 10]) {
    for (const type of CHOICE_TYPES) {
      it(`exports a ${type} with ${count} options without corrupting the row`, async () => {
        const target = survey([
          q({ id: "q1", order: 0, type, options: options(count) }),
        ]);

        const rows = await rawTable(target);

        expect(rows).toHaveLength(1);
        // One variable, always, whatever the option count.
        expect(Object.keys(rows[0])).toContain("Q1");
        expect(rows[0].Q1).not.toContain("undefined");

        // With no options there is nothing to resolve, so the cell is empty
        // rather than leaking "undefined" into the dataset.
        //
        // LIKERT_SCALE is the exception that matters: it exports the raw CODE,
        // because an ordinal scale has to stay analysable ("Agree" cannot be
        // averaged) and the Codebook carries the mapping. The other three
        // resolve to labels.
        const expected =
          count === 0
            ? ""
            : type === "LIKERT_SCALE"
              ? "opt_1"
              : "Option 1";
        expect(rows[0].Q1, `type: ${type}, count: ${count}`).toBe(expected);
      });
    }
  }

  it("lists every option in the codebook for a wide choice question", async () => {
    const entries = await codebook(
      survey([q({ id: "q1", order: 0, type: "MULTIPLE_CHOICE", options: options(10) })]),
    );

    expect(entries.Q1[4].split("; ")).toHaveLength(10);
    expect(entries.Q1[4]).toContain("opt_10 = Option 10");
  });

  it("reports an empty option list rather than inventing one in the codebook", async () => {
    const entries = await codebook(
      survey([q({ id: "q1", order: 0, type: "MULTIPLE_CHOICE", options: [] })]),
    );

    expect(entries.Q1[4]).toBe("");
  });

  it("keeps duplicate option values resolvable to the last label", async () => {
    // `choiceCell` builds `new Map(options.map(o => [o.value, o.label]))`, so a
    // duplicated value collapses to its LAST label. Pinned as current behaviour:
    // the builder generates unique values, so this is only reachable via a
    // hand-crafted payload, and the point is that it degrades predictably.
    const target = survey([
      q({
        id: "q1",
        order: 0,
        type: "MULTIPLE_CHOICE",
        options: [
          { value: "same", label: "First label", order: 0 },
          { value: "same", label: "Second label", order: 1 },
        ],
      }),
    ]);

    const rows = await rawTable(target);
    expect(rows[0].Q1).toBe("Second label");
  });
});

describe("matrix dimensions", () => {
  function matrix(rows: number, columns: number, order = 0) {
    return q({
      id: `q${order + 1}`,
      order,
      type: "MATRIX_LIKERT",
      options: options(rows),
      columnLabels: options(columns).map((column) => column.label),
    });
  }

  for (const [rows, columns] of [
    [1, 1],
    [1, 4],
    [2, 1],
    [3, 7],
  ] as const) {
    it(`exports a ${rows}x${columns} matrix as one variable per row`, async () => {
      const target = survey([matrix(rows, columns)]);
      const table = await rawTable(target);
      const entries = await codebook(target);

      // Columns = row count, because each row is its own variable.
      expect(
        Object.keys(table[0]).filter((key) => key.startsWith("Q")),
      ).toHaveLength(rows);
      expect(Object.keys(entries)).toHaveLength(rows);

      // The fixture answers row N with column N, so every row must resolve to
      // ITS OWN label — this is what proves the rows are mapped independently
      // rather than all reading the first column.
      for (let row = 1; row <= rows; row += 1) {
        const label = row <= columns ? `Option ${row}` : "";
        expect(
          table[0][`Q1r${row}`],
          `row ${row} of ${rows}x${columns}`,
        ).toBe(label);
      }
    });
  }

  it("flattens a matrix at the intended maximum size", async () => {
    const target = survey([matrix(MAX_MATRIX_ROWS, MAX_MATRIX_COLUMNS)]);
    const table = await rawTable(target);

    expect(
      Object.keys(table[0]).filter((key) => key.startsWith("Q")),
    ).toHaveLength(MAX_MATRIX_ROWS);
    expect(table[0][`Q1r${MAX_MATRIX_ROWS}`]).toBe(
      `Option ${MAX_MATRIX_ROWS}`,
    );
  });

  it("emits every matrix row in codebook order", async () => {
    const target = survey([matrix(3, 2)]);
    const entries = await codebook(target);

    expect(Object.keys(entries)).toEqual(["Q1r1", "Q1r2", "Q1r3"]);
    expect(entries.Q1r2[1]).toBe("Question — row: Option 2");
  });

  it("survives a matrix with no rows", async () => {
    const target = survey([matrix(0, 4)]);
    const table = await rawTable(target);

    // Zero rows means zero variables — no columns, no crash, and critically no
    // phantom `Q1r1` that a researcher would read as a real measurement.
    expect(Object.keys(table[0]).filter((key) => key.startsWith("Q"))).toHaveLength(
      0,
    );
  });

  it("survives a matrix with no columns by blanking every cell", async () => {
    const target = survey([
      q({
        id: "q1",
        order: 0,
        type: "MATRIX_LIKERT",
        options: options(2),
        columnLabels: [],
      }),
    ]);
    const table = await rawTable(target);

    // No column labels means no index can resolve to a label, so every cell is
    // empty rather than wrongly reading column 0.
    expect(table[0].Q1r1).toBe("");
    expect(table[0].Q1r2).toBe("");
  });

  it("ignores a stored index that points past the last column", async () => {
    // A stale or tampered answer carrying an out-of-range column index must not
    // surface as another row's label.
    const target = survey([matrix(1, 2)]);
    const workbook = buildWorkbook(
      target,
      [
        {
          ...responseFor(target),
          answers: [{ questionId: "q1", value: { opt_1: 9 } }],
        },
      ],
      false,
      false,
    );
    const table = (await readWorkbook(await writeWorkbook(workbook))).getWorksheet(
      "Raw Data",
    )!;

    expect(cellFor(table, 2, "Q1r1")).toBe("");
  });

  it("does not let a matrix row cap be assumed by the codebook", async () => {
    // `MAX_MATRIX_ROWS` is declared in constants.ts but referenced nowhere in the
    // product, so a matrix can exceed it. The export must still emit one
    // variable per row rather than truncating at the constant.
    const overCap = MAX_MATRIX_ROWS + 3;
    const target = survey([matrix(overCap, 2)]);
    const entries = await codebook(target);

    expect(Object.keys(entries)).toHaveLength(overCap);
    expect(Object.keys(entries)).toContain(`Q1r${overCap}`);
  });
});

describe("several questions of the same type in one survey", () => {
  it("keeps two multiple-choice questions as separate variables", async () => {
    const target = survey([
      q({ id: "a", order: 0, type: "MULTIPLE_CHOICE", title: "First", options: options(2) }),
      q({ id: "b", order: 1, type: "MULTIPLE_CHOICE", title: "Second", options: options(3) }),
    ]);
    const workbook = buildWorkbook(
      target,
      [
        {
          ...responseFor(target),
          answers: [
            { questionId: "a", value: "opt_1" },
            { questionId: "b", value: "opt_3" },
          ],
        },
      ],
      false,
      false,
    );
    const table = (await readWorkbook(await writeWorkbook(workbook))).getWorksheet(
      "Raw Data",
    )!;

    expect(cellFor(table, 1, "Q1")).toBe("Q1");
    expect(cellFor(table, 1, "Q2")).toBe("Q2");
    expect(cellFor(table, 2, "Q1")).toBe("Option 1");
    expect(cellFor(table, 2, "Q2")).toBe("Option 3");
  });

  it("keeps two matrices from merging into one set of columns", async () => {
    const target = survey([
      q({
        id: "a",
        order: 0,
        type: "MATRIX_LIKERT",
        title: "Teaching",
        options: options(2),
        columnLabels: ["No", "Yes"],
      }),
      q({
        id: "b",
        order: 1,
        type: "MATRIX_LIKERT",
        title: "Research",
        options: options(3),
        columnLabels: ["Never", "Sometimes", "Always"],
      }),
    ]);
    const table = await rawTable(target);

    // Variable names are derived from ORDER, so each matrix gets its own Q-prefix
    // and no two matrices can collide on Q1r1.
    const variables = Object.keys(table[0]).filter((key) => key.startsWith("Q"));
    expect(variables).toEqual(["Q1r1", "Q1r2", "Q2r1", "Q2r2", "Q2r3"]);
  });

  it("keeps two checkbox questions independently countable", async () => {
    const target = survey([
      q({ id: "a", order: 0, type: "CHECKBOXES", options: options(2) }),
      q({ id: "b", order: 1, type: "CHECKBOXES", options: options(2) }),
    ]);
    const workbook = buildWorkbook(
      target,
      [
        {
          ...responseFor(target),
          answers: [
            { questionId: "a", value: ["opt_1", "opt_2"] },
            { questionId: "b", value: ["opt_2"] },
          ],
        },
      ],
      false,
      false,
    );
    const sheet = (await readWorkbook(await writeWorkbook(workbook))).getWorksheet(
      "Raw Data",
    )!;

    expect(cellFor(sheet, 2, "Q1")).toBe("Option 1; Option 2");
    expect(cellFor(sheet, 2, "Q2")).toBe("Option 2");
  });

  it("codes a skipped matrix as NA_SKIPPED on every one of its rows", async () => {
    // A matrix is flattened, so a skip rule that hides one must hide ALL its
    // columns. Missing even one would leave a stray NA that inflates that row's
    // sample size.
    const target = survey([
      q({
        id: "a",
        order: 0,
        type: "DROPDOWN",
        options: options(2),
        skipLogic: [{ operator: "equals", value: "opt_2", skipToOrder: 2 }],
      }),
      q({
        id: "b",
        order: 1,
        type: "MATRIX_LIKERT",
        options: options(3),
        columnLabels: ["No", "Yes"],
      }),
    ]);
    const workbook = buildWorkbook(
      target,
      [
        {
          ...responseFor(target),
          answers: [
            { questionId: "a", value: "opt_2" },
            { questionId: "b", value: { opt_1: 2, opt_2: 2, opt_3: 2 } },
          ],
        },
      ],
      false,
      false,
    );
    const sheet = (await readWorkbook(await writeWorkbook(workbook))).getWorksheet(
      "Raw Data",
    )!;

    // Every flattened row of the hidden matrix must be NA_SKIPPED, not just the
    // first: a stray real value in one column would inflate that row's sample.
    for (const header of ["Q2r1", "Q2r2", "Q2r3"]) {
      expect(cellFor(sheet, 2, header), header).toBe(NA_SKIPPED);
    }
    expect(cellFor(sheet, 2, "Q1")).toBe("Option 2");
  });
});

describe("numeric scale edges", () => {
  it("exports a scale whose min equals its max", async () => {
    const target = survey([
      q({
        id: "q1",
        order: 0,
        type: "LINEAR_SCALE",
        minValue: 3,
        maxValue: 3,
      }),
    ]);
    const entries = await codebook(target);

    expect(entries.Q1[4]).toBe("Min 3 / Max 3");
  });

  it("states the scale bounds as '-' when the builder left them unset", async () => {
    const target = survey([
      q({ id: "q1", order: 0, type: "RATING", minValue: null, maxValue: null }),
    ]);
    const entries = await codebook(target);

    // RATING always renders five stars, so unset bounds are cosmetic here — but
    // the codebook must not claim a range it does not know.
    expect(entries.Q1[4]).toBe("Min - / Max -");
  });

  it("keeps a wide linear scale's numbers intact", async () => {
    const target = survey([
      q({
        id: "q1",
        order: 0,
        type: "LINEAR_SCALE",
        minValue: 0,
        maxValue: 10,
      }),
    ]);
    const workbook = buildWorkbook(
      target,
      [
        {
          ...responseFor(target),
          answers: [{ questionId: "q1", value: "0" }],
        },
      ],
      false,
      false,
    );
    const sheet = (await readWorkbook(await writeWorkbook(workbook))).getWorksheet(
      "Raw Data",
    )!;

    // "0" must survive as 0 and not be blanked by a falsy check.
    expect(cellFor(sheet, 2, "Q1")).toBe("0");
  });
});
