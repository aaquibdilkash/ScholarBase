"use client";

import { useState, useEffect } from "react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import Link from "next/link";
import { getScholars } from "@/app/actions/scholars";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

export type MentionUser = { id: string; handle: string | null };

type ScholarSuggestion = Awaited<ReturnType<typeof getScholars>>[number];

export function MentionComposer({
  name,
  value,
  onChange,
  placeholder,
  mentionedUsers,
  onMentionedUsersChange,
  label,
  tooltip,
  maxLength = 256,
  required = true,
  rows = 2,
  showPreview = true,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  mentionedUsers: MentionUser[];
  onMentionedUsersChange: (users: MentionUser[]) => void;
  label?: string;
  tooltip?: string;
  maxLength?: number;
  required?: boolean;
  rows?: number;
  showPreview?: boolean;
}) {
  const [suggestions, setSuggestions] = useState<ScholarSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const match = value.match(/(?:^|\s)@([a-z0-9_]{1,})$/i);
    const term = match?.[1] ?? "";
    if (term.length < 2) {
      setSuggestions([]);
      return;
    }
    const handle = window.setTimeout(() => {
      getScholars(term).then((users) => setSuggestions(users.slice(0, 5)));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [value]);

  const insertSuggestion = (user: ScholarSuggestion) => {
    const trimmed = value.replace(
      /(?:^|\s)@([a-z0-9_]{1,})$/i,
      ` @${user.handle || user.name || "scholar"} `,
    );
    onChange(trimmed.replace(/^ /, ""));
    setSuggestions([]);
    setActiveIndex(0);
    if (!mentionedUsers.find((u) => u.id === user.id)) {
      onMentionedUsersChange([
        ...mentionedUsers,
        { id: user.id, handle: user.handle ?? null },
      ]);
    }
  };

  return (
    <div className="relative min-w-0">
      {label && (
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {label}
          </span>
          {tooltip && <InfoTooltip message={tooltip} />}
        </div>
      )}
      <textarea
        name={name}
        value={value}
        placeholder={placeholder}
        required={required}
        rows={rows}
        maxLength={maxLength}
        className="w-full break-words resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 outline-none transition focus:bg-white focus:ring-2 focus:ring-blue-600 md:p-4 md:text-base dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-100"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (!suggestions.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((current) => (current + 1) % suggestions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex(
              (current) =>
                (current - 1 + suggestions.length) % suggestions.length,
            );
          } else if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            insertSuggestion(suggestions[activeIndex]);
          } else if (e.key === "Escape") {
            setSuggestions([]);
          }
        }}
      />
      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {value.length}/{maxLength} characters
      </div>
      {suggestions.length > 0 && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950">
          {suggestions.map((user, index) => (
            <button
              key={user.id}
              type="button"
              onClick={() => insertSuggestion(user)}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left transition ${index === activeIndex ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-900"}`}
            >
              <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-slate-950 text-xs font-semibold text-white dark:bg-slate-800">
                {user.avatarUrl ? (
                  <UserAvatar src={user.avatarUrl} name={user.name} />
                ) : (
                  user.name?.charAt(0).toUpperCase() || "@"
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {user.name || "Scholar"}
                </span>
                <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                  @{user.handle || "scholar"}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
      {showPreview && (
        <div className="mt-2 break-words overflow-wrap-anywhere rounded-xl border border-dashed border-slate-200 bg-white/70 p-3 text-sm leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
          {renderMentionContent(value || placeholder, mentionedUsers)}
        </div>
      )}
    </div>
  );
}

export function renderMentionContent(content: string, mentions: unknown, options?: { onMentionClick?: (e: React.MouseEvent) => void; renderAsLink?: boolean }) {
  const typedMentions = Array.isArray(mentions)
    ? (mentions as MentionUser[])
    : null;
  const parts = content.split(/(@[a-z0-9_]+)/gi);
  const renderAsLink = options?.renderAsLink ?? true;

  if (!typedMentions || typedMentions.length === 0) {
    return parts.map((part, index) => <span key={index}>{part}</span>);
  }

  const mentionMap = new Map(
    typedMentions.filter((m) => m.handle).map((m) => [m.handle!, m.id]),
  );

  return parts.map((part, index) => {
    if (part.startsWith("@")) {
      const handle = part.substring(1);
      const mentionId = mentionMap.get(handle);
      if (mentionId) {
        if (!renderAsLink) {
          return (
            <span
              key={index}
              role="link"
              tabIndex={0}
              data-mention-id={mentionId}
              onClick={options?.onMentionClick}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && options?.onMentionClick) {
                  e.preventDefault();
                  options.onMentionClick(e as unknown as React.MouseEvent);
                }
              }}
              className="cursor-pointer font-semibold text-blue-600 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
            >
              {part}
            </span>
          );
        }
        return (
          <Link
            key={index}
            href={`/scholars/${mentionId}`}
            onClick={options?.onMentionClick}
            className="font-semibold text-blue-600 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
          >
            {part}
          </Link>
        );
      }
    }
    return <span key={index}>{part}</span>;
  });
}
