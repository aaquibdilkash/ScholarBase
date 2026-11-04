"use client";

import { Loader2, Search, X } from "lucide-react";
import { useRef } from "react";
import type {
  InputHTMLAttributes,
  KeyboardEvent,
  MouseEvent,
} from "react";
import { useToast } from "./Toast";
import { MIN_SEARCH_LENGTH } from "@/lib/search-guard";

export function SearchInput({
  className,
  minLength = MIN_SEARCH_LENGTH,
  activeQuery,
  onClear,
  loading = false,
  onInvalidShortSearch,
  onKeyDown,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  minLength?: number;
  /**
   * The search term currently applied to the list (the URL's `?q`). When one
   * is active, an empty box is a "clear the search" action and submits even
   * though it is below the floor. With no active search there is nothing to
   * clear, so an empty box is just a too-short search and shows the normal
   * toast.
   */
  activeQuery?: string;
  /**
   * Clears the box. URL-backed lists also remove `?q` here so the page returns
   * to the unfiltered list, instead of the browser's native clear button which
   * only empties the text and leaves the old results on screen.
   */
  onClear?: () => void;
  /**
   * A live search is in flight. Replaces the submit glyph with a spinner so
   * search-as-you-type surfaces have visible progress without a second control.
   */
  loading?: boolean;
  onInvalidShortSearch?: (value: string) => void;
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const value = typeof props.value === "string" ? props.value : "";
  const trimmedLength = value.trim().length;
  const isClearAction = trimmedLength === 0 && (activeQuery ?? "").trim() !== "";
  const isTooShort = !isClearAction && trimmedLength < minLength;
  const showClearButton = onClear !== undefined && value.length > 0;

  const showInvalidToast = () => {
    if (onInvalidShortSearch) {
      onInvalidShortSearch(value);
    } else {
      toast(`Please enter at least ${minLength} characters to search.`);
    }
  };

  const handleButtonClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (isTooShort) {
      e.preventDefault();
      showInvalidToast();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && isTooShort) {
      e.preventDefault();
      showInvalidToast();
      return;
    }
    onKeyDown?.(e);
  };

  const handleClear = () => {
    onClear?.();
    // The clear button disappears with the text; keep focus in the box.
    inputRef.current?.focus();
  };

  return (
    <div className={className?.trim() || undefined}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          {...props}
          onKeyDown={handleKeyDown}
          className={`sb-input w-full py-2.5 pl-10 ${
            showClearButton ? "pr-20" : "pr-12"
          } [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none`}
        />
        {showClearButton ? (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            title="Clear search"
            className="absolute right-10 top-1/2 -translate-y-1/2 cursor-pointer rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
        <button
          type="submit"
          onClick={handleButtonClick}
          aria-label="Search"
          aria-busy={loading || undefined}
          title={loading ? "Searching…" : "Search"}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Search className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {trimmedLength > 0 && trimmedLength < minLength ? (
        <p className="mt-1.5 px-1 text-[11px] text-slate-500 dark:text-slate-400">
          Type at least {minLength} characters to search.
        </p>
      ) : null}
    </div>
  );
}
