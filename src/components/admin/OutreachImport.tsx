"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/Toast";
import {
  importOutreachContacts,
  previewOutreachImport,
} from "@/app/actions/outreach";
import type { OutreachImportRow } from "@/lib/outreach/import";
import { FileSpreadsheet, Loader2, Plus, Upload, X } from "lucide-react";
import {
  OUTREACH_QUERY_KEY,
  addOutreachContactOptimistically,
  createOptimisticOutreachId,
  outreachQueryKey,
  type OutreachListData,
} from "@/utils/outreach-cache";

const ACCEPTED_EXTENSIONS = ".csv,.tsv,.txt,.xlsx,.xlsm";

export function OutreachImport({ onCreated }: { onCreated?: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<OutreachImportRow[]>([]);

  // Imported rows join the top of page 1; that is the cache the optimistic
  // insert patches and the page the panel moves to afterwards.
  const pageKey = outreachQueryKey(1);

  const reset = () => {
    setFile(null);
    setRows([]);
  };

  const close = () => {
    if (parsing || importing) return;
    setIsOpen(false);
    reset();
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
    setParsing(true);

    const formData = new FormData();
    formData.append("file", selectedFile);

    let result: Awaited<ReturnType<typeof previewOutreachImport>>;
    try {
      result = await previewOutreachImport(formData);
    } catch {
      setParsing(false);
      setFile(null);
      toast("Could not read that file. Please try again.", "error");
      return;
    }
    setParsing(false);

    if (!result.success) {
      toast(result.error, "error");
      setFile(null);
      return;
    }

    setRows(result.data.rows);
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
            className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
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

            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              Upload a <code className="text-slate-700 dark:text-slate-300">.csv</code>,{" "}
              <code className="text-slate-700 dark:text-slate-300">.tsv</code>, or{" "}
              <code className="text-slate-700 dark:text-slate-300">.xlsx</code> file
              with <strong>name</strong> and <strong>email</strong> columns. In
              Google Sheets use <em>File → Download → CSV or Excel</em>. Legacy{" "}
              <code className="text-slate-700 dark:text-slate-300">.xls</code> files
              must be re-saved as <code className="text-slate-700 dark:text-slate-300">.xlsx</code>.
            </p>

            <div className="space-y-4">
              <input
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                onChange={(event) => void handleFileSelect(event)}
                disabled={parsing || importing}
                className="block w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/20 dark:file:text-blue-300"
              />

              {file && (
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
              )}
            </div>

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
                          {row.name} &lt;{row.email || "no email"}&gt;
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
