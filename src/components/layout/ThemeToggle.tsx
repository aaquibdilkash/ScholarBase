"use client";

import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

function applyTheme(theme: ThemeMode) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    return window.localStorage.getItem("sb-theme") === "dark"
      ? "dark"
      : "light";
  });

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem("sb-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    window.localStorage.setItem("sb-theme", nextTheme);
    applyTheme(nextTheme);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex w-full items-center justify-between rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-white hover:text-slate-950 dark:border-slate-700 dark:bg-[#020617] dark:text-slate-100 dark:shadow-black/20 dark:hover:border-slate-600 dark:hover:bg-black dark:hover:text-white"
      aria-label={
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      }
    >
      <span className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white dark:bg-black dark:text-white">
          {theme === "dark" ? (
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364 6.364-1.414-1.414M7.05 7.05 5.636 5.636m12.728 0-1.414 1.414M7.05 16.95l-1.414 1.414M12 8a4 4 0 100 8 4 4 0 000-8z"
              />
            </svg>
          ) : (
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 1019.9 16.1a8.993 8.993 0 01.454-.746z"
              />
            </svg>
          )}
        </span>
        <span className="leading-tight">
          <span className="block">Dark mode</span>
          <span className="block text-xs font-medium text-slate-500 dark:text-slate-300">
            {theme === "dark" ? "Enabled" : "Off"}
          </span>
        </span>
      </span>
      <span
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${theme === "dark" ? "bg-black" : "bg-slate-200"}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition ${theme === "dark" ? "translate-x-5" : "translate-x-1"} dark:bg-slate-100`}
        />
      </span>
    </button>
  );
}
