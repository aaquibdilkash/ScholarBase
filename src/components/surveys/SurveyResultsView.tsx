"use client";

import { useState } from "react";

type QuestionResult = {
  id: string;
  title: string;
  type: string;
  order: number;
  options: Array<{ id: string; value: string; label: string; order: number }>;
  answers: Array<{ value: string }>;
};

type SurveyResults = {
  id: string;
  title: string;
  questions: QuestionResult[];
  _count: { responses: number };
};

function exportToCSV(survey: SurveyResults) {
  const headers = ["Question", "Type", "Response Count", "Details"];
  const rows = survey.questions.map((q) => {
    const answers = q.answers.map((a) => a.value);
    const details = answers.join("; ");
    return [q.title, q.type, String(answers.length), details];
  });

  const csvContent = [
    headers.join(","),
    ...rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${survey.title.replace(/\s+/g, "_")}_results.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function SurveyResultsView({
  survey,
}: {
  survey: SurveyResults | null;
}) {
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);

  if (!survey) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-500">No results available yet.</p>
      </div>
    );
  }

  const totalResponses = survey._count.responses;

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
        counts[a] = (counts[a] || 0) + 1;
      });
      return { total, counts };
    }

    if (q.type === "CHECKBOXES") {
      const counts: Record<string, number> = {};
      answers.forEach((a) => {
        try {
          const vals = JSON.parse(a);
          vals.forEach((v: string) => {
            counts[v] = (counts[v] || 0) + 1;
          });
        } catch {
          counts[a] = (counts[a] || 0) + 1;
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
      <div className="rounded-2xl border border-slate-200 bg-white p-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-2">
            {survey.title}
          </h2>
          <p className="text-sm text-slate-500">
            Total Responses:{" "}
            <strong className="text-slate-800">{totalResponses}</strong>
          </p>
        </div>
        <button
          onClick={() => exportToCSV(survey)}
          className="sb-button-soft text-sm inline-flex items-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Export CSV
        </button>
      </div>

      {survey.questions.map((q, idx) => {
        const stats = getQuestionStats(q);
        const isExpanded = activeQuestion === q.id;

        return (
          <div
            key={q.id}
            className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
          >
            <button
              onClick={() => setActiveQuestion(isExpanded ? null : q.id)}
              className="flex w-full items-center justify-between p-6 text-left hover:bg-slate-50 transition"
            >
              <div>
                <span className="text-xs font-semibold text-blue-600">
                  Q{idx + 1} • {q.type.replace(/_/g, " ").toLowerCase()}
                </span>
                <h3 className="text-sm font-semibold text-slate-800 mt-1">
                  {q.title}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {stats.total} response{stats.total !== 1 ? "s" : ""}
                  {"avg" in stats && ` • Avg: ${stats.avg}`}
                </p>
              </div>
              <svg
                className={`h-5 w-5 text-slate-400 transition-transform ${
                  isExpanded ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {isExpanded && (
              <div className="border-t border-slate-100 p-6">
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
                            <span className="font-medium text-slate-700">
                              {option}
                            </span>
                            <span className="text-slate-500">
                              {count} ({pct}%)
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-slate-100">
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
                              <span className="font-medium text-slate-700">
                                {value} {count > 1 ? "stars" : "star"}
                              </span>
                              <span className="text-slate-500">
                                {count} ({pct}%)
                              </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-slate-100">
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
                          className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700"
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
