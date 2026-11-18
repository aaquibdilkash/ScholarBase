"use client";

import { useEffect, useState } from "react";

type RorResult = { id: string; name: string; country: string | null };

export function RorOrganizationPicker({
  idPrefix,
  value,
  rorId,
  onChange,
  disabled,
}: {
  idPrefix: string;
  value: string;
  rorId: string;
  onChange: (selection: { name: string; rorId: string }) => void;
  disabled: boolean;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<RorResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2 || trimmed === value.trim()) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/ror/organizations?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        const payload = (await response.json()) as { items?: RorResult[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "ROR search failed.");
        setResults(payload.items ?? []);
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "ROR search failed.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, value]);

  return (
    <div className="relative">
      <label htmlFor={idPrefix} className="sb-label">Institution or research organization</label>
      <input
        id={idPrefix}
        className="sb-input"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          if (rorId) onChange({ name: event.target.value, rorId: "" });
        }}
        disabled={disabled}
        placeholder="Search ROR, for example Jamia Millia Islamia"
        autoComplete="off"
      />
      {loading ? <p className="mt-1 text-xs text-slate-500">Searching ROR…</p> : null}
      {error ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
      {results.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-[var(--card-border)] bg-white p-1 shadow-xl dark:bg-slate-900" role="listbox">
          {results.map((result) => (
            <li key={result.id}>
              <button
                type="button"
                className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => {
                  setQuery(result.name);
                  setResults([]);
                  onChange({ name: result.name, rorId: result.id });
                }}
                disabled={disabled}
              >
                <span className="block font-medium text-slate-900 dark:text-slate-100">{result.name}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{result.country ? `${result.country} · ` : ""}{result.id}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {rorId ? <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">ROR linked: {rorId}</p> : <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Select a result to attach a verified ROR identifier. Free-text affiliations remain allowed.</p>}
    </div>
  );
}
