"use client";

import { useState } from "react";
import { X } from "lucide-react";
import {
  MAX_PUBLICATION_KEYWORDS,
  MAX_PUBLICATION_KEYWORD_COUNT,
  MAX_PUBLICATION_KEYWORD_LENGTH,
} from "@/lib/constants";

/** Split a comma-separated keywords string into a deduplicated, capped list. */
export function normalizeKeywordList(
  raw: string,
  maxCount: number = MAX_PUBLICATION_KEYWORD_COUNT,
  maxLength: number = MAX_PUBLICATION_KEYWORD_LENGTH,
): string[] {
  return [...new Set(
    raw
      .split(",")
      .map((k) => k.trim().replace(/\s+/g, " ").slice(0, maxLength))
      .filter(Boolean),
  )].slice(0, maxCount);
}

/**
 * Chip-style keywords input. UI-only; chips are joined back into a single
 * comma-separated string so the Prisma `keywords String?` column and the
 * tri-split ILIKE search keep working with zero migration (see plan).
 *
 * Optional `maxCount` / `maxLength` / `maxTotal` / `itemLabel` props let other
 * modules (e.g. profile interests) reuse it with their own budgets without
 * duplicating the component.
 */
export function KeywordChipsInput({
  value,
  onChange,
  maxCount = MAX_PUBLICATION_KEYWORD_COUNT,
  maxLength = MAX_PUBLICATION_KEYWORD_LENGTH,
  maxTotal = MAX_PUBLICATION_KEYWORDS,
  itemLabel = "keyword",
}: {
  value: string;
  onChange: (joined: string) => void;
  maxCount?: number;
  maxLength?: number;
  maxTotal?: number;
  itemLabel?: string;
}) {
  const [draft, setDraft] = useState("");
  const chips = normalizeKeywordList(value, maxCount, maxLength);

  const commit = (next: string[]) => {
    onChange(next.join(", "));
    setDraft("");
  };

  const addDraft = () => {
    const pieces = normalizeKeywordList(draft, maxCount, maxLength);
    if (pieces.length === 0) {
      setDraft("");
      return;
    }
    // Never exceed the total character budget.
    const withPieces = [...chips];
    for (const piece of pieces) {
      if (withPieces.length >= maxCount) break;
      if (!withPieces.some((c) => c.toLowerCase() === piece.toLowerCase())) {
        withPieces.push(piece);
      }
    }
    const nextJoined = withPieces.join(", ");
    if (nextJoined.length > maxTotal) return;
    commit(withPieces);
  };

  const removeAt = (index: number) => {
    commit(chips.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((kw, i) => (
          <span
            key={kw.toLowerCase()}
            className="inline-flex items-center gap-1 rounded-xl border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/15 dark:text-violet-300"
          >
            {kw}
            <button
              type="button"
              aria-label={`Remove ${itemLabel} ${kw}`}
              onClick={() => removeAt(i)}
              className="rounded-full p-0.5 transition hover:bg-violet-100 dark:hover:bg-violet-500/25"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addDraft();
            } else if (e.key === "Backspace" && !draft && chips.length) {
              removeAt(chips.length - 1);
            }
          }}
          onBlur={() => {
            if (draft.trim()) addDraft();
          }}
          placeholder={
            chips.length >= maxCount
              ? `Max ${maxCount} ${itemLabel}s`
              : `Type a ${itemLabel} (max ${maxLength} chars)`
          }
          disabled={chips.length >= maxCount}
          maxLength={maxLength}
          className="sb-input flex-1"
          aria-label={`Add a ${itemLabel}`}
        />
        <button
          type="button"
          onClick={addDraft}
          disabled={!draft.trim() || chips.length >= maxCount}
          className="shrink-0 rounded-lg bg-slate-950 px-3 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200"
        >
          Add
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {chips.length}/{maxCount} {itemLabel}s · up to{" "}
        {maxLength} chars each · Enter or click Add
      </p>
    </div>
  );
}
