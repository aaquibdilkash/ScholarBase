import { BadgeCheck } from "lucide-react";

export function VerifiedBadge({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <BadgeCheck
      className={`shrink-0 text-emerald-600 dark:text-emerald-400 ${className}`}
      aria-label="Institutional email verified"
    />
  );
}
