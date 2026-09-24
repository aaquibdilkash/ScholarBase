"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookPlus, Search, UserPlus, X } from "lucide-react";
import { searchJournalsForPicker } from "@/app/actions/journals";
import { searchScholarsForPicker } from "@/app/actions/scholars";
import { ScholarSuggestionDropdown } from "@/components/interactions/ScholarSuggestionDropdown";

type Scholar = Awaited<ReturnType<typeof searchScholarsForPicker>>[number];
type Journal = Awaited<ReturnType<typeof searchJournalsForPicker>>[number];

export function PublicationLinkedPeopleFields({
  authors,
  journal,
  onAuthorsChange,
  onJournalChange,
  authorIds,
  onAuthorIdsChange,
  journalId,
  onJournalIdChange,
}: {
  authors: string;
  journal: string;
  onAuthorsChange: (value: string) => void;
  onJournalChange: (value: string) => void;
  authorIds: string[];
  onAuthorIdsChange: (value: string[]) => void;
  journalId: string;
  onJournalIdChange: (value: string) => void;
}) {
  const [authorSearch, setAuthorSearch] = useState("");
  const [journalSearch, setJournalSearch] = useState("");
  const [authorResults, setAuthorResults] = useState<Scholar[]>([]);
  const [authorSearching, setAuthorSearching] = useState(false);
  const [authorSearchError, setAuthorSearchError] = useState(false);
  const [journalResults, setJournalResults] = useState<Journal[]>([]);
  const [journalSearching, setJournalSearching] = useState(false);
  const [journalSearchError, setJournalSearchError] = useState(false);
  const selectedAuthorIds = authorIds;
  const selectedJournalId = journalId;

  useEffect(() => {
    if (authorSearch.trim().length < 2) {
      setAuthorResults([]);
      setAuthorSearching(false);
      setAuthorSearchError(false);
      return;
    }

    let active = true;
    setAuthorSearching(true);
    setAuthorSearchError(false);
    const timer = window.setTimeout(() => {
      searchScholarsForPicker(authorSearch, 6).then((results) => {
        if (active) {
          setAuthorResults(results);
          setAuthorSearching(false);
        }
      }).catch(() => {
        if (active) {
          setAuthorResults([]);
          setAuthorSearching(false);
          setAuthorSearchError(true);
        }
      });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [authorSearch]);

  useEffect(() => {
    if (journalSearch.trim().length < 2) {
      setJournalResults([]);
      setJournalSearching(false);
      setJournalSearchError(false);
      return;
    }

    let active = true;
    setJournalSearching(true);
    setJournalSearchError(false);
    const timer = window.setTimeout(() => {
      searchJournalsForPicker(journalSearch, 6).then((results) => {
        if (active) {
          setJournalResults(results);
          setJournalSearching(false);
        }
      }).catch(() => {
        if (active) {
          setJournalResults([]);
          setJournalSearching(false);
          setJournalSearchError(true);
        }
      });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [journalSearch]);

  const selectAuthor = (scholar: Scholar) => {
    if (selectedAuthorIds.includes(scholar.id)) {
      setAuthorSearch("");
      setAuthorResults([]);
      return;
    }

    const name = scholar.name || `@${scholar.handle}`;
    onAuthorIdsChange([...selectedAuthorIds, scholar.id]);
    onAuthorsChange(authors ? `${authors}, ${name}` : name);
    setAuthorSearch("");
    setAuthorResults([]);
  };

  const removeAuthor = () => {
    // Removing individual names is handled by re-entering the author selection.
    onAuthorIdsChange([]);
    onAuthorsChange("");
  };

  const selectJournal = (item: Journal) => {
    onJournalIdChange(item.id);
    onJournalChange(item.title);
    setJournalSearch("");
    setJournalResults([]);
  };

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="publication-authors" className="sb-label inline-flex items-center gap-1.5">
          Authors *
        </label>
        <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
          Search ScholarBase for one or more scholars. Their profiles help connect this publication to the community.
        </p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            id="publication-authors"
            className="sb-input pl-9"
            value={authorSearch}
            onChange={(event) => setAuthorSearch(event.target.value)}
            placeholder="Search ScholarBase"
            autoComplete="off"
            aria-label="Search ScholarBase authors"
          />
          <ScholarSuggestionDropdown
            suggestions={authorResults}
            loading={authorSearching}
            loadingMessage="Searching ScholarBase…"
            onSelect={selectAuthor}
            showShareAction
            emptyMessage={authorSearchError ? "Scholar search is temporarily unavailable. Try again." : authorSearch.length > 1 ? "No matching scholars. Invite them using the link below." : undefined}
          />
        </div>
        <input type="hidden" name="authorIds" value={selectedAuthorIds.join(",")} />
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">Selected: {authors || "No authors selected"}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          {selectedAuthorIds.length > 0 && (
            <button type="button" onClick={removeAuthor} className="text-xs font-medium text-red-600 hover:underline">
              Clear selected authors
            </button>
          )}
          <Link href="/scholars" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">
            <UserPlus className="h-3.5 w-3.5" /> Find or invite a scholar on ScholarBase
          </Link>
        </div>
      </div>

      <div>
        <label htmlFor="publication-journal" className="sb-label">Journal / Conference / Book</label>
        <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
          Link a journal already listed on ScholarBase. Books, conferences, and other outputs can be added without a journal link.
        </p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            id="publication-journal"
            className="sb-input pl-9"
            value={journalSearch || journal}
            onChange={(event) => { onJournalIdChange(""); setJournalSearch(event.target.value); onJournalChange(""); }}
            placeholder="Search ScholarBase journals"
            autoComplete="off"
            aria-label="Search ScholarBase journals"
          />
          {journalSearch.length > 1 ? (
            <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950">
              {journalSearching ? <p className="px-3 py-3 text-sm text-slate-500">Searching ScholarBase…</p> : journalSearchError ? <p className="px-3 py-3 text-sm text-red-600">Journal search is temporarily unavailable. Try again.</p> : journalResults.length ? journalResults.map((item) => (
                <button key={item.id} type="button" onClick={() => selectJournal(item)} className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm transition last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900">
                  {item.title}
                </button>
              )) : (
                <div className="px-3 py-3">
                  <p className="text-sm text-slate-500">No matching journal in ScholarBase.</p>
                  <Link href="/journals/add" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">
                    <BookPlus className="h-3.5 w-3.5" /> Add this journal to ScholarBase
                  </Link>
                </div>
              )}
            </div>
          ) : null}
        </div>
        <input type="hidden" name="journalId" value={selectedJournalId} />
        {journal && <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">Selected: {journal}</p>}
        <Link href="/journals/add" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">
          <BookPlus className="h-3.5 w-3.5" /> Add this journal to ScholarBase
        </Link>
        {journal && <button type="button" aria-label="Clear selected journal" onClick={() => { onJournalIdChange(""); onJournalChange(""); }} className="ml-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:underline"><X className="h-3.5 w-3.5" /> Clear</button>}
      </div>
    </div>
  );
}
