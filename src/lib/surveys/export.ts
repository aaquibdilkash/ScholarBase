import type { SkipRule } from "@/types/survey";

/**
 * Research-grade export builder: produces a Codebook (data dictionary) and a
 * flat Raw Data matrix from a fully-loaded survey. Pure functions — no DB
 * or React imports — so the same logic powers XLSX and CSV outputs.
 */

export const NA_SKIPPED = "NA_SKIPPED";

export interface ExportQuestion {
  id: string;
  type: string;
  title: string;
  required: boolean;
  order: number;
  minValue: number | null;
  maxValue: number | null;
  archivedAt: Date | null;
  shuffleOptions: boolean;
  skipLogic: unknown;
  columnLabels: unknown;
  options: Array<{ value: string; label: string; order: number }>;
}

export interface ExportResponse {
  id: string;
  createdAt: Date;
  startedAt: Date;
  completedAt: Date | null;
  consentedAt: Date | null;
  isAnonymous: boolean;
  respondent: { name: string | null; handle: string | null } | null;
  answers: Array<{ questionId: string; value: unknown }>;
}

export interface ExportSurvey {
  title: string;
  privacy: string;
  questions: ExportQuestion[];
}

/** One codebook entry per exported variable (matrix rows are flattened). */
export function buildCodebook(survey: ExportSurvey): string[][] {
  const rows: string[][] = [
    ["Variable", "Question Text", "Type", "Required", "Options / Scale", "Notes"],
  ];
  for (const q of [...survey.questions].sort((a, b) => a.order - b.order)) {
    const notes: string[] = [];
    if (q.archivedAt) notes.push("Archived question (historical data)");
    if (q.shuffleOptions) {
      notes.push("Option order was randomized per respondent (seed on response row)");
    }
    const rules = Array.isArray(q.skipLogic) ? (q.skipLogic as SkipRule[]) : [];
    if (rules.length > 0) {
      notes.push(`Skip logic applied; hidden answers are coded ${NA_SKIPPED} (not applicable)`);
    }

    const isMatrix = q.type === "MATRIX_LIKERT";
    const matrixRows = isMatrix ? q.options : [];
    const columns = isMatrix
      ? Array.isArray(q.columnLabels)
        ? (q.columnLabels as string[])
        : []
      : [];

    const scale =
      q.type === "LINEAR_SCALE" || q.type === "RATING" || q.type === "LIKERT_SCALE"
        ? `Min ${q.minValue ?? "-"} / Max ${q.maxValue ?? "-"}`
        : "";

    if (isMatrix) {
      // One variable per matrix row; cell values are the column labels.
      matrixRows.forEach((row, r) => {
        rows.push([
          variableName(q, r),
          `${q.title} — row: ${row.label}`,
          q.type,
          q.required ? "Yes" : "No",
          columns.join(" | "),
          notes.join("; "),
        ]);
      });
    } else {
      const optionText = q.options
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((o) => `${o.value} = ${o.label}`)
        .join("; ");
      rows.push([
        variableName(q),
        q.title,
        q.type,
        q.required ? "Yes" : "No",
        [scale, optionText].filter(Boolean).join(" ; "),
        notes.join("; "),
      ]);
    }
  }
  rows.push(
    [],
    ["Convention", "Meaning"],
    [NA_SKIPPED, "Question hidden by skip logic — not applicable, not missing"],
    ["(empty cell)", "Question shown but not answered (optional question)"],
  );
  return rows;
}

/**
 * Build the flat raw-data matrix. Returns header + one row per response.
 * `includeIdentity` is false for anonymous surveys — identity columns are
 * stripped server-side so deanonymization can never happen at export time.
 */
export function buildRawData(
  survey: ExportSurvey,
  responses: ExportResponse[],
  includeIdentity: boolean,
): string[][] {
  const questions = [...survey.questions].sort((a, b) => a.order - b.order);

  type Variable = {
    key: string;
    header: string;
    render: (value: unknown) => string;
  };
  const variables: Variable[] = [];
  for (const q of questions) {
    if (q.type === "MATRIX_LIKERT") {
      const columns = Array.isArray(q.columnLabels)
        ? (q.columnLabels as string[])
        : [];
      q.options.forEach((row) => {
        variables.push({
          key: `${q.id}::${row.value}`,
          header: variableName(q, q.options.indexOf(row)),
          render: (value) => {
            if (!value || typeof value !== "object") return "";
            const idx = (value as Record<string, unknown>)[row.value];
            const n = Number(idx);
            return Number.isInteger(n) && n >= 1 && n <= columns.length
              ? columns[n - 1]
              : "";
          },
        });
      });
    } else if (
      q.type === "MULTIPLE_CHOICE" ||
      q.type === "CHECKBOXES" ||
      q.type === "DROPDOWN"
    ) {
      variables.push({
        key: q.id,
        header: variableName(q),
        render: (value) => choiceCell(q, value),
      });
    } else {
      // SHORT_TEXT, LONG_TEXT, RATING, LINEAR_SCALE, LIKERT_SCALE, DATE
      variables.push({
        key: q.id,
        header: variableName(q),
        render: (value) =>
          value === null || value === undefined ? "" : String(value),
      });
    }
  }

  const metaHeaders = ["response_id", "submitted_at", "duration_seconds"];
  if (survey.privacy !== "ANONYMOUS") metaHeaders.push("consented_at");
  if (includeIdentity) metaHeaders.push("is_anonymous", "respondent_handle");

  const header = [...metaHeaders, ...variables.map((v) => v.header)];
  const questionById = new Map(questions.map((q) => [q.id, q]));

  const rows = responses.map((response) => {
    const answerById = new Map(
      response.answers.map((a) => [a.questionId, a.value]),
    );
    // Recompute skip-logic visibility per response so hidden questions get
    // the NA_SKIPPED code instead of an ambiguous blank.
    const skipped = new Set<string>();
    for (const q of questions) {
      if (q.skipLogic == null) continue;
      const rules = Array.isArray(q.skipLogic) ? (q.skipLogic as SkipRule[]) : [];
      const values = toAnswerList(answerById.get(q.id));
      for (const rule of rules) {
        const matched =
          rule.operator === "equals"
            ? values.includes(rule.value)
            : rule.operator === "not_equals"
              ? !values.includes(rule.value)
              : values.some((v) => v.includes(rule.value));
        if (matched) {
          for (const other of questions) {
            if (other.order > q.order && other.order < rule.skipToOrder) {
              skipped.add(other.id);
            }
          }
        }
      }
    }

    const durationSeconds =
      response.completedAt && response.startedAt
        ? Math.max(
            0,
            Math.round(
              (response.completedAt.getTime() - response.startedAt.getTime()) / 1000,
            ),
          )
        : "";

    const meta: string[] = [
      response.id,
      response.createdAt.toISOString(),
      String(durationSeconds),
    ];
    if (survey.privacy !== "ANONYMOUS") {
      meta.push(response.consentedAt ? response.consentedAt.toISOString() : "");
    }
    if (includeIdentity) {
      meta.push(
        response.isAnonymous ? "true" : "false",
        response.isAnonymous ? "" : (response.respondent?.handle ?? ""),
      );
    }

    const cells = variables.map((v) => {
      const q = questionById.get(v.key.split("::")[0]);
      if (!q) return "";
      if (skipped.has(q.id)) return NA_SKIPPED;
      return v.render(answerById.get(q.id));
    });

    return [...meta, ...cells];
  });

  return [header, ...rows];
}

/** RFC 4180 CSV with UTF-8 BOM so Excel opens UTF-8 text correctly. */
export function toCsv(rows: string[][]): string {
  const escape = (cell: string) => {
    // Prevent spreadsheet applications from interpreting user-controlled text
    // as a formula when the CSV is opened.
    const safeCell = /^[=+\-@\t\r\n]/.test(cell) ? `'${cell}` : cell;
    return /[",\n\r]/.test(safeCell)
      ? `"${safeCell.replace(/"/g, '""')}"`
      : safeCell;
  };
  const body = rows.map((row) => row.map(escape).join(",")).join("\r\n");
  return `\uFEFF${body}\r\n`;
}


/** Resolve a stored answer value to display label(s) for choice questions. */
function toAnswerList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // plain string answer
    }
    return [value];
  }
  return [];
}

function choiceCell(q: ExportQuestion, value: unknown): string {
  const byValue = new Map(q.options.map((o) => [o.value, o.label]));
  return toAnswerList(value)
    .map((v) => byValue.get(v) ?? v)
    .join("; ");
}

/** Human-readable variable name: Q1, Q2, ... Q12r3 for matrix rows. */
export function variableName(question: ExportQuestion, rowIndex?: number): string {
  const base = `Q${question.order + 1}`;
  return rowIndex === undefined ? base : `${base}r${rowIndex + 1}`;
}
