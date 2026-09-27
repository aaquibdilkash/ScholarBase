"use client";

import { usePathname } from "next/navigation";
import { useCallback } from "react";
import { useToast } from "@/components/ui/Toast";
import { Share, type LucideIcon } from "lucide-react";

export function ShareButton({
  href,
  label = "Share",
  variant = "default",
  copySuccessMessage = "Link copied!",
  className,
  icon: Icon = Share,
  iconClassName,
}: {
  href?: string;
  label?: string;
  variant?: "default" | "primary";
  copySuccessMessage?: string;
  className?: string;
  icon?: LucideIcon;
  iconClassName?: string;
}) {
  const pathname = usePathname();
  const { toast } = useToast();

  const onShare = useCallback(async () => {
    const shareUrl = href || (typeof window !== "undefined" ? `${window.location.origin}${pathname}` : "");

    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (navigator as any).share({ url: shareUrl });
        return;
      }

      if (shareUrl) {
        const nav = navigator as Navigator & {
          clipboard?: { writeText?: (text: string) => Promise<void> };
        };

        if (typeof navigator !== "undefined" && nav.clipboard?.writeText) {
          await nav.clipboard.writeText(shareUrl);
          toast(copySuccessMessage);
        }
      }
    } catch {
      // ignore (user canceled or clipboard denied)
    }
  }, [copySuccessMessage, href, pathname, toast]);

  const isPrimary = variant === "primary";
  const defaultClasses =
    "inline-flex h-8 min-w-8 items-center justify-center gap-2 rounded-lg px-1 text-sm font-medium text-slate-900 dark:text-slate-400 transition hover:text-blue-600 dark:hover:text-blue-300";

  return (
    <button
      type="button"
      onClick={onShare}
      className={
        isPrimary
          ? `sb-button-primary w-full gap-2 whitespace-nowrap sm:w-auto ${className ?? ""}`
          : className ?? defaultClasses
      }
      aria-label={label}
      title={label}
    >
      <Icon className={iconClassName ?? (isPrimary ? "h-4 w-4" : "h-5 w-5")} strokeWidth={2.5} />
      <span className={isPrimary ? undefined : "hidden sm:inline"}>{label}</span>
    </button>
  );
}
