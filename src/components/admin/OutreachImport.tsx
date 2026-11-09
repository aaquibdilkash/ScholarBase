"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/Toast";
import {
  importOutreachContacts,
  previewOutreachImport,
} from "@/app/actions/outreach";
import type { OutreachImportRow } from "@/lib/outreach/import";
import {
  MAX_OUTREACH_IMPORT_FILE_BYTES,
  MAX_OUTREACH_IMPORT_ROWS,
} from "@/lib/constants";
import { FileSpreadsheet, Loader2, Plus, Upload, X } from "lucide-react";
import {
  OUTREACH_QUERY_KEY,
  addOutreachContactOptimistically,
  createOptimisticOutreachId,
  outreachQueryKey,
  type OutreachListData,
} from "@/utils/outreach-cache";

const ACCEPTED_EXTENSIONS = ".csv,.tsv,.txt,.xlsx,.xlsm";

/**
 * Mirrors the header aliases and column order in `@/lib/outreach/import`, so
 * the admin knows exactly what the parser accepts before uploading a file.
 */
const IMPORT_COLUMNS = [
  {
    label: "Email",
    required: true,
    aliases: ["Email", "E-mail", "Email Address", "Mail"],
  },
  {
    label: "Name",
    required: false,
    aliases: ["Name", "Full Name", "Contact"],
  },
  {
    label: "Institution",
    required: false,
    aliases: ["Institution", "University", "Affiliation"],
  },
  { label: "Role", required: false, aliases: ["Role", "Position", "Title"] },
  { label: "Source", required: false, aliases: ["Source", "Referral"] },
  { label: "Notes", required: false, aliases: ["Notes", "Comments"] },
] as const;

export function OutreachImport({ onCreated }: { onCreated?: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<OutreachImportRow[]>([]);
  const [sheets, setSheets] = useState<string[]>([]);
  const [sheetName, setSheetName] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Imported rows join the top of page 1; that is the cache the optimistic
  // insert patches and the page the panel moves to afterwards.
  const pageKey = outreachQueryKey(1);

  const reset = () => {
    setFile(null);
    setRows([]);
    setSheets([]);
    setSheetName(null);
    setPreviewError(null);
  };

  const close = () => {
    if (parsing || importing) return;
    setIsOpen(false);
    reset();
  };

  const loadPreview = async (selectedFile: File, sheet?: string) => {
    setParsing(true);
    setPreviewError(null);

    const formData = new FormData();
    formData.append("file", selectedFile);
    if (sheet) formData.append("sheet", sheet);

    let result: Awaited<ReturnType<typeof previewOutreachImport>>;
    try {
      result = await previewOutreachImport(formData);
    } catch {
      setParsing(false);
      setPreviewError("Could not read that file. Please try again.");
      return;
    }
    setParsing(false);

    // Kept inline (not a toast) so a missing header, missing email column, or
    // empty tab stays on screen while the admin picks another sheet.
    if (!result.success) {
      setRows([]);
      setSheets(result.sheets ?? []);
      setSheetName(result.sheetName ?? null);
      setPreviewError(result.error);
      return;
    }

    setRows(result.data.rows);
    setSheets(result.data.sheets);
    setSheetName(result.data.sheetName);
    setPreviewError(null);
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile = event.target.files?.[0];
    // Allow re-selecting the same file after a failed attempt.
    event.target.value = "";
    if (!selectedFile) return;

    setFile(selectedFile);
    setRows([]);
    setSheets([]);
    setSheetName(null);
    await loadPreview(selectedFile);
  };

  const handleSheetChange = async (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const nextSheet = event.target.value;
    if (!file || !nextSheet || nextSheet === sheetName) return;

    await loadPreview(file, nextSheet);
  };

  const handleImport = async () => {
    const validRows = rows.filter((row) => !row.error);
    if (validRows.length === 0 || importing) return;

    setImporting(true);

    const drafts = validRows.map((row) => ({
      name: row.name,
      email: row.email,
      institution: row.institution,
      role: row.role,
      source: row.source,
      notes: row.notes,
    }));

    // Show every row immediately, then reconcile with the server result.
    const previous = queryClient.getQueryData<OutreachListData>(pageKey);
    queryClient.setQueryData<OutreachListData>(pageKey, (old) =>
      drafts.reduce<OutreachListData | undefined>(
        (data, draft) =>
          addOutreachContactOptimistically(
            data,
            draft,
            createOptimisticOutreachId(),
            { preserveStatus: true },
          ),
        old,
      ),
    );

    const rollback = () => {
      queryClient.setQueryData<OutreachListData>(pageKey, previous);
    };

    const result = await importOutreachContacts({ rows: drafts }).catch(
      () => null,
    );
    setImporting(false);

    if (!result || !result.success) {
      rollback();
      toast(
        result
          ? result.error
          : "Could not import contacts. Please try again.",
        "error",
      );
      return;
    }

    const { created, updated, skipped } = result.data;

    if (created + updated === 0) {
      rollback();
      toast(
        skipped > 0
          ? "Nothing imported — every address was already opted out."
          : "Nothing imported.",
        "error",
      );
      return;
    }

    toast(
      `Imported ${created} new contact${created === 1 ? "" : "s"}, updated ${updated}${
        skipped > 0 ? `, skipped ${skipped}` : ""
      }`,
      "success",
    );

    void queryClient.invalidateQueries({ queryKey: OUTREACH_QUERY_KEY });
    onCreated?.();
    setIsOpen(false);
    reset();
  };

  const invalidCount = rows.filter((row) => row.error).length;
  const validCount = rows.length - invalidCount;

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="sb-button-soft w-full gap-2"
      >
        <Upload className="h-4 w-4" />
        Import CSV / Excel
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-modal flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={close}
        >
          <div
            className="relative max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Import contacts
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                disabled={parsing || importing}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 space-y-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Upload a{" "}
                <code className="text-slate-700 dark:text-slate-300">.csv</code>,{" "}
                <code className="text-slate-700 dark:text-slate-300">.tsv</code>,{" "}
                <code className="text-slate-700 dark:text-slate-300">.xlsx</code>, or{" "}
                <code className="text-slate-700 dark:text-slate-300">.xlsm</code>{" "}
                file — up to{" "}
                {MAX_OUTREACH_IMPORT_ROWS.toLocaleString("en-US")} rows and{" "}
                {MAX_OUTREACH_IMPORT_FILE_BYTES / (1024 * 1024)} MB. In Google
                Sheets use <em>File → Download → CSV or Excel</em>; legacy{" "}
                <code className="text-slate-700 dark:text-slate-300">.xls</code>{" "}
                files must be re-saved as{" "}
                <code className="text-slate-700 dark:text-slate-300">.xlsx</code>.
                For a workbook with several tabs, choose the sheet after
                selecting the file.
              </p>

              <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                <p className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  Columns — a header row is required
                </p>
                <dl className="divide-y divide-slate-100 text-xs dark:divide-slate-800">
                  {IMPORT_COLUMNS.map((column) => (
                    <div
                      key={column.label}
                      className="flex items-baseline gap-3 px-3 py-1.5"
                    >
                      <dt className="w-24 shrink-0 font-semibold text-slate-700 dark:text-slate-300">
                        {column.label}
                        {column.required && (
                          <span className="ml-0.5 text-rose-600 dark:text-rose-400">
                            *
                          </span>
                        )}
                      </dt>
                      <dd className="min-w-0 text-slate-500 dark:text-slate-400">
                        {column.aliases.join(" · ")}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              <pre className="overflow-x-auto rounded-lg bg-slate-900 px-3 py-2 text-xs leading-relaxed text-slate-100 dark:bg-slate-950">
                {`S. No.,Email,Name,Institution,Role,Source,Notes
1,jane@university.edu,Jane Doe,Delhi University,Professor,Conference,Met at ICSSR`}
              </pre>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Only{" "}
                <strong className="font-semibold text-slate-700 dark:text-slate-300">
                  Email
                </strong>{" "}
                is required — a blank name is left blank and the email greets them
                as “Scholar”. Header names are case-insensitive, order does not
                matter, and extra columns (S. No., phone, country…) are ignored.
                A file without an Email header is rejected; duplicate and invalid
                rows are listed as skipped while the rest still import.
              </p>
            </div>

            <div className="space-y-4">
              {/* Native file inputs ignore the theme in Chrome, so the input is
                  hidden and its label is the visible, theme-aware picker. */}
              {/* `group` sits on the wrapper so the whole picker shares one
                  hover state. `group-hover:` is used instead of `hover:`
                  because Tailwind v4 wraps `hover:` in `@media (hover: hover)`,
                  which never matches on touch-first devices — that is why only
                  the icon used to react. */}
              <div className="group relative">
                <input
                  id="outreach-import-file"
                  type="file"
                  accept={ACCEPTED_EXTENSIONS}
                  onChange={(event) => void handleFileSelect(event)}
                  disabled={parsing || importing}
                  className="peer sr-only"
                />
                <label
                  htmlFor="outreach-import-file"
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition-colors group-hover:border-blue-500 group-hover:bg-blue-50 group-hover:text-blue-700 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-200 dark:group-hover:border-blue-400 dark:group-hover:bg-blue-500/15 dark:group-hover:text-blue-200 dark:peer-focus-visible:ring-offset-slate-900 ${
                    parsing || importing ? "pointer-events-none opacity-60" : ""
                  }`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 transition-colors group-hover:text-blue-600 group-hover:ring-blue-300 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700 dark:group-hover:text-blue-300 dark:group-hover:ring-blue-700">
                    <Upload className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="block">Choose a CSV or Excel file</span>
                    <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                      .csv · .tsv · .xlsx · .xlsm · up to 4 MB
                    </span>
                  </span>
                </label>
              </div>

              {file && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    <span className="truncate">{file.name}</span>
                    {parsing && (
                      <span className="ml-auto inline-flex items-center gap-1.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Reading…
                      </span>
                    )}
                  </div>

                  {sheets.length > 1 ? (
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="outreach-import-sheet"
                        className="shrink-0 text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        Sheet
                      </label>
                      <select
                        id="outreach-import-sheet"
                        value={sheetName ?? sheets[0]}
                        onChange={(event) => void handleSheetChange(event)}
                        disabled={parsing || importing}
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      >
                        {sheets.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : sheetName ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Sheet:{" "}
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {sheetName}
                      </span>
                    </p>
                  ) : null}
                </div>
              )}
            </div>

            {previewError && (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"
              >
                {previewError}
              </p>
            )}

            {rows.length > 0 && (
              <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    {validCount} contact{validCount === 1 ? "" : "s"} ready to
                    import
                  </p>
                  {invalidCount > 0 && (
                    <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                      {invalidCount} skipped
                    </span>
                  )}
                </div>
                <ul className="max-h-40 overflow-y-auto">
                  {rows.map((row) => (
                    <li
                      key={row.row}
                      className="border-b border-slate-100 px-3 py-2 last:border-b-0 dark:border-slate-800"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-semibold ${
                            row.error
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {row.error ? "✗" : "✓"}
                        </span>
                        <span className="truncate text-xs text-slate-700 dark:text-slate-300">
                          {row.name
                            ? `${row.name} <${row.email || "no email"}>`
                            : row.email || "no email"}
                        </span>
                        {row.error && (
                          <span className="ml-auto shrink-0 text-xs text-rose-600 dark:text-rose-400">
                            {row.error} · row {row.row}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={close}
                disabled={parsing || importing}
                className="sb-button-soft"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleImport()}
                disabled={importing || parsing || validCount === 0}
                className="sb-button-primary gap-2 disabled:opacity-60"
              >
                {importing ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importing…
                  </span>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    Import {validCount > 0 ? `${validCount} ` : ""}
                    {validCount === 1 ? "contact" : "contacts"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
