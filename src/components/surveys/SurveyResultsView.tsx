"use client";

import { useState } from "react";
import { ChevronDown, Download, Loader2 } from "lucide-react";
import type { QuestionResult, SurveyResults } from "@/types/survey";

function mapValueToLabel(q: QuestionResult, value: unknown): string {
  // If Prisma already returned an array, handle it directly
  if (Array.isArray(value)) {
    return value
      .map((v: string) => {
        const opt = q.options.find((o) => o.value === v);
        return opt?.label || v;
      })
      .join(", ");
  }

  // If it's still a string, try parsing it just in case
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((v: string) => {
            const opt = q.options.find((o) => o.value === v);
            return opt?.label || v;
          })
          .join(", ");
      }
    } catch {}
  }

  // Fallback for single choice / dropdown / raw string
  const opt = q.options.find((o) => o.value === String(value));
  return opt?.label || String(value);
}

export function SurveyResultsView({
  survey,
  surveyId,
  isOwner = false,
}: {
  survey: SurveyResults | null;
  surveyId?: string;
  isOwner?: boolean;
}) {
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<"xlsx" | "csv" | null>(null);

  if (!survey) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:bg-slate-900 dark:border-slate-700">
        <p className="text-slate-500 dark:text-slate-300">No results available yet.</p>
      </div>
    );
  }

  const totalResponses = survey.totalResponses;

  function safeParse(str: string) {
    try {
      return JSON.parse(str);
    } catch {
      return [str];
    }
  }

  const handleDownload = async (format: "xlsx" | "csv") => {
    if (!surveyId || exportingFormat) return;

    try {
      setExportingFormat(format);

      const response = await fetch(
        `/api/surveys/${surveyId}/export?format=${format}`
      );

      if (!response.ok) {
        throw new Error("Failed to export survey data");
      }

      // Read response as binary blob without triggering page navigation
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);

      // Determine clean filename from Content-Disposition or fallback
      let fileName = `ScholarBase_${survey.title.replace(/[^a-zA-Z0-9_-]/g, "_")}.${format}`;
      const disposition = response.headers.get("Content-Disposition");
      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match?.[1]) {
          fileName = match[1];
        }
      }

      // Trigger standard browser download
      const tempLink = document.createElement("a");
      tempLink.href = downloadUrl;
      tempLink.download = fileName;
      document.body.appendChild(tempLink);
      tempLink.click();

      // Clean up object URL from memory
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(tempLink);
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setExportingFormat(null);
    }
  };

  const getQuestionStats = (q: QuestionResult) => {
    const answers = q.answers.map((a) => a.value);
    const total = answers.length;

    if (q.type === "RATING" || q.type === "LINEAR_SCALE") {
      const numericValues = answers.map(Number).filter((n) => !isNaN(n));
      const avg =
        numericValues.length > 0
          ? numericValues.reduce((a, b) => a + b, 0) / numericValues.length
          : 0;
      const distribution: Record<string, number> = {};
      numericValues.forEach((v) => {
        distribution[v] = (distribution[v] || 0) + 1;
      });

      return { total, avg: avg.toFixed(1), distribution };
    }

    if (q.type === "MULTIPLE_CHOICE" || q.type === "DROPDOWN") {
      const counts: Record<string, number> = {};
      answers.forEach((a) => {
        const label = mapValueToLabel(q, a);
        counts[label] = (counts[label] || 0) + 1;
      });
      return { total, counts };
    }

    if (q.type === "CHECKBOXES") {
      const counts: Record<string, number> = {};
      answers.forEach((a) => {
        const vals = Array.isArray(a)
          ? a
          : typeof a === "string"
          ? safeParse(a)
          : [a];

        if (Array.isArray(vals)) {
          vals.forEach((v: string) => {
            const label = mapValueToLabel(q, v);
            counts[label] = (counts[label] || 0) + 1;
          });
        }
      });
      return { total, counts };
    }

    if (q.type === "LIKERT_SCALE") {
      const counts: Record<string, number> = {};
      answers.forEach((a) => {
        const key = String(a);
        counts[key] = (counts[key] || 0) + 1;
      });
      const orderedCounts: Record<string, number> = {};
      q.options.forEach((opt) => {
        orderedCounts[opt.label] = counts[opt.value] || 0;
      });
      return { total, counts: orderedCounts };
    }

    if (q.type === "MATRIX_LIKERT") {
      const columns = q.columnLabels ?? [];
      const rows = q.options.map((row) => {
        const counts: Record<string, number> = {};
        columns.forEach((col) => {
          counts[col] = 0;
        });
        let answered = 0;
        answers.forEach((a) => {
          const obj =
            a && typeof a === "object" && !Array.isArray(a)
              ? (a as Record<string, unknown>)
              : null;
          if (!obj) return;
          const idx = Number(obj[row.value]);
          if (Number.isInteger(idx) && idx >= 1 && idx <= columns.length) {
            counts[columns[idx - 1]] += 1;
            answered += 1;
          }
        });
        return { label: row.label, counts, answered };
      });
      return { total, rows };
    }

    return { total, answers: answers.filter((a) => a) };
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 flex items-center justify-between dark:bg-slate-900 dark:border-slate-700">
        <div>
          <h2 className="mb-2 break-words break-all text-lg font-semibold text-slate-800 dark:text-white">
            {survey.title}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Total Responses:{" "}
            <strong className="text-slate-800 dark:text-white">
              {totalResponses}
            </strong>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isOwner && surveyId && (
            <>
              <button
                type="button"
                onClick={() => handleDownload("xlsx")}
                disabled={!!exportingFormat}
                className="sb-button-soft text-sm inline-flex items-center gap-2 disabled:opacity-50"
              >
                {exportingFormat === "xlsx" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {exportingFormat === "xlsx" ? "Generating XLSX..." : "XLSX (Codebook + Data)"}
              </button>

              <button
                type="button"
                onClick={() => handleDownload("csv")}
                disabled={!!exportingFormat}
                className="sb-button-soft text-sm inline-flex items-center gap-2 disabled:opacity-50"
              >
                {exportingFormat === "csv" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {exportingFormat === "csv" ? "Generating CSV..." : "CSV (R / Python / Stata)"}
              </button>
            </>
          )}
        </div>
      </div>

      {survey.questions.map((q, idx) => {
        const stats = getQuestionStats(q);
        const isExpanded = activeQuestion === q.id;

        return (
          <div
            key={q.id}
            className="rounded-2xl border border-slate-200 bg-white overflow-hidden dark:bg-slate-900 dark:border-slate-700"
          >
            <button
              onClick={() => setActiveQuestion(isExpanded ? null : q.id)}
              className="flex w-full items-center justify-between p-6 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              <div className="min-w-0">
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  Q{idx + 1} • {q.type.replace(/_/g, " ").toLowerCase()}
                </span>
                <h3 className="break-words break-all whitespace-pre-wrap text-sm font-semibold text-slate-800 mt-1 dark:text-white">
                  {q.title}
                  {q.archivedAt ? " (archived)" : ""}
                </h3>
                <p className="text-xs text-slate-400 mt-1 dark:text-slate-300">
                  {stats.total} response{stats.total !== 1 ? "s" : ""}
                  {"avg" in stats && ` • Avg: ${stats.avg}`}
                </p>
              </div>
              <ChevronDown
                className={`h-5 w-5 text-slate-400 transition-transform ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
            </button>

            {isExpanded && (
              <div className="border-t border-slate-100 p-6 dark:border-slate-700">
                {"rows" in stats && stats.rows && (
                  <div className="space-y-4">
                    {stats.rows.map((row) => (
                      <div key={row.label}>
                        <p className="mb-1 break-words text-sm font-semibold text-slate-700 dark:text-slate-300">
                          {row.label}
                        </p>
                        <div className="space-y-1">
                          {Object.entries(row.counts).map(([col, count]) => {
                            const pct =
                              row.answered > 0
                                ? ((count / row.answered) * 100).toFixed(0)
                                : "0";
                            return (
                              <div key={col} className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-slate-600 dark:text-slate-300">
                                    {col}
                                  </span>
                                  <span className="text-slate-500 dark:text-slate-400">
                                    {count} ({pct}%)
                                  </span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-700">
                                  <div
                                    className="h-1.5 rounded-full bg-indigo-500 transition-all"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {"counts" in stats && stats.counts && (
                  <div className="space-y-2">
                    {Object.entries(stats.counts).map(([option, count]) => {
                      const pct =
                        stats.total > 0
                          ? ((count / stats.total) * 100).toFixed(0)
                          : "0";
                      return (
                        <div key={option} className="min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="break-words break-all font-medium text-slate-700 dark:text-slate-300">
                              {option}
                            </span>
                            <span className="text-slate-500 dark:text-slate-400">
                              {count} ({pct}%)
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700">
                            <div
                              className="h-2 rounded-full bg-blue-500 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {"distribution" in stats && stats.distribution && (
                  <div className="space-y-2">
                    {Object.entries(stats.distribution)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([value, count]) => {
                        const pct =
                          stats.total > 0
                            ? ((count / stats.total) * 100).toFixed(0)
                            : "0";
                        return (
                          <div key={value} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {value} {count > 1 ? "stars" : "star"}
                              </span>
                              <span className="text-slate-500 dark:text-slate-400">
                                {count} ({pct}%)
                              </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700">
                              <div
                                className="h-2 rounded-full bg-amber-400 transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}

                {"answers" in stats && stats.answers && (
                  <div className="space-y-2">
                    {stats.answers.length > 0 ? (
                      stats.answers.map((answer, i: number) => {
                        const text =
                          typeof answer === "string" ? answer : String(answer);
                        return (
                          <div
                            key={i}
                            className="break-words rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                          >
                            {text}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-slate-400 italic">
                        No text responses yet.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}