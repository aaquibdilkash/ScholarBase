"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

type ThemeMode = "light" | "dark";

function applyTheme(theme: ThemeMode) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export default function ThemeToggle({ collapsed }: { collapsed: boolean }) {
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
      className={`flex items-center rounded-2xl border border-slate-200/70 bg-white/80 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-white hover:text-slate-950 dark:border-slate-700 dark:bg-[#020617] dark:text-slate-100 dark:shadow-black/20 dark:hover:border-slate-600 dark:hover:bg-black dark:hover:text-white ${
        collapsed ? "justify-center p-3 h-13 w-13" : "justify-between px-4 py-3 w-full"
      }`}
      aria-label={
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      }
    >
      <span
        className={`flex items-center ${
          collapsed ? "justify-center" : "gap-3"
        }`}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white dark:bg-black dark:text-white">
          {theme === "dark" ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </span>
        {!collapsed && (
          <span className="leading-tight">
            <span className="block">Dark mode</span>
            <span className="block text-xs font-medium text-slate-500 dark:text-slate-300">
              {theme === "dark" ? "Enabled" : "Off"}
            </span>
          </span>
        )}
      </span>
      {!collapsed && (
        <span
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${theme === "dark" ? "bg-black shadow-[inset_0_1px_3px_rgba(255,255,255,0.12),0_10px_24px_rgba(0,0,0,0.45)] ring-1 ring-slate-700" : "bg-slate-200"}`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-[0_2px_5px_rgba(15,23,42,0.25)] transition ${theme === "dark" ? "translate-x-5 shadow-[0_6px_14px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.9)]" : "translate-x-1"} dark:bg-slate-100`}
          />
        </span>
      )}
    </button>
  );
}
