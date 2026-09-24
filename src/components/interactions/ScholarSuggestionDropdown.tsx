"use client";

import { UserAvatar } from "@/components/ui/UserAvatar";
import { ShareButton } from "@/components/interactions/ShareButton";

type ScholarSuggestion = { id: string; name: string | null; handle: string | null; avatarUrl?: string | null };

export function ScholarSuggestionDropdown<T extends ScholarSuggestion>({
  suggestions,
  activeIndex = 0,
  onSelect,
  showShareAction = false,
  emptyMessage,
  loading = false,
  loadingMessage = "Searching ScholarBase…",
}: {
  suggestions: T[];
  activeIndex?: number;
  onSelect: (scholar: T) => void;
  showShareAction?: boolean;
  emptyMessage?: string;
  loading?: boolean;
  loadingMessage?: string;
}) {
  if (loading) {
    return (
      <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950">
        <p className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400">{loadingMessage}</p>
      </div>
    );
  }

  if (!suggestions.length && !emptyMessage) return null;

  return (
    <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950">
      {suggestions.length ? suggestions.map((user, index) => (
        <div key={user.id} className={`flex items-center gap-3 px-3 py-2 transition ${index === activeIndex ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-900"}`}>
          <button type="button" onClick={() => onSelect(user)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-950 text-xs font-semibold text-white dark:bg-slate-800">
              {user.avatarUrl ? <UserAvatar src={user.avatarUrl} name={user.name} /> : user.name?.charAt(0).toUpperCase() || "@"}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{user.name || "Scholar"}</span>
              <span className="block truncate text-xs text-slate-500 dark:text-slate-400">@{user.handle || "scholar"}</span>
            </span>
          </button>
          {showShareAction ? <ShareButton href={`/scholars/${user.id}`} label={`Invite ${user.name || "scholar"} to ScholarBase`} /> : null}
        </div>
      )) : <p className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>}
    </div>
  );
}
