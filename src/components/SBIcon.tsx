import type { HTMLAttributes } from "react";

/**
 * Reproduces the "SB" text icon from `src/app/icon.tsx`:
 *  - Dark slate-950 (#020617) circular background
 *  - "S" in white
 *  - "B" in blue-500 (#3b82f6)
 *  - fontWeight 900, lineHeight 1
 *
 * The colours are kept consistent across light/dark modes so it always
 * looks like the favicon icon. Pass a sizing className (e.g. `h-10 w-10 text-[18px]`)
 * to control the dimensions for each usage context.
 */
export function SBIcon({ className = "", ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`inline-flex items-center justify-center gap-0 rounded-2xl bg-slate-950 font-extrabold leading-none text-white shadow-sm transition-all dark:shadow-[0_10px_24px_rgba(0,0,0,0.48)] ${className}`}
      {...props}
    >
      <span>S</span>
      <span className="text-blue-500">B</span>
    </span>
  );
}