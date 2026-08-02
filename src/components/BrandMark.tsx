import type { HTMLAttributes } from "react";

export function BrandMark({
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={className} {...props}>
      <span className="text-slate-950 dark:text-slate-50">Scholar</span>
      <span className="text-blue-600 dark:text-blue-300">Base</span>
    </span>
  );
}
