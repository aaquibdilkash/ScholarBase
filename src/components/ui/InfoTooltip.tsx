"use client";

import { useState } from "react";
import { Info } from "lucide-react";

interface InfoTooltipProps {
  message: string;
}

export function InfoTooltip({ message }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      <button
        type="button"
        aria-label="More information"
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1 transition-colors"
        tabIndex={0}
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      <span
        role="tooltip"
        className={`absolute left-6 top-1/2 -translate-y-1/2 z-50 w-64 px-3 py-2 text-xs font-normal leading-relaxed text-white bg-slate-900 dark:bg-slate-800 rounded-lg shadow-lg pointer-events-none transition-opacity duration-150 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        {message}
        <span className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-slate-900 dark:bg-slate-800 rotate-45" />
      </span>
    </span>
  );
}
