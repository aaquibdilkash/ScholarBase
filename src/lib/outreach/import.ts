import {
  MAX_OUTREACH_EMAIL,
  MAX_OUTREACH_INSTITUTION,
  MAX_OUTREACH_NAME,
  MAX_OUTREACH_NOTES,
  MAX_OUTREACH_ROLE,
  MAX_OUTREACH_SOURCE,
} from "@/lib/constants";
import {
  normalizeEmail,
  stripMailtoPrefix,
  validateEmailFormat,
} from "@/lib/email-normalizer";

/**
 * Pure CSV / spreadsheet mapping for the admin outreach importer.
 *
 * The admin list is fed by arbitrary exports — Google Sheets, Excel, a pasted
 * column from a mailing list — so this module is deliberately forgiving:
 *
 * - Delimiter detection (`,` `;` tab) and quote-aware parsing, so a name like
 *   `Doe, Jane` no longer shifts every column.
 * - A header row is required. It may sit below a title row, and a column named
 *   `Emails` alongside a real `Email` column is resolved by which column
 *   actually holds addresses. A file without a header is rejected with an
 *   explanation instead of guessing a layout.
 * - Rows that cannot be imported keep an `error` and are simply skipped; one bad
 *   row never blocks the whole batch.
 *
 * No I/O and no `exceljs` here, so the mapping is cheap to test. The workbook
 * reader lives in `./import-file`.
 */

/** Header cells are scanned this far down, so a title row above is tolerated. */
const HEADER_SCAN_ROWS = 15;
/** Value-based column detection only needs a sample, not the whole sheet. */
const COLUMN_SAMPLE_ROWS = 60;

export type OutreachImportRow = {
  /** 1-based spreadsheet row / CSV record, for error messages. */
  row: number;
  name: string;
  email: string;
  institution: string;
  role: string;
  source: string;
  notes: string;
  /** Why the row will be skipped. Valid rows leave this undefined. */
  error?: string;
};

export type OutreachImportParse = {
  rows: OutreachImportRow[];
  /** Fatal problem (nothing usable in the file); `rows` is empty when set. */
  error?: string;
};

const EMAIL_HEADERS = [
  /^e-?mails?$/,
  /^e-?mail addresses?$/,
  /^mail$/,
  /^email ids?$/,
];

const NAME_HEADERS = [
  /^names?$/,
  /^full ?names?$/,
  /^contact( names?)?$/,
  /^scholar names?$/,
  /^professor names?$/,
  /^faculty names?$/,
];

const INSTITUTION_HEADERS = [
  /^institutions?$/,
  /^universit(y|ies)$/,
  /^affiliations?$/,
  /^organi[sz]ations?$/,
  /^colleges?$/,
];

const ROLE_HEADERS = [
  /^roles?$/,
  /^positions?$/,
  /^titles?$/,
  /^designations?$/,
];

const SOURCE_HEADERS = [/^sources?$/, /^referrals?$/, /^via$/];
const NOTES_HEADERS = [/^notes?$/, /^comments?$/, /^remarks?$/];

/**
 * Every header the importer understands. A file must have a header row with at
 * least one of these (in practice: Email); otherwise there is no reliable way to
 * tell a header from data, so the import is rejected.
 */
const ALL_HEADER_MATCHERS = [
  ...EMAIL_HEADERS,
  ...NAME_HEADERS,
  ...INSTITUTION_HEADERS,
  ...ROLE_HEADERS,
  ...SOURCE_HEADERS,
  ...NOTES_HEADERS,
];

const MISSING_HEADER_ERROR =
  "No header row found. Add a header row with at least an Email column (Name, Institution, Role, Source and Notes are optional).";

type ColumnMap = {
  email: number;
  name: number;
  institution: number;
  role: number;
  source: number;
  notes: number;
};

function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.:*]+$/, "")
    .trim();
}

function matchesHeader(value: string, matchers: RegExp[]): boolean {
  const header = normalizeHeader(value);
  return header !== "" && matchers.some((matcher) => matcher.test(header));
}

function cleanCell(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

/**
 * Pull one address out of a cell. Exports often contain `Jane <jane@x.edu>` or
 * several tokens in one cell; the first valid address wins.
 */
function extractEmail(rawCell: unknown): string {
  const value = stripMailtoPrefix(cleanCell(rawCell));
  if (!value) return "";

  if (validateEmailFormat(value)) return value;

  const angled = /<([^<>]+)>/.exec(value);
  if (angled) {
    const inside = angled[1].trim();
    if (validateEmailFormat(inside)) return inside;
  }

  const token = value
    .split(/[\s,;]+/)
    .find((part) => validateEmailFormat(part));

  return token ?? value;
}

function isNameLike(value: string): boolean {
  if (!value || value.includes("@") || value.length > MAX_OUTREACH_NAME) return false;
  if (!/[a-z]/i.test(value)) return false;
  // Index columns ("1", "2", "S. No.") are not names.
  return !/^[\d\s.\-/#]+$/.test(value);
}

function columnScore(
  matrix: string[][],
  column: number,
  startRow: number,
  predicate: (value: string) => boolean,
): number {
  const limit = Math.min(matrix.length, startRow + COLUMN_SAMPLE_ROWS);
  let score = 0;

  for (let index = startRow; index < limit; index += 1) {
    if (predicate(cleanCell(matrix[index]?.[column]))) score += 1;
  }

  return score;
}

function bestColumn(
  matrix: string[][],
  startRow: number,
  candidates: number[],
  predicate: (value: string) => boolean,
): number {
  let best = -1;
  let bestScore = 0;

  for (const column of candidates) {
    const score = columnScore(matrix, column, startRow, predicate);
    if (score > bestScore) {
      best = column;
      bestScore = score;
    }
  }

  return best;
}

function findHeaderRow(matrix: string[][]): number {
  const limit = Math.min(matrix.length, HEADER_SCAN_ROWS);

  for (let index = 0; index < limit; index += 1) {
    if (matrix[index].some((cell) => matchesHeader(cell, ALL_HEADER_MATCHERS))) {
      return index;
    }
  }

  return -1;
}

/** True when one of the first rows looks like a header row for this importer. */
export function hasOutreachHeaderRow(matrix: string[][]): boolean {
  return findHeaderRow(matrix.map((row) => row.map(cleanCell))) >= 0;
}

/** Resolve the column layout from the header row (which is mandatory). */
function resolveColumns(
  matrix: string[][],
  headerRow: number,
): { columns: ColumnMap; firstDataRow: number } | { error: string } {
  const header = matrix[headerRow] ?? [];
  const firstDataRow = headerRow + 1;

  const emailCandidates = header
    .map((cell, index) => (matchesHeader(cell, EMAIL_HEADERS) ? index : -1))
    .filter((index) => index >= 0);

  if (emailCandidates.length === 0) {
    return {
      error:
        "No email column found. Add an 'Email' column header (Email, E-mail, Email Address, or Mail).",
    };
  }

  // A sheet can carry both `Emails` (junk) and `Email`; the column whose values
  // actually parse as addresses wins over header order.
  const detectedEmailColumn = bestColumn(
    matrix,
    firstDataRow,
    emailCandidates,
    (value) => validateEmailFormat(normalizeEmail(value)),
  );

  const emailColumn = detectedEmailColumn >= 0
    ? detectedEmailColumn
    : emailCandidates[0];

  const headerIndex = (matchers: RegExp[]): number =>
    header.findIndex((cell) => matchesHeader(cell, matchers));

  return {
    columns: {
      email: emailColumn,
      name: headerIndex(NAME_HEADERS),
      institution: headerIndex(INSTITUTION_HEADERS),
      role: headerIndex(ROLE_HEADERS),
      source: headerIndex(SOURCE_HEADERS),
      notes: headerIndex(NOTES_HEADERS),
    },
    firstDataRow,
  };
}

/**
 * Map a decoded spreadsheet (CSV record array or XLSX cell matrix) to import
 * rows. Blank rows and repeated header rows are dropped; invalid rows are kept
 * with an `error` so the preview can explain what will be skipped.
 */
export function outreachRowsFromMatrix(input: unknown[][]): OutreachImportParse {
  const matrix = input.map((row) => row.map(cleanCell));

  if (matrix.every((row) => row.every((cell) => cell === ""))) {
    return { rows: [], error: "This file is empty." };
  }

  const headerRow = findHeaderRow(matrix);
  if (headerRow < 0) {
    return { rows: [], error: MISSING_HEADER_ERROR };
  }

  const resolved = resolveColumns(matrix, headerRow);
  if ("error" in resolved) return { rows: [], error: resolved.error };

  const { columns, firstDataRow } = resolved;
  const rows: OutreachImportRow[] = [];

  for (let index = firstDataRow; index < matrix.length; index += 1) {
    const cells = matrix[index];
    if (!cells || cells.every((cell) => cell === "")) continue;
    // Some exports repeat the header every page/section.
    if (matchesHeader(cells[columns.email] ?? "", EMAIL_HEADERS)) continue;

    const rawEmail = extractEmail(cells[columns.email]);
    const email = normalizeEmail(rawEmail);

    let error: string | undefined;
    if (!rawEmail) error = "Missing email";
    else if (!validateEmailFormat(email)) error = "Invalid email";
    // An over-length address is truncated into a different recipient, so flag
    // it instead of importing it.
    else if (email.length > MAX_OUTREACH_EMAIL) error = "Email too long";

    let name = columns.name >= 0 ? cleanCell(cells[columns.name]) : "";
    if (!isNameLike(name)) name = "";

    rows.push({
      row: index + 1,
      name: truncate(name, MAX_OUTREACH_NAME),
      email,
      institution: truncate(
        columns.institution >= 0 ? cleanCell(cells[columns.institution]) : "",
        MAX_OUTREACH_INSTITUTION,
      ),
      role: truncate(
        columns.role >= 0 ? cleanCell(cells[columns.role]) : "",
        MAX_OUTREACH_ROLE,
      ),
      source: truncate(
        columns.source >= 0 ? cleanCell(cells[columns.source]) : "",
        MAX_OUTREACH_SOURCE,
      ),
      notes: truncate(
        columns.notes >= 0 ? cleanCell(cells[columns.notes]) : "",
        MAX_OUTREACH_NOTES,
      ),
      error,
    });
  }

  if (rows.length === 0) {
    return {
      rows: [],
      error: "No contact rows found below the header row.",
    };
  }

  // One import per address: the first occurrence wins, later ones are flagged
  // so the admin sees exactly what was skipped instead of a silent shortfall.
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.error) {
      if (seen.has(row.email)) row.error = "Duplicate email";
      else seen.add(row.email);
    }
  }

  return { rows };
}

/** Delimiter used by the first records; Google Sheets and Excel both differ here. */
export function detectDelimiter(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .slice(0, 5);

  let best = ",";
  let bestCount = 0;

  for (const candidate of [",", ";", "\t"]) {
    const count = lines.reduce(
      (total, line) => total + line.split(candidate).length - 1,
      0,
    );
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }

  return best;
}

/**
 * RFC-4180-style decoder: quoted fields may contain the delimiter, newlines,
 * and doubled quotes. Row filtering happens later in `outreachRowsFromMatrix`.
 */
export function parseDelimited(text: string, delimiter?: string): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const separator = delimiter ?? detectDelimiter(source);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field.trim() === "") {
      inQuotes = true;
      field = "";
      continue;
    }

    if (char === separator) {
      row.push(field);
      field = "";
      continue;
    }

    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    if (char === "\r") continue;
    field += char;
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Blank records are kept so `row` numbers stay aligned with the file; the
  // mapper skips them.
  return rows;
}

/** Full CSV/TSV text import. */
export function parseOutreachCsv(text: string): OutreachImportParse {
  if (!text.trim()) return { rows: [], error: "This file is empty." };
  return outreachRowsFromMatrix(parseDelimited(text));
}
