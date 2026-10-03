"use client";

import { Search } from "lucide-react";
import type { InputHTMLAttributes, KeyboardEvent, MouseEvent } from "react";
import { useToast } from "./Toast";
import { MIN_SEARCH_LENGTH } from "@/lib/search-guard";

export function SearchInput({
  className,
  minLength = MIN_SEARCH_LENGTH,
  onInvalidShortSearch,
  onKeyDown,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  minLength?: number;
  onInvalidShortSearch?: (value: string) => void;
}) {
  const { toast } = useToast();
  const value = typeof props.value === "string" ? props.value : "";

  const showInvalidToast = () => {
    if (onInvalidShortSearch) {
      onInvalidShortSearch(value);
    } else {
      toast(`Please enter at least ${minLength} characters to search.`);
    }
  };

  const handleButtonClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (value.trim().length < minLength) {
      e.preventDefault();
      showInvalidToast();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && value.trim().length < minLength) {
      e.preventDefault();
      showInvalidToast();
      return;
    }
    onKeyDown?.(e);
  };

  return (
    <div className={`relative ${className ?? ""}`.trim()}>
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
      <input
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        {...props}
        onKeyDown={handleKeyDown}
        className="sb-input w-full py-2.5 pl-10 pr-12"
      />
      <button
        type="submit"
        onClick={handleButtonClick}
        aria-label="Search"
        title="Search"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
