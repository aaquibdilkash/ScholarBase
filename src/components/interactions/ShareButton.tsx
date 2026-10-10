"use client";

import { usePathname } from "next/navigation";
import { useCallback } from "react";
import { useToast } from "@/components/ui/Toast";
import { Share, type LucideIcon } from "lucide-react";

/**
 * Read a `<meta property="og:*">` value from the document head. Every route
 * already emits Open Graph tags via `buildMetadata`, so the share payload can
 * stay in sync with SEO without threading title/text through every call site.
 */
function readMeta(name: string): string {
  if (typeof document === "undefined") return "";
  const el = document.querySelector(`meta[property="${name}"]`);
  return el?.getAttribute("content")?.trim() ?? "";
}

/**
 * Strip the " | ScholarBase" brand suffix so a shared title reads naturally in
 * the destination app instead of repeating a brand the user already knows.
 */
function stripBrandSuffix(title: string): string {
  return title.replace(/\s*\|\s*ScholarBase$/i, "").trim();
}

export function ShareButton({
  href,
  label = "Share",
  variant = "default",
  copySuccessMessage = "Link copied!",
  className,
  icon: Icon = Share,
  iconClassName,
  title,
  text,
}: {
  href?: string;
  label?: string;
  variant?: "default" | "primary";
  copySuccessMessage?: string;
  className?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  /** Optional share title. Falls back to the page's `og:title`. */
  title?: string;
  /** Optional share text / message body. Falls back to the page's `og:description`. */
  text?: string;
}) {
  const pathname = usePathname();
  const { toast } = useToast();

  const onShare = useCallback(async () => {
    const shareUrl =
      href || (typeof window !== "undefined" ? `${window.location.origin}${pathname}` : "");

    // Resolve title/text: explicit props win, otherwise read the page's Open
    // Graph tags (already emitted by generateMetadata) so detail/list pages get
    // a rich share with zero call-site changes.
    const shareTitle = stripBrandSuffix(title ?? readMeta("og:title"));
    const shareText = (text ?? readMeta("og:description")).trim();
    // Compose a friendly message body; fall back to the title when no
    // description exists, and always keep the URL so the link survives.
    const composedText = [shareText || shareTitle, shareUrl].filter(Boolean).join("\n");

    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (navigator as any).share({
          ...(shareTitle ? { title: shareTitle } : {}),
          ...(shareText ? { text: shareText } : {}),
          ...(shareUrl ? { url: shareUrl } : {}),
        });
        return;
      }

      if (shareUrl) {
        const nav = navigator as Navigator & {
          clipboard?: { writeText?: (text: string) => Promise<void> };
        };

        if (typeof navigator !== "undefined" && nav.clipboard?.writeText) {
          await nav.clipboard.writeText(composedText || shareUrl);
          toast(copySuccessMessage);
        }
      }
    } catch {
      // ignore (user canceled or clipboard denied)
    }
  }, [copySuccessMessage, href, pathname, text, title, toast]);

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
