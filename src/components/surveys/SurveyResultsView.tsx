"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { ChevronDown, Download } from "lucide-react";
import type { QuestionResult, SurveyResults, IndividualResponse } from "@/types/survey";

function mapValueToLabel(q: QuestionResult, value: any): string {
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
  if (typeof value === 'string') {
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

function exportToExcel(
  survey: SurveyResults,
  responses: IndividualResponse[] | null,
) {
  // 1. Summary Sheet
  const summaryHeader = ["Question", "Type", "Response Count", "Details"];
  const summaryRows = survey.questions.map((q) => {
    const answers = q.answers.map((a) => mapValueToLabel(q, a.value));
    const details = answers.join("; ");
    return [q.archivedAt ? `${q.title} (archived)` : q.title, q.type, String(answers.length), details];
  });
  const summarySheet = XLSX.utils.aoa_to_sheet([summaryHeader, ...summaryRows]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

  // 2. Individual Responses Sheet (if available)
  if (responses) {
    const questionHeaders = survey.questions
      .sort((a, b) => a.order - b.order)
      .map((q) => q.archivedAt ? `${q.title} (archived)` : q.title);

    const individualResponsesHeader = [
      "Response ID",
      "Timestamp",
      "Respondent",
      ...questionHeaders,
    ];

    const individualResponsesRows = responses.map((res) => {
      const answersByQuestionId = new Map(
        res.answers.map((a) => [a.questionId, a.value]),
      );
      const row = [
        res.id,
        res.createdAt.toISOString(),
        res.isAnonymous ? "Anonymous" : (res.respondent?.name ?? "Unknown"),
      ];
      survey.questions.forEach((q) => {
        const rawValue = answersByQuestionId.get(q.id) || "";
        row.push(mapValueToLabel(q, rawValue));
      });
      return row;
    });

    const individualResponsesSheet = XLSX.utils.aoa_to_sheet([
      individualResponsesHeader,
      ...individualResponsesRows,
    ]);
    XLSX.utils.book_append_sheet(
      wb,
      individualResponsesSheet,
      "Individual Responses",
    );
  }

  XLSX.writeFile(wb, `${survey.title.replace(/\s+/g, "_")}_results.xlsx`);
}

export function SurveyResultsView({
  survey,
  responses,
}: {
  survey: SurveyResults | null;
  responses: IndividualResponse[] | null;
}) {
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);

  if (!survey) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:bg-slate-900 dark:border-slate-700">
        <p className="text-slate-500 dark:text-slate-300">No results available yet.</p>
      </div>
    );
  }

  const totalResponses = survey.totalResponses;

  function safeParse(str: string) {
      try { return JSON.parse(str) } catch { return [str] }
    }

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
        const label = mapValueToLabel(q, a); // Map value to label
        counts[label] = (counts[label] || 0) + 1;
      });
      return { total, counts };
    }

    if (q.type === "CHECKBOXES") {
      const counts: Record<string, number> = {};
      answers.forEach((a) => {
        // 'a' might already be a JS array because of Prisma JSONB
        const vals = Array.isArray(a) ? a : (typeof a === 'string' ? safeParse(a) : [a]);
        
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
        counts[a] = (counts[a] || 0) + 1;
      });
      const orderedCounts: Record<string, number> = {};
      q.options.forEach((opt) => {
        orderedCounts[opt.label] = counts[opt.value] || 0;
      });
      return { total, counts: orderedCounts };
    }

    // Text/Date types
    return { total, answers: answers.filter((a) => a) };
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 flex items-center justify-between dark:bg-slate-900 dark:border-slate-700">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-2 dark:text-white">
            {survey.title}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Total Responses:{" "}
            <strong className="text-slate-800 dark:text-white">{totalResponses}</strong>
          </p>
        </div>
        <button
          onClick={() => exportToExcel(survey, responses)}
          className="sb-button-soft text-sm inline-flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export Excel
        </button>
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
              <div>
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  Q{idx + 1} • {q.type.replace(/_/g, " ").toLowerCase()}
                </span>
                <h3 className="text-sm font-semibold text-slate-800 mt-1 dark:text-white">
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
                {"counts" in stats && stats.counts && (
                  <div className="space-y-2">
                    {Object.entries(stats.counts).map(([option, count]) => {
                      const pct =
                        stats.total > 0
                          ? ((count / stats.total) * 100).toFixed(0)
                          : "0";
                      return (
                        <div key={option} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-slate-700 dark:text-slate-300">
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
                      stats.answers.map((answer: string, i: number) => (
                        <div
                          key={i}
                          className="break-words rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                        >
                          {answer}
                        </div>
                      ))
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
