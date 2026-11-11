"use client";

import Link from "next/link";
import { useState } from "react";
import { BookPlus, Search, X } from "lucide-react";
import { useJournalSearch } from "@/hooks/useJournalSearch";
import { MIN_SEARCH_LENGTH } from "@/lib/search-guard";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { EVENT_JOURNAL_TIP } from "@/constants/tooltips";

export function JournalPicker({
  journal,
  journalId,
  onJournalChange,
  onJournalIdChange,
}: {
  journal: string;
  journalId: string;
  onJournalChange: (value: string) => void;
  onJournalIdChange: (value: string) => void;
}) {
  const [search, setSearch] = useState("");
  const { results, isSearching, isError } = useJournalSearch(search, 6);

  return (
    <div>
      <label htmlFor="call-for-paper-journal" className="sb-label inline-flex items-center gap-1.5">
        Linked Journal (Optional)
        <InfoTooltip message={EVENT_JOURNAL_TIP} />
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          id="call-for-paper-journal"
          className="sb-input pl-9"
          value={search || journal}
          onChange={(event) => {
            onJournalIdChange("");
            onJournalChange("");
            setSearch(event.target.value);
          }}
          placeholder="Search ScholarBase journals"
          autoComplete="off"
        />
        {search.trim().length >= MIN_SEARCH_LENGTH && (
          <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950">
            {isSearching ? (
              <p className="px-3 py-3 text-sm text-slate-500">Searching ScholarBase…</p>
            ) : isError ? (
              <p className="px-3 py-3 text-sm text-red-600">
                Journal search is temporarily unavailable. Try again.
              </p>
            ) : results.length ? (
              results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onJournalIdChange(item.id);
                    onJournalChange(item.title);
                    setSearch("");
                  }}
                  className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                >
                  {item.title}
                </button>
              ))
            ) : (
              <div className="px-3 py-3">
                <p className="text-sm text-slate-500">No matching journal in ScholarBase.</p>
                <Link
                  href="/journals/add"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300"
                >
                  <BookPlus className="h-3.5 w-3.5" /> Add this journal
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
      <input type="hidden" name="journalId" value={journalId} />
      {journal && (
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
          Selected: {journal}
          <button
            type="button"
            onClick={() => {
              onJournalIdChange("");
              onJournalChange("");
            }}
            className="ml-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:underline"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        </p>
      )}
    </div>
  );
}
