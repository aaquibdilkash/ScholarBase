"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";

interface InfoTooltipProps {
  message: string;
}

export function InfoTooltip({ message }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    side: "left" | "right";
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const updatePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const tooltipWidth = Math.min(256, window.innerWidth - 16);
    const gap = 8;
    const opensLeft = rect.left >= tooltipWidth + gap + 8;
    const left = opensLeft
      ? rect.left - tooltipWidth - gap
      : Math.min(rect.right + gap, window.innerWidth - tooltipWidth - 8);
    const estimatedHeight = 72;
    const top =
      rect.top >= estimatedHeight + gap + 8
        ? rect.top - estimatedHeight - gap
        : Math.min(rect.bottom + gap, window.innerHeight - estimatedHeight - 8);

    setPosition({ top: Math.max(8, top), left: Math.max(8, left), side: opensLeft ? "left" : "right" });
  };

  useEffect(() => {
    if (!isVisible) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isVisible]);

  const showTooltip = () => {
    updatePosition();
    setIsVisible(true);
  };

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={showTooltip}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={showTooltip}
      onBlur={() => setIsVisible(false)}
    >
      <button
        type="button"
        ref={triggerRef}
        aria-label="More information"
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1 transition-colors"
        tabIndex={0}
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {isVisible && position && typeof document !== "undefined" &&
        createPortal(
          <span
            role="tooltip"
            style={{ top: position.top, left: position.left, width: `min(16rem, calc(100vw - 1rem))` }}
            className="fixed z-[10000] rounded-lg bg-slate-900 px-3 py-2 text-xs font-normal leading-relaxed text-white shadow-lg dark:bg-slate-800"
          >
            {message}
            <span
              className={`absolute top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 bg-slate-900 dark:bg-slate-800 ${
                position.side === "left" ? "-right-1" : "-left-1"
              }`}
            />
          </span>,
          document.body,
        )}
    </span>
  );
}
